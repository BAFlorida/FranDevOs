import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  db,
  usersTable,
  focusAreasTable,
  projectsTable,
  tasksTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

import { loadTeamBlockedTasks } from "./blockedTasks";

/**
 * End-to-end test of the team-wide blocked-tasks query against a live database.
 * It seeds tasks covering every escalation state and asserts the contract: the
 * list shows all currently-Blocked tasks EXCEPT those with an active, unresolved
 * escalation — including the tricky case of a task that was escalated, resolved,
 * and later re-blocked (which must still appear, since resolving never clears
 * `escalatedAt`).
 */
describe("loadTeamBlockedTasks", () => {
  let assigneeId: string;
  let focusAreaId: number;
  const projectId = `bt_proj_${Math.random().toString(36).slice(2, 10)}`;

  let neverEscalatedId: number;
  let escalatedThenResolvedId: number;
  let activeEscalationId: number;
  let notBlockedId: number;

  before(async () => {
    const [assignee] = await db
      .insert(usersTable)
      .values({ displayName: "Blocked Test Assignee", isActive: true })
      .returning();
    assigneeId = assignee!.id;

    const [focusArea] = await db
      .insert(focusAreasTable)
      .values({ name: `Blocked Test Focus ${Date.now()}`, sortOrder: 9999 })
      .returning();
    focusAreaId = focusArea!.id;
    await db.insert(projectsTable).values({
      id: projectId,
      name: "Blocked Test Project",
      focusAreaId,
    });

    const rows = await db
      .insert(tasksTable)
      .values([
        {
          projectId,
          assigneeId,
          description: "Blocked, never escalated",
          status: "Blocked",
        },
        {
          projectId,
          assigneeId,
          description: "Blocked again after a past escalation was resolved",
          status: "Blocked",
          // Escalated in the past, then resolved — resolve never clears
          // escalatedAt, so this row must still surface as currently blocked.
          escalatedAt: new Date("2099-01-01T00:00:00Z"),
          escalationResolvedAt: new Date("2099-01-02T00:00:00Z"),
        },
        {
          projectId,
          assigneeId,
          description: "Blocked with an active escalation",
          status: "Blocked",
          // Active escalation (set, not resolved) — belongs in the escalation
          // queue, so it must be EXCLUDED here.
          escalatedAt: new Date("2099-01-03T00:00:00Z"),
        },
        {
          projectId,
          assigneeId,
          description: "Not blocked",
          status: "In Progress",
        },
      ])
      .returning();
    neverEscalatedId = rows[0]!.id;
    escalatedThenResolvedId = rows[1]!.id;
    activeEscalationId = rows[2]!.id;
    notBlockedId = rows[3]!.id;
  });

  after(async () => {
    await db.delete(tasksTable).where(eq(tasksTable.projectId, projectId));
    await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
    if (focusAreaId) await db.delete(focusAreasTable).where(eq(focusAreasTable.id, focusAreaId));
    if (assigneeId) await db.delete(usersTable).where(inArray(usersTable.id, [assigneeId]));
  });

  it("includes currently-blocked tasks that were never escalated", async () => {
    const ids = (await loadTeamBlockedTasks()).map((t) => t.id);
    assert.ok(ids.includes(neverEscalatedId), "a plainly-blocked task should appear");
  });

  it("includes a re-blocked task whose past escalation was resolved", async () => {
    const ids = (await loadTeamBlockedTasks()).map((t) => t.id);
    assert.ok(
      ids.includes(escalatedThenResolvedId),
      "resolving an escalation must not permanently hide a task that is blocked again",
    );
  });

  it("excludes tasks with an active, unresolved escalation", async () => {
    const ids = (await loadTeamBlockedTasks()).map((t) => t.id);
    assert.ok(
      !ids.includes(activeEscalationId),
      "an actively-escalated task belongs to the escalation queue, not this list",
    );
  });

  it("excludes tasks that are not in Blocked status", async () => {
    const ids = (await loadTeamBlockedTasks()).map((t) => t.id);
    assert.ok(!ids.includes(notBlockedId), "a non-blocked task should never appear");
  });
});
