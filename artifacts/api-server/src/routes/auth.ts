import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetCurrentAuthUserResponse,
  LoginWithPasswordBody,
  LoginWithPasswordResponse,
  AcceptInvitationBody,
  AcceptInvitationResponse,
  ChangeMyPasswordBody,
  ChangeMyPasswordResponse,
  LogoutResponse,
} from "@workspace/api-zod";
import { db, usersTable, invitationsTable } from "@workspace/db";
import { and, eq, gt, sql } from "drizzle-orm";
import {
  clearSession,
  getSessionId,
  createSession,
  SESSION_COOKIE,
  SESSION_TTL,
  type SessionData,
} from "../lib/auth";
import { buildAppUser, displayNameFor, requireAuth } from "../lib/permissions";
import {
  hashPassword,
  verifyPassword,
  MIN_PASSWORD_LENGTH,
} from "../lib/password";
import { writeAudit } from "../lib/audit";

type UserRow = typeof usersTable.$inferSelect;

// Records a successful sign-in to the audit trail. Best-effort: a login must
// never fail because auditing failed, so errors are swallowed.
async function recordLogin(user: UserRow): Promise<void> {
  try {
    await writeAudit({
      actorId: user.id,
      actorName: displayNameFor(user),
      action: "login",
      targetType: "user",
      targetId: user.id,
      targetLabel: displayNameFor(user),
    });
  } catch {
    // Intentionally ignored — auditing is non-critical to authentication.
  }
}

const router: IRouter = Router();

// --- Login brute-force protection ------------------------------------------
// Per-instance, in-memory limiter keyed by client IP + email. Counts failed
// attempts within a rolling window and blocks once the threshold is hit;
// cleared on a successful sign-in. (Single-instance deploys only; a horizontally
// scaled deploy would need a shared store — noted in the launch checklist.)
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_FAILURES = 10;
const loginFailures = new Map<string, number[]>();

function recentFailures(key: string): number[] {
  const now = Date.now();
  const hits = (loginFailures.get(key) ?? []).filter(
    (t) => now - t < LOGIN_WINDOW_MS,
  );
  loginFailures.set(key, hits);
  return hits;
}

function isLoginBlocked(key: string): boolean {
  return recentFailures(key).length >= LOGIN_MAX_FAILURES;
}

function recordLoginFailure(key: string): void {
  const hits = recentFailures(key);
  hits.push(Date.now());
  loginFailures.set(key, hits);
}

function clearLoginFailures(key: string): void {
  loginFailures.delete(key);
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function toAuthUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    profileImageUrl: row.profileImageUrl,
  };
}

const AVATAR_PALETTE = [
  "#0EA5E9", "#F59E0B", "#8B5CF6", "#10B981", "#EC4899",
  "#3B82F6", "#EF4444", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
];

function randomAvatarColor(): string {
  return AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)]!;
}

// Who is currently signed in (the real identity; null when signed out).
router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

// Email + password sign-in.
router.post("/auth/login", async (req: Request, res: Response) => {
  const parsed = LoginWithPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;

  const rateKey = `${req.ip ?? "unknown"}|${email}`;
  if (isLoginBlocked(rateKey)) {
    res.status(429).json({
      error: "Too many sign-in attempts. Please wait a few minutes and try again.",
    });
    return;
  }

  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(sql`lower(${usersTable.email})`, email));

  // Generic message: never reveal whether an account exists.
  if (!row || !verifyPassword(password, row.passwordHash)) {
    recordLoginFailure(rateKey);
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  if (row.isActive === false) {
    res.status(403).json({ error: "This account has been deactivated." });
    return;
  }

  clearLoginFailures(rateKey);
  await recordLogin(row);
  const sid = await createSession({ user: toAuthUser(row) } as SessionData);
  setSessionCookie(res, sid);
  res.json(LoginWithPasswordResponse.parse(await buildAppUser(row)));
});

// Claim a one-time invite link: the invitee sets their own name + password.
router.post("/auth/accept-invite", async (req: Request, res: Response) => {
  const parsed = AcceptInvitationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Name and password are required" });
    return;
  }
  const token = parsed.data.token;
  const name = parsed.data.name.trim();
  const password = parsed.data.password;
  if (!name) {
    res.status(400).json({ error: "Please enter your name" });
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
    return;
  }

  const [invite] = await db
    .select()
    .from(invitationsTable)
    .where(
      and(
        eq(invitationsTable.token, token),
        eq(invitationsTable.status, "pending"),
        gt(invitationsTable.expiresAt, new Date()),
      ),
    );
  if (!invite) {
    res
      .status(400)
      .json({ error: "This invite link is invalid or has expired." });
    return;
  }

  const passwordHash = hashPassword(password);
  const now = new Date();
  let userRow: UserRow | undefined;

  if (invite.targetUserId) {
    const [target] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, invite.targetUserId));
    if (target && target.passwordHash) {
      res.status(400).json({ error: "This account has already been claimed." });
      return;
    }
    if (target) {
      [userRow] = await db
        .update(usersTable)
        .set({
          displayName: name,
          role: invite.role,
          isActive: true,
          passwordHash,
          passwordSetAt: now,
          updatedAt: now,
        })
        .where(eq(usersTable.id, target.id))
        .returning();
    }
  }

  // New-member invite (no explicit target): if a placeholder already exists for
  // this email, claim it instead of minting a parallel record. This keeps an
  // onboarding member's login on the same record that already holds their work,
  // preventing the split-identity bug at the source.
  if (!userRow && invite.newMemberEmail) {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(sql`lower(${usersTable.email})`, invite.newMemberEmail.toLowerCase()));
    if (existing && existing.passwordHash) {
      res.status(400).json({ error: "This account has already been claimed." });
      return;
    }
    if (existing) {
      [userRow] = await db
        .update(usersTable)
        .set({
          displayName: name,
          role: invite.role,
          isActive: true,
          passwordHash,
          passwordSetAt: now,
          updatedAt: now,
        })
        .where(eq(usersTable.id, existing.id))
        .returning();
    }
  }

  if (!userRow) {
    [userRow] = await db
      .insert(usersTable)
      .values({
        displayName: name,
        email: invite.newMemberEmail ?? null,
        role: invite.role,
        avatarColor: randomAvatarColor(),
        passwordHash,
        passwordSetAt: now,
      })
      .returning();
  }

  await db
    .update(invitationsTable)
    .set({
      status: "accepted",
      acceptedByUserId: userRow!.id,
      acceptedAt: now,
    })
    .where(eq(invitationsTable.id, invite.id));

  await recordLogin(userRow!);
  const sid = await createSession({ user: toAuthUser(userRow!) } as SessionData);
  setSessionCookie(res, sid);
  res.json(AcceptInvitationResponse.parse(await buildAppUser(userRow!)));
});

// Any signed-in user can change their own password.
router.post(
  "/auth/change-password",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = ChangeMyPasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const { currentPassword, newPassword } = parsed.data;
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
      return;
    }

    // Operate on the REAL signed-in user, never an impersonated identity.
    const realId = req.user!.id;
    const [row] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, realId));
    if (!row) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!verifyPassword(currentPassword, row.passwordHash)) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }

    await db
      .update(usersTable)
      .set({ passwordHash: hashPassword(newPassword), passwordSetAt: new Date() })
      .where(eq(usersTable.id, realId));

    await writeAudit({
      actorId: row.id,
      actorName: displayNameFor(row),
      action: "user.password_changed",
      targetType: "user",
      targetId: row.id,
      targetLabel: displayNameFor(row),
    });

    res.json(ChangeMyPasswordResponse.parse({ success: true }));
  },
);

router.post("/auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json(LogoutResponse.parse({ success: true }));
});

export default router;
