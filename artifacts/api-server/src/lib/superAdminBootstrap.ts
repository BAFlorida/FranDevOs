import crypto from "crypto";
import { db, usersTable, invitationsTable } from "@workspace/db";
import { and, eq, gt, sql } from "drizzle-orm";
import { logger } from "./logger";
import { sendEmail, inviteUrl, renderSuperAdminSetupEmail } from "./email";

// The first super admin (the app owner). Configurable via env so it isn't
// hardcoded to one person; defaults preserve the original owner. Their password
// is NEVER hardcoded — they set it via a one-time invite link that is emailed
// (when email is configured) and always printed to the server log on first boot.
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? "Ryan@myfieldspec.com";
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME ?? "Ryan Maynard";

/**
 * Idempotently ensure the first super admin exists. On a database where they
 * have no password yet and no live invite, mint a one-time invite link and log
 * it so they can set their own name + password. Safe to run on every boot.
 */
export async function ensureSuperAdmin(): Promise<void> {
  const emailLower = SUPER_ADMIN_EMAIL.toLowerCase();

  let [user] = await db
    .select()
    .from(usersTable)
    .where(eq(sql`lower(${usersTable.email})`, emailLower));

  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({
        email: SUPER_ADMIN_EMAIL,
        displayName: SUPER_ADMIN_NAME,
        role: "super_admin",
        avatarColor: "#6366F1",
      })
      .returning();
    logger.info({ email: SUPER_ADMIN_EMAIL }, "Created first super admin user");
  } else if (user.role !== "super_admin") {
    [user] = await db
      .update(usersTable)
      .set({ role: "super_admin", isActive: true })
      .where(eq(usersTable.id, user.id))
      .returning();
    logger.info({ email: SUPER_ADMIN_EMAIL }, "Promoted user to super admin");
  }

  if (user!.passwordHash) return;

  const [pending] = await db
    .select()
    .from(invitationsTable)
    .where(
      and(
        eq(invitationsTable.targetUserId, user!.id),
        eq(invitationsTable.status, "pending"),
        gt(invitationsTable.expiresAt, new Date()),
      ),
    );

  if (pending) {
    await announceSetupLink(pending.token);
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(invitationsTable).values({
    token,
    targetUserId: user!.id,
    role: "super_admin",
    status: "pending",
    createdById: null,
  });
  await announceSetupLink(token);
}

// Email the owner their one-time setup link (when email is configured) and
// always log it, so the owner can get in even if email isn't set up yet.
async function announceSetupLink(token: string): Promise<void> {
  const url = inviteUrl(token);
  const { subject, html, text } = renderSuperAdminSetupEmail({ url });
  const { sent } = await sendEmail({ to: SUPER_ADMIN_EMAIL, subject, html, text });
  logger.info(
    { inviteUrl: `/invite/${token}`, emailed: sent, to: SUPER_ADMIN_EMAIL },
    "Super admin one-time setup invite link — open to set your password",
  );
}
