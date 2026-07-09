import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  GetMeResponse,
  ListUsersResponse,
  UpdateUserBody,
  UpdateUserResponse,
  CreateUserBody,
  DeactivateUserResponse,
  ActivateUserResponse,
  ResetUserPasswordBody,
  ResetUserPasswordResponse,
  MergeUserBody,
  MergeUserResponse,
} from "@workspace/api-zod";
import {
  requireAuth,
  requirePermission,
  hasPermission,
  displayNameFor,
  maySetRole as maySetRoleFor,
} from "../lib/permissions";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../lib/password";
import { writeAudit } from "../lib/audit";
import { mergeUsers } from "../lib/mergeUsers";

const router: IRouter = Router();

type UserRow = typeof usersTable.$inferSelect;

function serializeUser(u: UserRow) {
  return {
    id: u.id,
    name: displayNameFor(u),
    email: u.email,
    role: u.role,
    avatarColor: u.avatarColor,
    profileImageUrl: u.profileImageUrl,
    hasLogin: u.passwordHash != null,
    isActive: u.isActive,
  };
}

// Only a super admin (holder of impersonate_users) may grant or modify the
// super_admin role. Delegates to the centralized invariant in permissions.ts.
function maySetRole(req: Request, targetRole: string | undefined): boolean {
  return maySetRoleFor(req.appUser, targetRole);
}

router.get("/me", requireAuth, (req: Request, res: Response) => {
  res.json(GetMeResponse.parse(req.appUser));
});

router.get("/users", requireAuth, async (_req: Request, res: Response) => {
  const rows = await db.select().from(usersTable);
  const data = rows
    .map(serializeUser)
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json(ListUsersResponse.parse(data));
});

router.post(
  "/users",
  requireAuth,
  requirePermission("manage_users"),
  async (req: Request, res: Response) => {
    const parsed = CreateUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const { name, email, role, avatarColor } = parsed.data;
    if (!name || !name.trim()) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    if (!maySetRole(req, role)) {
      res
        .status(403)
        .json({ error: "Only a super admin can assign the Super Admin role." });
      return;
    }

    // Stop split identities at the source: if a member with this email already
    // exists, never mint a parallel record. Reuse (claim) the existing one when
    // it has no login yet; refuse when it is already a real, loggable account.
    const trimmedEmail = email?.trim() || null;
    if (trimmedEmail) {
      const [existing] = await db
        .select()
        .from(usersTable)
        .where(eq(sql`lower(${usersTable.email})`, trimmedEmail.toLowerCase()));
      if (existing) {
        if (existing.passwordHash != null) {
          res
            .status(400)
            .json({ error: "A member with this email already exists." });
          return;
        }
        const [claimed] = await db
          .update(usersTable)
          .set({
            displayName: name.trim(),
            role: role ?? existing.role,
            isActive: true,
            ...(avatarColor ? { avatarColor } : {}),
          })
          .where(eq(usersTable.id, existing.id))
          .returning();
        await writeAudit({
          actor: req.appUser,
          action: "user.claimed",
          targetType: "user",
          targetId: claimed!.id,
          targetLabel: displayNameFor(claimed!),
          before: { name: displayNameFor(existing), role: existing.role },
          after: {
            name: displayNameFor(claimed!),
            email: claimed!.email,
            role: claimed!.role,
            reusedExistingRecord: true,
          },
        });
        res.status(201).json(UpdateUserResponse.parse(serializeUser(claimed!)));
        return;
      }
    }

    const [row] = await db
      .insert(usersTable)
      .values({
        displayName: name.trim(),
        email: trimmedEmail,
        role: role ?? "member",
        ...(avatarColor ? { avatarColor } : {}),
      })
      .returning();

    await writeAudit({
      actor: req.appUser,
      action: "user.created",
      targetType: "user",
      targetId: row!.id,
      targetLabel: displayNameFor(row!),
      after: { name: displayNameFor(row!), email: row!.email, role: row!.role },
    });

    res.status(201).json(UpdateUserResponse.parse(serializeUser(row!)));
  },
);

router.patch(
  "/users/:id",
  requireAuth,
  requirePermission("manage_users"),
  async (req: Request, res: Response) => {
    const parsed = UpdateUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const id = String(req.params.id);
    const [before] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id));
    if (!before) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Guard the super_admin role: only a super admin may grant it, demote a
    // current super admin, or otherwise change a super admin's role.
    if (
      (parsed.data.role !== undefined && !maySetRole(req, parsed.data.role)) ||
      (before.role === "super_admin" &&
        !hasPermission(req.appUser, "impersonate_users"))
    ) {
      res
        .status(403)
        .json({ error: "Only a super admin can manage the Super Admin role." });
      return;
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) patch.displayName = parsed.data.name;
    if (parsed.data.email !== undefined) patch.email = parsed.data.email;
    if (parsed.data.role !== undefined) patch.role = parsed.data.role;
    if (parsed.data.avatarColor !== undefined)
      patch.avatarColor = parsed.data.avatarColor;

    const [row] = await db
      .update(usersTable)
      .set(patch)
      .where(eq(usersTable.id, id))
      .returning();

    if (parsed.data.role !== undefined && parsed.data.role !== before.role) {
      await writeAudit({
        actor: req.appUser,
        action: "user.role_changed",
        targetType: "user",
        targetId: row!.id,
        targetLabel: displayNameFor(row!),
        before: { role: before.role },
        after: { role: row!.role },
      });
    } else {
      await writeAudit({
        actor: req.appUser,
        action: "user.updated",
        targetType: "user",
        targetId: row!.id,
        targetLabel: displayNameFor(row!),
        before: {
          name: displayNameFor(before),
          email: before.email,
          avatarColor: before.avatarColor,
        },
        after: {
          name: displayNameFor(row!),
          email: row!.email,
          avatarColor: row!.avatarColor,
        },
      });
    }

    res.json(UpdateUserResponse.parse(serializeUser(row!)));
  },
);

router.post(
  "/users/:id/deactivate",
  requireAuth,
  requirePermission("manage_users"),
  async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (id === req.appUser!.id) {
      res.status(400).json({ error: "You cannot deactivate yourself" });
      return;
    }
    const [row] = await db
      .update(usersTable)
      .set({ isActive: false })
      .where(eq(usersTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    await writeAudit({
      actor: req.appUser,
      action: "user.deactivated",
      targetType: "user",
      targetId: row.id,
      targetLabel: displayNameFor(row),
    });
    res.json(DeactivateUserResponse.parse(serializeUser(row)));
  },
);

router.post(
  "/users/:id/activate",
  requireAuth,
  requirePermission("manage_users"),
  async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const [row] = await db
      .update(usersTable)
      .set({ isActive: true })
      .where(eq(usersTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    await writeAudit({
      actor: req.appUser,
      action: "user.activated",
      targetType: "user",
      targetId: row.id,
      targetLabel: displayNameFor(row),
    });
    res.json(ActivateUserResponse.parse(serializeUser(row)));
  },
);

// Admin-initiated password reset: sets a new password for another user. The
// target can sign in immediately with it (and should change it afterwards).
router.post(
  "/users/:id/reset-password",
  requireAuth,
  requirePermission("manage_users"),
  async (req: Request, res: Response) => {
    const parsed = ResetUserPasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const { newPassword } = parsed.data;
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
      return;
    }
    const id = String(req.params.id);
    const [target] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id));
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    // Only a super admin may reset another super admin's password.
    if (
      target.role === "super_admin" &&
      !hasPermission(req.appUser, "impersonate_users")
    ) {
      res.status(403).json({
        error: "Only a super admin can reset a Super Admin's password.",
      });
      return;
    }

    const [row] = await db
      .update(usersTable)
      .set({ passwordHash: hashPassword(newPassword), passwordSetAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning();

    await writeAudit({
      actor: req.appUser,
      action: "user.password_reset",
      targetType: "user",
      targetId: row!.id,
      targetLabel: displayNameFor(row!),
    });

    res.json(ResetUserPasswordResponse.parse(serializeUser(row!)));
  },
);

// Merge a duplicate ("source") member into a surviving ("target") member. Every
// user-id reference is repointed onto the target and the source is retired, so
// the person ends up with a single identity that holds all of their work. This
// is how split member identities (a placeholder twin + a real login account) are
// reconciled, both for historical data and any future accidental duplicates.
router.post(
  "/users/:id/merge",
  requireAuth,
  requirePermission("manage_users"),
  async (req: Request, res: Response) => {
    const parsed = MergeUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const targetId = String(req.params.id);
    const sourceId = parsed.data.sourceUserId;
    if (sourceId === targetId) {
      res.status(400).json({ error: "Cannot merge an account into itself" });
      return;
    }
    // Never let the actor retire the identity they are currently signed in as.
    if (sourceId === req.user!.id) {
      res
        .status(400)
        .json({ error: "You cannot merge your own account away" });
      return;
    }

    const [source] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, sourceId));
    const [target] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, targetId));
    if (!source || !target) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Guard the top-tier role exactly like every other user mutation: only a
    // super admin may merge into or out of a super admin account.
    if (
      (source.role === "super_admin" || target.role === "super_admin") &&
      !hasPermission(req.appUser, "impersonate_users")
    ) {
      res.status(403).json({
        error: "Only a super admin can merge a Super Admin account.",
      });
      return;
    }

    const result = await mergeUsers(targetId, sourceId);

    await writeAudit({
      actor: req.appUser,
      action: "user.merged",
      targetType: "user",
      targetId: result.survivor.id,
      targetLabel: displayNameFor(result.survivor),
      before: {
        mergedFrom: { id: source.id, name: displayNameFor(source) },
      },
      after: {
        survivor: { id: result.survivor.id, name: displayNameFor(result.survivor) },
        movedReferences: result.movedReferences,
        totalMoved: result.totalMoved,
      },
    });

    res.json(MergeUserResponse.parse(serializeUser(result.survivor)));
  },
);

export default router;
