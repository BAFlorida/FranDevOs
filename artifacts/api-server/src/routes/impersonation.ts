import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  StartImpersonationBody,
  StartImpersonationResponse,
  StopImpersonationResponse,
} from "@workspace/api-zod";
import {
  requireAuth,
  requirePermission,
  buildAppUser,
  displayNameFor,
} from "../lib/permissions";
import { getSessionId, getSession, updateSession } from "../lib/auth";
import { writeAudit } from "../lib/audit";

const router: IRouter = Router();

// Begin acting as another user. Requires the impersonate_users permission
// (super admin). When already impersonating, requireAuth resolves req.appUser to
// the impersonated user — who lacks impersonate_users — so requirePermission
// naturally blocks nested impersonation.
router.post(
  "/impersonate/start",
  requireAuth,
  requirePermission("impersonate_users"),
  async (req: Request, res: Response) => {
    const parsed = StartImpersonationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    const sid = getSessionId(req);
    const session = sid ? await getSession(sid) : null;
    if (!sid || !session) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const realId = req.user!.id;
    const targetId = parsed.data.userId;
    if (targetId === realId) {
      res.status(400).json({ error: "You cannot impersonate yourself." });
      return;
    }

    const [target] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, targetId));
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (target.isActive === false) {
      res
        .status(400)
        .json({ error: "You cannot impersonate a deactivated user." });
      return;
    }
    if (target.role === "super_admin") {
      res
        .status(403)
        .json({ error: "You cannot impersonate another super admin." });
      return;
    }

    await updateSession(sid, { ...session, impersonatedUserId: targetId });

    const [realRow] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, realId));
    await writeAudit({
      actorId: realId,
      actorName: realRow ? displayNameFor(realRow) : null,
      action: "impersonation.started",
      targetType: "user",
      targetId: target.id,
      targetLabel: displayNameFor(target),
    });

    res.json(
      StartImpersonationResponse.parse(
        await buildAppUser(target, { impersonating: true, realRow }),
      ),
    );
  },
);

// Stop impersonating and return to the real super admin identity.
router.post(
  "/impersonate/stop",
  requireAuth,
  async (req: Request, res: Response) => {
    const sid = getSessionId(req);
    const session = sid ? await getSession(sid) : null;
    if (!sid || !session) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const realId = req.user!.id;
    const [realRow] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, realId));
    if (!realRow) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const impId = session.impersonatedUserId ?? null;
    if (impId) {
      const [target] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, impId));
      await updateSession(sid, { ...session, impersonatedUserId: null });
      await writeAudit({
        actorId: realId,
        actorName: displayNameFor(realRow),
        action: "impersonation.stopped",
        targetType: "user",
        targetId: impId,
        targetLabel: target ? displayNameFor(target) : impId,
      });
    }

    res.json(StopImpersonationResponse.parse(await buildAppUser(realRow)));
  },
);

export default router;
