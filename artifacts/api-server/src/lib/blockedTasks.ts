import { db, tasksTable } from "@workspace/db";
import { and, eq, isNull, isNotNull, or } from "drizzle-orm";
import {
  loadUserLookup,
  loadProjectLookup,
  loadAttachmentsByTask,
  serializeTask,
} from "./enrich";

/**
 * Every open task currently in Blocked status across the team, EXCLUDING any
 * task with an active (unresolved) escalation — those already surface in the
 * escalation queue, so the two lists never duplicate a card.
 *
 * "Active escalation" is `escalatedAt IS NOT NULL AND escalationResolvedAt IS
 * NULL`. We must NOT exclude on `escalatedAt` alone: resolving an escalation
 * only stamps `escalationResolvedAt` and never clears `escalatedAt`, so a task
 * that was escalated, resolved, and later re-blocked would otherwise vanish
 * from this list. We therefore keep a row when it has no escalation at all OR
 * its last escalation has already been resolved.
 *
 * Results are sorted oldest-updated first so the longest-stuck work surfaces at
 * the top.
 */
export async function loadTeamBlockedTasks() {
  const rows = await db
    .select()
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.status, "Blocked"),
        or(
          isNull(tasksTable.escalatedAt),
          isNotNull(tasksTable.escalationResolvedAt),
        ),
      ),
    );
  const users = await loadUserLookup();
  const projects = await loadProjectLookup();
  const attsByTask = await loadAttachmentsByTask(rows.map((r) => r.id));
  return rows
    .map((t) => serializeTask(t, users, projects, attsByTask.get(t.id) ?? []))
    .sort((a, b) => {
      const ua = a.updatedAt ? String(a.updatedAt) : "";
      const ub = b.updatedAt ? String(b.updatedAt) : "";
      return ua.localeCompare(ub);
    });
}
