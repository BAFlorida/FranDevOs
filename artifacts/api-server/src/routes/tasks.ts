import { Router, type IRouter, type Request, type Response } from "express";
import { db, tasksTable, groupsTable, groupMembersTable, taskAttachmentsTable, usersTable, projectsTable } from "@workspace/db";
import { eq, and, or, inArray, isNull, type SQL } from "drizzle-orm";
import {
  ListTasksResponse,
  ListTasksQueryParams,
  CreateTaskBody,
  GetTaskResponse,
  UpdateTaskBody,
  UpdateTaskResponse,
  EscalateRoadblockBody,
  EscalateRoadblockResponse,
  ListEscalationsResponse,
  ListBlockedTasksResponse,
  ResolveEscalationBody,
  ResolveEscalationResponse,
} from "@workspace/api-zod";
import {
  requireAuth,
  requirePermission,
  hasPermission,
  roleHasPermission,
  ESCALATION_MANAGER_PERMISSION,
} from "../lib/permissions";
import type { Role } from "../lib/permissions";
import { loadUserLookup, loadProjectLookup, serializeTask, loadAttachmentsByTask } from "../lib/enrich";
import { loadTeamBlockedTasks } from "../lib/blockedTasks";

const router: IRouter = Router();

function toDateString(d: unknown): string | null {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return null;
}

async function recomputeParentRollup(parentId: number) {
  const children = await db.select().from(tasksTable).where(eq(tasksTable.parentTaskId, parentId));
  if (children.length === 0) return;
  const avg = Math.round(children.reduce((acc, c) => acc + (c.percentComplete ?? 0), 0) / children.length);
  const allComplete = children.every((c) => c.status === "Complete");
  const anyBlocked = children.some((c) => c.status === "Blocked");
  const anyInProgress = children.some(
    (c) =>
      c.status === "In Progress" ||
      c.status === "Waiting on Someone" ||
      c.status === "Pending Review",
  );
  let status: string;
  if (allComplete) status = "Complete";
  else if (anyBlocked) status = "Blocked";
  else if (anyInProgress) status = "In Progress";
  else status = "Not Started";
  await db
    .update(tasksTable)
    .set({ percentComplete: avg, status })
    .where(eq(tasksTable.id, parentId));
}

/**
 * Resolve the higher-up an escalation should route to. Walks from the task's
 * tactic/initiative to its executive owner. Falls back to an active admin (then
 * vp) when the owner is unresolvable. The raiser is never chosen as their own
 * target — escalation only flows upward, never sideways.
 */
async function resolveEscalationTarget(
  projectId: string,
  raiserId: string,
): Promise<string | null> {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));
  const ownerId = project?.executiveOwnerId ?? null;
  if (ownerId && ownerId !== raiserId) {
    const [owner] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, ownerId));
    // Only route to the exec owner if they are an actual higher-up (active +
    // hold the managerial permission). This prevents an escalation from ever
    // landing sideways on a peer if a project was misconfigured with a
    // non-manager owner — in that case we fall through to admin/vp below.
    if (
      owner &&
      owner.isActive !== false &&
      (await roleHasPermission(
        owner.role as Role,
        ESCALATION_MANAGER_PERMISSION,
      ))
    ) {
      return ownerId;
    }
  }
  // Fallback: first active admin, then vp (deterministic by id).
  const candidates = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.role, ["admin", "vp"]));
  const ranked = candidates
    .filter((u) => u.isActive !== false && u.id !== raiserId)
    .sort((a, b) => {
      const ra = a.role === "admin" ? 0 : 1;
      const rb = b.role === "admin" ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return a.id.localeCompare(b.id);
    });
  return ranked[0]?.id ?? null;
}

router.get("/tasks", requireAuth, async (req: Request, res: Response) => {
  const parsed = ListTasksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const me = req.appUser!;
  const filters = [] as SQL[];
  // Personal scope: members are always restricted to their own work, and any
  // user can opt in with `mine=true`. In both cases the personal list also
  // surfaces tasks the user is recorded as blocking (status Blocked +
  // blockedById === me.id) so they can't miss that someone is waiting on them,
  // regardless of whether they are also the assignee.
  const restrictToMine = me.role === "member" || parsed.data.mine === true;
  if (restrictToMine) {
    filters.push(
      or(
        eq(tasksTable.assigneeId, me.id),
        and(eq(tasksTable.blockedById, me.id), eq(tasksTable.status, "Blocked")),
      )!,
    );
  } else if (parsed.data.assigneeId) {
    filters.push(eq(tasksTable.assigneeId, parsed.data.assigneeId));
  }
  if (parsed.data.projectId)
    filters.push(eq(tasksTable.projectId, parsed.data.projectId));
  if (parsed.data.status)
    filters.push(eq(tasksTable.status, parsed.data.status));

  const rows =
    filters.length > 0
      ? await db.select().from(tasksTable).where(and(...filters))
      : await db.select().from(tasksTable);

  const users = await loadUserLookup();
  const projects = await loadProjectLookup();
  const attsByTask = await loadAttachmentsByTask(rows.map((r) => r.id));
  const data = rows
    .map((t) => serializeTask(t, users, projects, attsByTask.get(t.id) ?? [], me.id))
    .sort((a, b) => {
      const da = a.dueDate ? String(a.dueDate) : "9999";
      const db = b.dueDate ? String(b.dueDate) : "9999";
      return da.localeCompare(db);
    });
  res.json(ListTasksResponse.parse(data));
});

// Bulk-assign via group — creates parent + per-member children
router.post(
  "/tasks/bulk-assign",
  requireAuth,
  requirePermission("assign_tasks"),
  async (req: Request, res: Response) => {
    const {
      groupId,
      projectId,
      description,
      role,
      priority,
      status,
      percentComplete,
      dueDate,
      startDate,
      nextStep,
      attachments,
    } = req.body ?? {};
    if (typeof groupId !== "number" || typeof projectId !== "string" || typeof description !== "string") {
      res.status(400).json({ error: "groupId, projectId, description required" });
      return;
    }
    // Normalize optional deliverable links — copied onto every task.
    const normalizedAttachments: { label: string; url: string }[] = [];
    if (attachments !== undefined) {
      if (!Array.isArray(attachments)) {
        res.status(400).json({ error: "attachments must be an array" });
        return;
      }
      for (const a of attachments) {
        const label = typeof a?.label === "string" ? a.label.trim() : "";
        let url = typeof a?.url === "string" ? a.url.trim() : "";
        if (!label || !url) {
          res.status(400).json({ error: "Each attachment needs a label and url" });
          return;
        }
        if (!/^https?:\/\//i.test(url)) {
          url = `https://${url}`;
        }
        normalizedAttachments.push({ label, url });
      }
    }
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId));
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    const members = await db
      .select()
      .from(groupMembersTable)
      .where(eq(groupMembersTable.groupId, groupId));
    if (members.length === 0) {
      res.status(400).json({ error: "Group has no members" });
      return;
    }
    const baseValues = {
      projectId,
      role: role ?? "Owner",
      description,
      priority: priority ?? "Medium",
      status: status ?? "Not Started",
      percentComplete: typeof percentComplete === "number" ? percentComplete : 0,
      startDate: toDateString(startDate),
      dueDate: toDateString(dueDate),
      nextStep: typeof nextStep === "string" ? nextStep : null,
      groupId,
    };
    // Parent task — assigned to creator
    const [parent] = await db
      .insert(tasksTable)
      .values({
        ...baseValues,
        assigneeId: req.appUser!.id,
        isGroupParent: true,
      })
      .returning();
    // Children — one per group member
    const childRows = await db
      .insert(tasksTable)
      .values(
        members.map((m) => ({
          ...baseValues,
          assigneeId: m.userId,
          parentTaskId: parent!.id,
        })),
      )
      .returning();
    // Copy deliverable links onto the parent rollup and every member's child task.
    if (normalizedAttachments.length > 0) {
      const allTaskIds = [parent!.id, ...childRows.map((r) => r.id)];
      await db.insert(taskAttachmentsTable).values(
        allTaskIds.flatMap((taskId) =>
          normalizedAttachments.map((a) => ({
            taskId,
            label: a.label,
            url: a.url,
            addedById: req.appUser!.id,
          })),
        ),
      );
    }
    await recomputeParentRollup(parent!.id);
    res.status(201).json({
      parentTaskId: parent!.id,
      childTaskIds: childRows.map((r) => r.id),
    });
  },
);

router.get("/tasks/:id", requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const me = req.appUser!;
  if (me.role === "member" && row.assigneeId !== me.id && row.blockedById !== me.id) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const users = await loadUserLookup();
  const projects = await loadProjectLookup();
  const attsByTask = await loadAttachmentsByTask([row.id]);
  res.json(GetTaskResponse.parse(serializeTask(row, users, projects, attsByTask.get(row.id) ?? [])));
});

router.post("/tasks", requireAuth, async (req: Request, res: Response) => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.format() });
    return;
  }
  const me = req.appUser!;
  if (me.role === "member" && parsed.data.assigneeId !== me.id) {
    res.status(403).json({ error: "Members can only create tasks for themselves" });
    return;
  }
  // Only managers may mark a task Complete outright; others go to Pending Review.
  let createStatus = parsed.data.status;
  if (createStatus === "Complete" && !hasPermission(me, "approve_completion")) {
    createStatus = "Pending Review";
  }
  const [row] = await db
    .insert(tasksTable)
    .values({
      projectId: parsed.data.projectId,
      assigneeId: parsed.data.assigneeId,
      role: parsed.data.role,
      description: parsed.data.description,
      priority: parsed.data.priority,
      status: createStatus,
      percentComplete: parsed.data.percentComplete,
      startDate: toDateString(parsed.data.startDate),
      dueDate: toDateString(parsed.data.dueDate),
      dependency: parsed.data.dependency ?? null,
      roadblock: parsed.data.roadblock ?? null,
      lastUpdate: parsed.data.lastUpdate ?? null,
      nextStep: parsed.data.nextStep ?? null,
      blockedById: parsed.data.blockedById ?? null,
      blockNotes: parsed.data.blockNotes ?? null,
      groupId: parsed.data.groupId ?? null,
      parentTaskId: parsed.data.parentTaskId ?? null,
      completedAt: createStatus === "Complete" ? new Date() : null,
    })
    .returning();
  const users = await loadUserLookup();
  const projects = await loadProjectLookup();
  res.status(201).json(GetTaskResponse.parse(serializeTask(row!, users, projects, [])));
});

router.patch("/tasks/:id", requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const me = req.appUser!;
  if (me.role === "member" && existing.assigneeId !== me.id) {
    res.status(403).json({ error: "Members can only edit their own tasks" });
    return;
  }
  if (
    me.role === "member" &&
    parsed.data.assigneeId !== undefined &&
    parsed.data.assigneeId !== me.id
  ) {
    res.status(403).json({ error: "Members cannot reassign tasks" });
    return;
  }

  // Only managers (lead/admin/vp) may mark a task Complete. When anyone else
  // tries to complete their own task, it is routed to Pending Review for a
  // manager to confirm.
  const d = parsed.data;
  if (d.status === "Complete" && !hasPermission(me, "approve_completion")) {
    d.status = "Pending Review";
  }

  const patch: Record<string, unknown> = {};
  if (d.projectId !== undefined) patch.projectId = d.projectId;
  if (d.assigneeId !== undefined) patch.assigneeId = d.assigneeId;
  if (d.role !== undefined) patch.role = d.role;
  if (d.description !== undefined) patch.description = d.description;
  if (d.priority !== undefined) patch.priority = d.priority;
  if (d.status !== undefined) patch.status = d.status;
  if (d.percentComplete !== undefined) patch.percentComplete = d.percentComplete;
  if (d.startDate !== undefined) patch.startDate = toDateString(d.startDate);
  if (d.dueDate !== undefined) patch.dueDate = toDateString(d.dueDate);
  if (d.dependency !== undefined) patch.dependency = d.dependency;
  if (d.roadblock !== undefined) patch.roadblock = d.roadblock;
  if (d.lastUpdate !== undefined) patch.lastUpdate = d.lastUpdate;
  if (d.nextStep !== undefined) patch.nextStep = d.nextStep;
  if (d.blockedById !== undefined) patch.blockedById = d.blockedById;
  if (d.blockNotes !== undefined) patch.blockNotes = d.blockNotes;

  // Stamp completedAt transitions
  if (d.status !== undefined) {
    if (d.status === "Complete" && existing.status !== "Complete") {
      patch.completedAt = new Date();
    } else if (d.status !== "Complete" && existing.status === "Complete") {
      patch.completedAt = null;
    }
  }

  const [row] = await db
    .update(tasksTable)
    .set(patch)
    .where(eq(tasksTable.id, id))
    .returning();

  // Propagate parent edits (description/dueDate) to incomplete children
  if (existing.isGroupParent) {
    const childPatch: Record<string, unknown> = {};
    if (d.description !== undefined) childPatch.description = d.description;
    if (d.dueDate !== undefined) childPatch.dueDate = toDateString(d.dueDate);
    if (Object.keys(childPatch).length > 0) {
      await db
        .update(tasksTable)
        .set(childPatch)
        .where(
          and(
            eq(tasksTable.parentTaskId, id),
            inArray(tasksTable.status, ["Not Started", "In Progress", "Waiting on Someone", "Blocked", "Pending Review"]),
          ),
        );
    }
  }

  // Rollup to parent task (group parent) when a child changes
  if (existing.parentTaskId) {
    await recomputeParentRollup(existing.parentTaskId);
  }

  const users = await loadUserLookup();
  const projects = await loadProjectLookup();
  const attsByTask = await loadAttachmentsByTask([row!.id]);
  res.json(UpdateTaskResponse.parse(serializeTask(row!, users, projects, attsByTask.get(row!.id) ?? [])));
});

router.delete("/tasks/:id", requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const me = req.appUser!;
  if (me.role === "member" && existing.assigneeId !== me.id) {
    res.status(403).json({ error: "Members can only delete their own tasks" });
    return;
  }
  // Cascade: if this is a group parent, also remove children
  if (existing.isGroupParent) {
    await db.delete(tasksTable).where(eq(tasksTable.parentTaskId, id));
  }
  await db.delete(tasksTable).where(eq(tasksTable.id, id));
  if (existing.parentTaskId) {
    await recomputeParentRollup(existing.parentTaskId);
  }
  res.status(204).end();
});

// --- Roadblock escalation (upward only) ------------------------------------

// A developer escalates a roadblock on their own task. It is routed
// automatically to the responsible higher-up; the developer never picks the
// target, and may only escalate a task assigned to them.
router.post("/tasks/:id/escalate", requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = EscalateRoadblockBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const me = req.appUser!;
  // You can only escalate your own task — escalation must never become a
  // backdoor for assigning work to (or from) a peer.
  if (existing.assigneeId !== me.id) {
    res.status(403).json({ error: "You can only escalate your own task" });
    return;
  }
  const targetId = await resolveEscalationTarget(existing.projectId, me.id);
  if (!targetId) {
    res.status(400).json({ error: "No higher-up available to escalate to" });
    return;
  }
  const note = parsed.data.note.trim();
  if (!note) {
    res.status(400).json({ error: "A roadblock note is required" });
    return;
  }
  const [row] = await db
    .update(tasksTable)
    .set({
      status: "Blocked",
      roadblock: note,
      blockNotes: note,
      escalatedToId: targetId,
      escalatedById: me.id,
      escalationOriginalAssigneeId: existing.assigneeId,
      escalatedAt: new Date(),
      escalationResolvedById: null,
      escalationResolvedAt: null,
      escalationResolutionNote: null,
    })
    .where(eq(tasksTable.id, id))
    .returning();
  if (existing.parentTaskId) await recomputeParentRollup(existing.parentTaskId);
  const users = await loadUserLookup();
  const projects = await loadProjectLookup();
  const attsByTask = await loadAttachmentsByTask([row!.id]);
  res.json(
    EscalateRoadblockResponse.parse(
      serializeTask(row!, users, projects, attsByTask.get(row!.id) ?? []),
    ),
  );
});

// The higher-up's inbox: open roadblocks escalated to the current user.
router.get("/escalations", requireAuth, async (req: Request, res: Response) => {
  const me = req.appUser!;
  const rows = await db
    .select()
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.escalatedToId, me.id),
        isNull(tasksTable.escalationResolvedAt),
      ),
    );
  const users = await loadUserLookup();
  const projects = await loadProjectLookup();
  const attsByTask = await loadAttachmentsByTask(rows.map((r) => r.id));
  const data = rows
    .map((t) => serializeTask(t, users, projects, attsByTask.get(t.id) ?? []))
    .sort((a, b) => {
      const ea = a.escalatedAt ? String(a.escalatedAt) : "";
      const eb = b.escalatedAt ? String(b.escalatedAt) : "";
      return eb.localeCompare(ea); // newest first
    });
  res.json(ListEscalationsResponse.parse(data));
});

// Team-wide visibility of stuck work: every open task currently in Blocked
// status, EXCLUDING any task with an active (unresolved) escalation — those
// already show in the escalation queue above, so the two lists never duplicate
// a card. Read-only and gated to higher-ups (the same permission that guards
// the Roadblocks page); members never gain visibility into others' tasks.
router.get(
  "/blocked-tasks",
  requireAuth,
  requirePermission(ESCALATION_MANAGER_PERMISSION),
  async (_req: Request, res: Response) => {
    const data = await loadTeamBlockedTasks();
    res.json(ListBlockedTasksResponse.parse(data));
  },
);

// The higher-up resolves a roadblock. By default the task returns to the
// original developer; the higher-up may instead reassign it to someone else.
// Only the routed higher-up (or an admin/vp) may resolve.
router.post("/escalations/:id/resolve", requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = ResolveEscalationBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (existing.escalatedAt == null || existing.escalationResolvedAt != null) {
    res.status(400).json({ error: "No active escalation on this task" });
    return;
  }
  const me = req.appUser!;
  const canManage = hasPermission(me, ESCALATION_MANAGER_PERMISSION);
  const isTarget = existing.escalatedToId === me.id;
  if (!isTarget && !canManage) {
    res.status(403).json({ error: "Only the higher-up may resolve this escalation" });
    return;
  }
  // Default: return to the original developer. Reassignment on resolve is the
  // single sanctioned exception — and it is restricted to a higher-up (a user
  // holding the managerial permission), so it can never become a backdoor for
  // developer-to-developer assignment even if the target somehow lacks it.
  let returnTo = existing.escalationOriginalAssigneeId ?? existing.assigneeId;
  const reassignToId = parsed.data.reassignToId;
  if (reassignToId) {
    if (!canManage) {
      res.status(403).json({ error: "Only a higher-up may reassign this task" });
      return;
    }
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, reassignToId));
    if (!u || u.isActive === false) {
      res.status(400).json({ error: "Reassign target not found" });
      return;
    }
    returnTo = reassignToId;
  }
  const note = parsed.data.resolutionNote?.trim() || null;
  const [row] = await db
    .update(tasksTable)
    .set({
      assigneeId: returnTo,
      status: "In Progress",
      roadblock: null,
      blockNotes: null,
      blockedById: null,
      escalationResolvedById: me.id,
      escalationResolvedAt: new Date(),
      escalationResolutionNote: note,
    })
    .where(eq(tasksTable.id, id))
    .returning();
  if (existing.parentTaskId) await recomputeParentRollup(existing.parentTaskId);
  const users = await loadUserLookup();
  const projects = await loadProjectLookup();
  const attsByTask = await loadAttachmentsByTask([row!.id]);
  res.json(
    ResolveEscalationResponse.parse(
      serializeTask(row!, users, projects, attsByTask.get(row!.id) ?? []),
    ),
  );
});

export default router;
