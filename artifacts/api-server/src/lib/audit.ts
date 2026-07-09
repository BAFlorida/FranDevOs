import { db, auditLogTable } from "@workspace/db";
import type { AppUserCtx } from "./permissions";

export interface AuditInput {
  // Either pass an explicit actorId/actorName, OR pass `actor` (the
  // request-scoped AppUserCtx) and let writeAudit resolve the real actor —
  // crucial during impersonation, where accountability stays with the super
  // admin, not the impersonated user.
  actorId?: string | null;
  actorName?: string | null;
  actor?: AppUserCtx;
  action: string;
  targetType?: string | null;
  targetId?: string | number | null;
  targetLabel?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Resolve the audit actor for a request-scoped user. When a super admin is
 * impersonating ("acting as") another user, accountability for any mutation
 * must remain with the REAL super admin, not the impersonated user. Returns the
 * real actor's id/name plus an `actingAs` descriptor (null when not
 * impersonating) so the impersonated identity is still traceable in metadata.
 */
export function auditActor(user: AppUserCtx | undefined): {
  actorId: string | null;
  actorName: string | null;
  actingAs: { id: string; name: string } | null;
} {
  if (!user) return { actorId: null, actorName: null, actingAs: null };
  if (user.impersonating && user.realUser) {
    return {
      actorId: user.realUser.id,
      actorName: user.realUser.name,
      actingAs: { id: user.id, name: user.name },
    };
  }
  return { actorId: user.id, actorName: user.name, actingAs: null };
}

// Append a row to the access-change audit trail. Best-effort: auditing must
// never break the underlying mutation, so failures are swallowed (and logged by
// the caller's logger when available).
export async function writeAudit(input: AuditInput): Promise<void> {
  let actorId = input.actorId ?? null;
  let actorName = input.actorName ?? null;
  let after = input.after ?? null;

  if (input.actor) {
    const resolved = auditActor(input.actor);
    actorId = resolved.actorId;
    actorName = resolved.actorName;
    // When the real super admin acted while impersonating, record who they were
    // acting as so the trail keeps both identities.
    if (resolved.actingAs) {
      const base =
        after && typeof after === "object" && !Array.isArray(after)
          ? (after as Record<string, unknown>)
          : after != null
            ? { value: after }
            : {};
      after = { ...base, actingAs: resolved.actingAs };
    }
  }

  await db.insert(auditLogTable).values({
    actorId,
    actorName,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId != null ? String(input.targetId) : null,
    targetLabel: input.targetLabel ?? null,
    before: (input.before ?? null) as Record<string, unknown> | null,
    after: (after ?? null) as Record<string, unknown> | null,
  });
}
