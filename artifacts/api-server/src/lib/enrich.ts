import {
  db,
  usersTable,
  projectsTable,
  focusAreasTable,
  taskAttachmentsTable,
  type Task,
  type Project,
  type TaskAttachment,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { displayNameFor } from "./permissions";
import { isOverdue, isDueSoon } from "./rollups";

export interface UserLookup {
  id: string;
  name: string;
  avatarColor: string;
}

export interface ProjectLookup {
  id: string;
  name: string;
  focusAreaId: number;
  focusAreaName: string;
  executiveOwnerId: string | null;
  executiveOwnerName: string | null;
}

export async function loadUserLookup(): Promise<Map<string, UserLookup>> {
  const rows = await db.select().from(usersTable);
  const map = new Map<string, UserLookup>();
  for (const u of rows) {
    map.set(u.id, {
      id: u.id,
      name: displayNameFor(u),
      avatarColor: u.avatarColor,
    });
  }
  return map;
}

export async function loadProjectLookup(): Promise<Map<string, ProjectLookup>> {
  const rows = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      focusAreaId: projectsTable.focusAreaId,
      focusAreaName: focusAreasTable.name,
      executiveOwnerId: projectsTable.executiveOwnerId,
    })
    .from(projectsTable)
    .leftJoin(focusAreasTable, eq(projectsTable.focusAreaId, focusAreasTable.id));

  const users = await loadUserLookup();
  const map = new Map<string, ProjectLookup>();
  for (const r of rows) {
    map.set(r.id, {
      id: r.id,
      name: r.name,
      focusAreaId: r.focusAreaId,
      focusAreaName: r.focusAreaName ?? "",
      executiveOwnerId: r.executiveOwnerId,
      executiveOwnerName: r.executiveOwnerId
        ? users.get(r.executiveOwnerId)?.name ?? null
        : null,
    });
  }
  return map;
}

export function serializeAttachment(
  att: TaskAttachment,
  users: Map<string, UserLookup>,
) {
  return {
    id: att.id,
    taskId: att.taskId,
    label: att.label,
    url: att.url,
    addedById: att.addedById,
    addedByName: att.addedById ? users.get(att.addedById)?.name ?? null : null,
    createdAt: att.createdAt,
  };
}

export async function loadAttachmentsByTask(
  taskIds: number[],
): Promise<Map<number, TaskAttachment[]>> {
  const map = new Map<number, TaskAttachment[]>();
  if (taskIds.length === 0) return map;
  const rows = await db
    .select()
    .from(taskAttachmentsTable)
    .where(inArray(taskAttachmentsTable.taskId, taskIds));
  for (const r of rows) {
    const arr = map.get(r.taskId) ?? [];
    arr.push(r);
    map.set(r.taskId, arr);
  }
  return map;
}

export function serializeTask(
  task: Task,
  users: Map<string, UserLookup>,
  projects: Map<string, ProjectLookup>,
  attachments?: TaskAttachment[],
  viewerId?: string,
) {
  const proj = projects.get(task.projectId);
  const assignee = users.get(task.assigneeId);
  return {
    id: task.id,
    attachments: (attachments ?? []).map((a) => serializeAttachment(a, users)),
    projectId: task.projectId,
    projectName: proj?.name,
    projectCode: proj?.id,
    focusAreaId: proj?.focusAreaId,
    focusAreaName: proj?.focusAreaName,
    assigneeId: task.assigneeId,
    assigneeName: assignee?.name,
    assigneeAvatarColor: assignee?.avatarColor,
    role: task.role,
    description: task.description,
    priority: task.priority,
    status: task.status,
    percentComplete: task.percentComplete,
    startDate: task.startDate,
    dueDate: task.dueDate,
    dependency: task.dependency,
    roadblock: task.roadblock,
    lastUpdate: task.lastUpdate,
    nextStep: task.nextStep,
    blockedById: task.blockedById,
    blockedByName: task.blockedById ? users.get(task.blockedById)?.name ?? null : null,
    blockNotes: task.blockNotes,
    escalatedToId: task.escalatedToId,
    escalatedToName: task.escalatedToId ? users.get(task.escalatedToId)?.name ?? null : null,
    escalatedById: task.escalatedById,
    escalatedByName: task.escalatedById ? users.get(task.escalatedById)?.name ?? null : null,
    escalationOriginalAssigneeId: task.escalationOriginalAssigneeId,
    escalationOriginalAssigneeName: task.escalationOriginalAssigneeId
      ? users.get(task.escalationOriginalAssigneeId)?.name ?? null
      : null,
    escalatedAt: task.escalatedAt,
    escalationResolvedById: task.escalationResolvedById,
    escalationResolvedByName: task.escalationResolvedById
      ? users.get(task.escalationResolvedById)?.name ?? null
      : null,
    escalationResolvedAt: task.escalationResolvedAt,
    escalationResolutionNote: task.escalationResolutionNote,
    isEscalated: task.escalatedAt != null && task.escalationResolvedAt == null,
    groupId: task.groupId,
    parentTaskId: task.parentTaskId,
    isGroupParent: task.isGroupParent,
    isOverdue: isOverdue(task),
    isDueSoon: isDueSoon(task),
    isBlockingViewer:
      viewerId != null &&
      task.blockedById === viewerId &&
      task.status === "Blocked",
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export function serializeProject(
  project: Project,
  focusAreaName: string,
  executiveOwnerName: string | null,
  rollup: ReturnType<typeof import("./rollups").computeProjectRollup>,
) {
  return {
    id: project.id,
    name: project.name,
    focusAreaId: project.focusAreaId,
    executiveOwnerId: project.executiveOwnerId,
    strategicGoal: project.strategicGoal,
    focusAreaName,
    executiveOwnerName,
    rollup,
  };
}
