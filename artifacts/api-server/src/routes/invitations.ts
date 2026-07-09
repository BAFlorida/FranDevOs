import crypto from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, invitationsTable, type Invitation } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import {
  ListInvitationsResponse,
  ListInvitationsResponseItem,
  CreateInvitationBody,
  RevokeInvitationResponse,
  RegenerateInvitationResponse,
  GetInvitationByTokenResponse,
} from "@workspace/api-zod";
import {
  requireAuth,
  requirePermission,
  displayNameFor,
  maySetRole,
} from "../lib/permissions";
import { writeAudit } from "../lib/audit";

const router: IRouter = Router();

type UserRow = typeof usersTable.$inferSelect;

// An invite that is still "pending" but past its expiry behaves exactly like a
// revoked invite everywhere it is surfaced.
function isExpired(inv: Invitation): boolean {
  return inv.status === "pending" && inv.expiresAt.getTime() <= Date.now();
}

function effectiveStatus(inv: Invitation): string {
  return isExpired(inv) ? "revoked" : inv.status;
}

function serializeInvitation(
  inv: Invitation,
  targetUser: UserRow | undefined,
) {
  const targetName = inv.targetUserId
    ? targetUser
      ? displayNameFor(targetUser)
      : null
    : inv.newMemberName ?? null;
  return {
    id: inv.id,
    token: inv.token,
    role: inv.role,
    status: effectiveStatus(inv),
    targetUserId: inv.targetUserId,
    targetName,
    newMemberEmail: inv.newMemberEmail,
    inviteUrl: `/invite/${inv.token}`,
    createdById: inv.createdById,
    acceptedByUserId: inv.acceptedByUserId,
    acceptedAt: inv.acceptedAt,
    expiresAt: inv.expiresAt,
    createdAt: inv.createdAt,
  };
}

router.get(
  "/invitations",
  requireAuth,
  requirePermission("manage_invitations"),
  async (_req: Request, res: Response) => {
    const rows = await db.select().from(invitationsTable);
    const targetIds = rows
      .map((r) => r.targetUserId)
      .filter((id): id is string => id != null);
    const targets = targetIds.length
      ? await db
          .select()
          .from(usersTable)
          .where(inArray(usersTable.id, targetIds))
      : [];
    const byId = new Map(targets.map((t) => [t.id, t]));
    const data = rows
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((inv) =>
        serializeInvitation(inv, inv.targetUserId ? byId.get(inv.targetUserId) : undefined),
      );
    res.json(ListInvitationsResponse.parse(data));
  },
);

router.post(
  "/invitations",
  requireAuth,
  requirePermission("manage_invitations"),
  async (req: Request, res: Response) => {
    const parsed = CreateInvitationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const { role, targetUserId, newMemberName, newMemberEmail } = parsed.data;

    // Only a super admin may mint an invite that grants the super_admin role.
    if (!maySetRole(req.appUser, role)) {
      res.status(403).json({ error: "Only a super admin may grant the super admin role" });
      return;
    }

    let targetUser: UserRow | undefined;
    if (targetUserId) {
      [targetUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, targetUserId));
      if (!targetUser) {
        res.status(400).json({ error: "Target member not found" });
        return;
      }
      if (targetUser.passwordHash != null) {
        res.status(400).json({ error: "That member already has a login" });
        return;
      }
      const [existingPending] = await db
        .select()
        .from(invitationsTable)
        .where(
          and(
            eq(invitationsTable.targetUserId, targetUserId),
            eq(invitationsTable.status, "pending"),
          ),
        );
      if (existingPending) {
        res
          .status(400)
          .json({ error: "That member already has a pending invite" });
        return;
      }
    } else if (!newMemberName || !newMemberName.trim()) {
      res.status(400).json({
        error: "Provide either a target member or a new member name",
      });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const [inv] = await db
      .insert(invitationsTable)
      .values({
        token,
        role,
        targetUserId: targetUserId ?? null,
        newMemberName: targetUserId ? null : newMemberName!.trim(),
        newMemberEmail: targetUserId ? null : newMemberEmail ?? null,
        status: "pending",
        createdById: req.appUser!.id,
      })
      .returning();
    await writeAudit({
      actor: req.appUser,
      action: "invite.created",
      targetType: "invitation",
      targetId: inv!.id,
      targetLabel: targetUser ? displayNameFor(targetUser) : newMemberName ?? null,
      after: { role: inv!.role },
    });
    res.status(201).json(ListInvitationsResponseItem.parse(serializeInvitation(inv!, targetUser)));
  },
);

router.post(
  "/invitations/:id/revoke",
  requireAuth,
  requirePermission("manage_invitations"),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [inv] = await db
      .select()
      .from(invitationsTable)
      .where(eq(invitationsTable.id, id));
    if (!inv) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }
    if (inv.status === "accepted") {
      res.status(400).json({ error: "Accepted invites cannot be revoked" });
      return;
    }
    const [updated] = await db
      .update(invitationsTable)
      .set({ status: "revoked" })
      .where(eq(invitationsTable.id, id))
      .returning();
    let targetUser: UserRow | undefined;
    if (updated!.targetUserId) {
      [targetUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, updated!.targetUserId));
    }
    await writeAudit({
      actor: req.appUser,
      action: "invite.revoked",
      targetType: "invitation",
      targetId: updated!.id,
      targetLabel: targetUser ? displayNameFor(targetUser) : updated!.newMemberName,
    });
    res.json(RevokeInvitationResponse.parse(serializeInvitation(updated!, targetUser)));
  },
);

router.post(
  "/invitations/:id/regenerate",
  requireAuth,
  requirePermission("manage_invitations"),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const [inv] = await db
      .select()
      .from(invitationsTable)
      .where(eq(invitationsTable.id, id));
    if (!inv) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }
    if (inv.status !== "pending") {
      res
        .status(400)
        .json({ error: "Only pending invitations can be regenerated" });
      return;
    }
    // A non-super-admin must not be able to re-issue a super_admin invite.
    if (!maySetRole(req.appUser, inv.role)) {
      res.status(403).json({ error: "Only a super admin may grant the super admin role" });
      return;
    }
    const token = crypto.randomBytes(32).toString("hex");
    const [updated] = await db
      .update(invitationsTable)
      .set({ token })
      .where(eq(invitationsTable.id, id))
      .returning();
    let targetUser: UserRow | undefined;
    if (updated!.targetUserId) {
      [targetUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, updated!.targetUserId));
    }
    await writeAudit({
      actor: req.appUser,
      action: "invite.regenerated",
      targetType: "invitation",
      targetId: updated!.id,
      targetLabel: targetUser ? displayNameFor(targetUser) : updated!.newMemberName,
    });
    res.json(
      RegenerateInvitationResponse.parse(serializeInvitation(updated!, targetUser)),
    );
  },
);

router.get(
  "/invitations/by-token/:token",
  async (req: Request, res: Response) => {
    const token = String(req.params.token);
    const [inv] = await db
      .select()
      .from(invitationsTable)
      .where(eq(invitationsTable.token, token));
    if (!inv) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }
    let invitedAs = inv.newMemberName ?? "New member";
    if (inv.targetUserId) {
      const [target] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, inv.targetUserId));
      if (target) invitedAs = displayNameFor(target);
    }
    res.json(
      GetInvitationByTokenResponse.parse({
        token: inv.token,
        role: inv.role,
        status: effectiveStatus(inv),
        invitedAs,
      }),
    );
  },
);

export default router;
