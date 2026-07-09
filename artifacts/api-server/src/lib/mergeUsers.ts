import {
  db,
  usersTable,
  tasksTable,
  taskAttachmentsTable,
  groupsTable,
  groupMembersTable,
  metricEntriesTable,
  kpiAuditEntriesTable,
  weekLockOverridesTable,
  focusAreaTargetsTable,
  projectsTable,
  invitationsTable,
  auditLogTable,
  accessRequestsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";

type UserRow = typeof usersTable.$inferSelect;

export interface MergeResult {
  survivor: UserRow;
  retired: UserRow;
  // How many rows were repointed, keyed by "table.column".
  movedReferences: Record<string, number>;
  totalMoved: number;
}

/**
 * Fold the `sourceId` account into the `targetId` account: every user-id
 * reference anywhere in the schema is repointed from source -> target, then the
 * source row is retired (deactivated, and its unique email/authSubject/password
 * cleared so it can never be logged into and never collides with the survivor).
 *
 * The survivor inherits the source's login (passwordHash/passwordSetAt), email,
 * and profile image when it lacks its own, so the direction of a merge never
 * leaves the surviving identity unable to sign in.
 *
 * Runs in a single transaction so a partial merge can never strand references.
 * Returns per-column move counts for auditing.
 */
export async function mergeUsers(
  targetId: string,
  sourceId: string,
): Promise<MergeResult> {
  return db.transaction(async (tx) => {
    const moved: Record<string, number> = {};

    // Plain repoint of a single column: UPDATE <table> SET col = target WHERE col = source.
    async function repoint(
      label: string,
      run: () => Promise<{ rowCount?: number | null }>,
    ) {
      const res = await run();
      const n = res.rowCount ?? 0;
      if (n > 0) moved[label] = n;
    }

    // --- Tasks: every user-id column ---
    await repoint("tasks.assignee_id", () =>
      tx
        .update(tasksTable)
        .set({ assigneeId: targetId })
        .where(eq(tasksTable.assigneeId, sourceId)),
    );
    await repoint("tasks.blocked_by_id", () =>
      tx
        .update(tasksTable)
        .set({ blockedById: targetId })
        .where(eq(tasksTable.blockedById, sourceId)),
    );
    await repoint("tasks.escalated_to_id", () =>
      tx
        .update(tasksTable)
        .set({ escalatedToId: targetId })
        .where(eq(tasksTable.escalatedToId, sourceId)),
    );
    await repoint("tasks.escalated_by_id", () =>
      tx
        .update(tasksTable)
        .set({ escalatedById: targetId })
        .where(eq(tasksTable.escalatedById, sourceId)),
    );
    await repoint("tasks.escalation_original_assignee_id", () =>
      tx
        .update(tasksTable)
        .set({ escalationOriginalAssigneeId: targetId })
        .where(eq(tasksTable.escalationOriginalAssigneeId, sourceId)),
    );
    await repoint("tasks.escalation_resolved_by_id", () =>
      tx
        .update(tasksTable)
        .set({ escalationResolvedById: targetId })
        .where(eq(tasksTable.escalationResolvedById, sourceId)),
    );

    // --- Task attachments ---
    await repoint("task_attachments.added_by_id", () =>
      tx
        .update(taskAttachmentsTable)
        .set({ addedById: targetId })
        .where(eq(taskAttachmentsTable.addedById, sourceId)),
    );

    // --- Groups ---
    await repoint("groups.created_by_id", () =>
      tx
        .update(groupsTable)
        .set({ createdById: targetId })
        .where(eq(groupsTable.createdById, sourceId)),
    );

    // --- Group members (dedupe: drop source rows for groups the target is
    // already in, then repoint the rest so no duplicate membership is created) ---
    await tx.execute(sql`
      DELETE FROM group_members gm
      WHERE gm.user_id = ${sourceId}
        AND EXISTS (
          SELECT 1 FROM group_members t
          WHERE t.user_id = ${targetId} AND t.group_id = gm.group_id
        )
    `);
    await repoint("group_members.user_id", () =>
      tx
        .update(groupMembersTable)
        .set({ userId: targetId })
        .where(eq(groupMembersTable.userId, sourceId)),
    );

    // --- Metric entries (dedupe on metric+period the target already has) ---
    await tx.execute(sql`
      DELETE FROM metric_entries me
      WHERE me.user_id = ${sourceId}
        AND EXISTS (
          SELECT 1 FROM metric_entries t
          WHERE t.user_id = ${targetId}
            AND t.metric_id = me.metric_id
            AND t.period_start = me.period_start
        )
    `);
    await repoint("metric_entries.user_id", () =>
      tx
        .update(metricEntriesTable)
        .set({ userId: targetId })
        .where(eq(metricEntriesTable.userId, sourceId)),
    );

    // --- KPI audit entries (append-only; duplicates are acceptable) ---
    await repoint("kpi_audit_entries.user_id", () =>
      tx
        .update(kpiAuditEntriesTable)
        .set({ userId: targetId })
        .where(eq(kpiAuditEntriesTable.userId, sourceId)),
    );
    await repoint("kpi_audit_entries.changed_by_id", () =>
      tx
        .update(kpiAuditEntriesTable)
        .set({ changedById: targetId })
        .where(eq(kpiAuditEntriesTable.changedById, sourceId)),
    );

    // --- Week lock overrides ---
    await repoint("week_lock_overrides.unlocked_by_id", () =>
      tx
        .update(weekLockOverridesTable)
        .set({ unlockedById: targetId })
        .where(eq(weekLockOverridesTable.unlockedById, sourceId)),
    );

    // --- Focus area targets ---
    await repoint("focus_area_targets.updated_by_id", () =>
      tx
        .update(focusAreaTargetsTable)
        .set({ updatedById: targetId })
        .where(eq(focusAreaTargetsTable.updatedById, sourceId)),
    );

    // --- Projects ---
    await repoint("projects.executive_owner_id", () =>
      tx
        .update(projectsTable)
        .set({ executiveOwnerId: targetId })
        .where(eq(projectsTable.executiveOwnerId, sourceId)),
    );

    // --- Invitations ---
    await repoint("invitations.target_user_id", () =>
      tx
        .update(invitationsTable)
        .set({ targetUserId: targetId })
        .where(eq(invitationsTable.targetUserId, sourceId)),
    );
    await repoint("invitations.created_by_id", () =>
      tx
        .update(invitationsTable)
        .set({ createdById: targetId })
        .where(eq(invitationsTable.createdById, sourceId)),
    );
    await repoint("invitations.accepted_by_user_id", () =>
      tx
        .update(invitationsTable)
        .set({ acceptedByUserId: targetId })
        .where(eq(invitationsTable.acceptedByUserId, sourceId)),
    );

    // --- Audit log ---
    await repoint("audit_log.actor_id", () =>
      tx
        .update(auditLogTable)
        .set({ actorId: targetId })
        .where(eq(auditLogTable.actorId, sourceId)),
    );

    // --- Access requests ---
    await repoint("access_requests.requester_user_id", () =>
      tx
        .update(accessRequestsTable)
        .set({ requesterUserId: targetId })
        .where(eq(accessRequestsTable.requesterUserId, sourceId)),
    );
    await repoint("access_requests.decided_by_id", () =>
      tx
        .update(accessRequestsTable)
        .set({ decidedById: targetId })
        .where(eq(accessRequestsTable.decidedById, sourceId)),
    );

    // --- Reconcile the two account rows ---
    const [source] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, sourceId));
    const [target] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, targetId));
    if (!source || !target) {
      throw new Error("Both accounts must exist to merge");
    }

    // Retire the source FIRST so its unique email/authSubject are freed before
    // we (optionally) move them onto the survivor.
    const [retired] = await tx
      .update(usersTable)
      .set({
        isActive: false,
        email: null,
        authSubject: null,
        passwordHash: null,
        passwordSetAt: null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, sourceId))
      .returning();

    // The survivor inherits anything it is missing so it stays loginable.
    const survivorPatch: Partial<typeof usersTable.$inferInsert> = {};
    if (!target.passwordHash && source.passwordHash) {
      survivorPatch.passwordHash = source.passwordHash;
      survivorPatch.passwordSetAt = source.passwordSetAt ?? new Date();
    }
    if (!target.email && source.email) survivorPatch.email = source.email;
    if (!target.authSubject && source.authSubject)
      survivorPatch.authSubject = source.authSubject;
    if (!target.profileImageUrl && source.profileImageUrl)
      survivorPatch.profileImageUrl = source.profileImageUrl;
    survivorPatch.isActive = true;

    const [survivor] = await tx
      .update(usersTable)
      .set({ ...survivorPatch, updatedAt: new Date() })
      .where(eq(usersTable.id, targetId))
      .returning();

    const totalMoved = Object.values(moved).reduce((a, b) => a + b, 0);
    return {
      survivor: survivor!,
      retired: retired!,
      movedReferences: moved,
      totalMoved,
    };
  });
}
