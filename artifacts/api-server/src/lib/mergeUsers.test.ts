import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  db,
  usersTable,
  focusAreasTable,
  projectsTable,
  tasksTable,
  groupsTable,
  groupMembersTable,
  recurringMetricsTable,
  metricEntriesTable,
} from "@workspace/db";
import { eq, inArray, and } from "drizzle-orm";

import { mergeUsers } from "./mergeUsers";

/**
 * End-to-end test of the merge-member action against a live database. It seeds a
 * realistic "split identity" scenario (a duplicate `source` + a surviving
 * `target`), runs `mergeUsers`, and asserts the contract the merge promises:
 * every user-id reference is repointed onto the survivor, the survivor stays
 * loginable, the duplicate is retired, and group/metric memberships dedupe
 * instead of doubling up.
 *
 * The seeded rows are committed (mergeUsers opens its own transaction on the
 * shared pool and cannot see an uncommitted outer transaction), so everything is
 * torn down in `after()` — even if an assertion fails — to keep the DB clean.
 */
describe("mergeUsers", () => {
  // Captured ids for assertions + teardown.
  let sourceId: string;
  let targetId: string;
  let focusAreaId: number;
  let metricId: number;
  let sharedGroupId: number;
  let sourceOnlyGroupId: number;
  const projectId = `mt_proj_${Math.random().toString(36).slice(2, 10)}`;
  // A period the survivor and duplicate both have an entry for (dedupe case).
  const overlapPeriod = "2099-01-05";
  // A period only the duplicate has (must move to the survivor).
  const sourceOnlyPeriod = "2099-01-12";

  let result: Awaited<ReturnType<typeof mergeUsers>>;

  before(async () => {
    // --- Two accounts for the same person ---
    // The duplicate ("source") is the one carrying the real login; the survivor
    // ("target") has none yet, so we can prove the survivor inherits it.
    const [source] = await db
      .insert(usersTable)
      .values({
        displayName: "Merge Test Duplicate",
        email: `merge-test-dup-${Date.now()}@example.test`,
        passwordHash: "scrypt$fake$hash",
        passwordSetAt: new Date(),
        authSubject: `merge-test-subject-${Date.now()}`,
        profileImageUrl: "https://example.test/avatar.png",
        isActive: true,
      })
      .returning();
    const [target] = await db
      .insert(usersTable)
      .values({
        displayName: "Merge Test Survivor",
        email: null,
        passwordHash: null,
        isActive: true,
      })
      .returning();
    sourceId = source!.id;
    targetId = target!.id;

    // --- A project (tasks need one), via a focus area ---
    const [focusArea] = await db
      .insert(focusAreasTable)
      .values({ name: `Merge Test Focus ${Date.now()}`, sortOrder: 9999 })
      .returning();
    focusAreaId = focusArea!.id;
    await db.insert(projectsTable).values({
      id: projectId,
      name: "Merge Test Project",
      focusAreaId,
    });

    // --- Tasks: one already on the survivor, one on the duplicate, plus a
    // task that references the duplicate through a non-assignee column ---
    await db.insert(tasksTable).values([
      { projectId, assigneeId: targetId, description: "Survivor's own task" },
      { projectId, assigneeId: sourceId, description: "Duplicate's task" },
      {
        projectId,
        assigneeId: targetId,
        description: "Blocked by the duplicate",
        blockedById: sourceId,
      },
    ]);

    // --- Groups: one shared (dedupe), one only the duplicate is in (move) ---
    const [sharedGroup] = await db
      .insert(groupsTable)
      .values({ name: `Merge Test Shared ${Date.now()}` })
      .returning();
    const [sourceOnlyGroup] = await db
      .insert(groupsTable)
      .values({ name: `Merge Test SourceOnly ${Date.now()}` })
      .returning();
    sharedGroupId = sharedGroup!.id;
    sourceOnlyGroupId = sourceOnlyGroup!.id;
    await db.insert(groupMembersTable).values([
      { groupId: sharedGroupId, userId: targetId },
      { groupId: sharedGroupId, userId: sourceId },
      { groupId: sourceOnlyGroupId, userId: sourceId },
    ]);

    // --- Metric entries: an overlapping period (dedupe) + a duplicate-only
    // period (move) ---
    const [metric] = await db
      .insert(recurringMetricsTable)
      .values({ name: `Merge Test Metric ${Date.now()}` })
      .returning();
    metricId = metric!.id;
    await db.insert(metricEntriesTable).values([
      { metricId, userId: targetId, periodStart: overlapPeriod, count: 3 },
      { metricId, userId: sourceId, periodStart: overlapPeriod, count: 7 },
      { metricId, userId: sourceId, periodStart: sourceOnlyPeriod, count: 5 },
    ]);

    result = await mergeUsers(targetId, sourceId);
  });

  after(async () => {
    // Teardown in FK-safe order. Wrapped per-table so one failure still cleans
    // up the rest. Both account ids are deleted regardless of merge outcome.
    const ids = [sourceId, targetId].filter(Boolean);
    if (metricId) await db.delete(metricEntriesTable).where(eq(metricEntriesTable.metricId, metricId));
    if (sharedGroupId || sourceOnlyGroupId) {
      await db
        .delete(groupMembersTable)
        .where(inArray(groupMembersTable.groupId, [sharedGroupId, sourceOnlyGroupId].filter(Boolean)));
    }
    await db.delete(tasksTable).where(eq(tasksTable.projectId, projectId));
    if (sharedGroupId || sourceOnlyGroupId) {
      await db
        .delete(groupsTable)
        .where(inArray(groupsTable.id, [sharedGroupId, sourceOnlyGroupId].filter(Boolean)));
    }
    if (metricId) await db.delete(recurringMetricsTable).where(eq(recurringMetricsTable.id, metricId));
    await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
    if (focusAreaId) await db.delete(focusAreasTable).where(eq(focusAreasTable.id, focusAreaId));
    if (ids.length) await db.delete(usersTable).where(inArray(usersTable.id, ids));
  });

  it("repoints every user-id reference from the duplicate onto the survivor", async () => {
    // Tasks: nothing should still point at the duplicate; the survivor now owns
    // every task and the blocked-by reference.
    const sourceTasks = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.projectId, projectId), eq(tasksTable.assigneeId, sourceId)));
    assert.equal(sourceTasks.length, 0, "no task should still be assigned to the duplicate");

    const survivorTasks = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.projectId, projectId), eq(tasksTable.assigneeId, targetId)));
    assert.equal(survivorTasks.length, 3, "all three tasks should now belong to the survivor");

    const stillBlockedBySource = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.blockedById, sourceId));
    assert.equal(stillBlockedBySource.length, 0, "blocked-by reference should have moved");

    // The move was reported for auditing.
    assert.equal(result.movedReferences["tasks.assignee_id"], 1);
    assert.equal(result.movedReferences["tasks.blocked_by_id"], 1);
    assert.ok(result.totalMoved > 0);
  });

  it("keeps the survivor loginable by inheriting the duplicate's login", async () => {
    assert.ok(result.survivor.passwordHash, "survivor should inherit a password hash");
    assert.ok(result.survivor.email, "survivor should inherit the email");
    assert.equal(result.survivor.isActive, true, "survivor stays active");
    assert.equal(result.survivor.id, targetId);
  });

  it("retires the duplicate so it can never log in or collide", async () => {
    const [retired] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, sourceId));
    assert.ok(retired, "the duplicate row still exists");
    assert.equal(retired!.isActive, false);
    assert.equal(retired!.email, null);
    assert.equal(retired!.authSubject, null);
    assert.equal(retired!.passwordHash, null);
    assert.equal(retired!.passwordSetAt, null);
  });

  it("dedupes group membership instead of duplicating it", async () => {
    const sharedMemberships = await db
      .select()
      .from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, sharedGroupId), eq(groupMembersTable.userId, targetId)));
    assert.equal(sharedMemberships.length, 1, "shared group should have exactly one survivor row");

    const sourceStillMember = await db
      .select()
      .from(groupMembersTable)
      .where(eq(groupMembersTable.userId, sourceId));
    assert.equal(sourceStillMember.length, 0, "duplicate should no longer be in any group");

    // The duplicate-only group membership moved to the survivor.
    const movedMembership = await db
      .select()
      .from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, sourceOnlyGroupId), eq(groupMembersTable.userId, targetId)));
    assert.equal(movedMembership.length, 1, "duplicate-only group should now have the survivor");
  });

  it("dedupes metric entries on a clashing period and moves the rest", async () => {
    const overlap = await db
      .select()
      .from(metricEntriesTable)
      .where(
        and(
          eq(metricEntriesTable.metricId, metricId),
          eq(metricEntriesTable.userId, targetId),
          eq(metricEntriesTable.periodStart, overlapPeriod),
        ),
      );
    assert.equal(overlap.length, 1, "overlapping period should not duplicate");
    assert.equal(overlap[0]!.count, 3, "the survivor's own entry is the one kept");

    const moved = await db
      .select()
      .from(metricEntriesTable)
      .where(
        and(
          eq(metricEntriesTable.metricId, metricId),
          eq(metricEntriesTable.userId, targetId),
          eq(metricEntriesTable.periodStart, sourceOnlyPeriod),
        ),
      );
    assert.equal(moved.length, 1, "the non-clashing entry moved to the survivor");

    const sourceEntries = await db
      .select()
      .from(metricEntriesTable)
      .where(eq(metricEntriesTable.userId, sourceId));
    assert.equal(sourceEntries.length, 0, "no metric entry should reference the duplicate");
  });

  it("rejects a merge when an account does not exist", async () => {
    await assert.rejects(
      () => mergeUsers(targetId, "00000000-0000-0000-0000-000000000000"),
      /Both accounts must exist to merge/,
    );
  });
});
