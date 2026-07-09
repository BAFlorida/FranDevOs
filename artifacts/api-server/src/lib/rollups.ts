import type { Task as DbTask, Project as DbProject } from "@workspace/db";

export type ProjectStatus =
  | "No Tasks"
  | "Not Started"
  | "In Progress"
  | "At Risk"
  | "Blocked"
  | "Complete";

export type HealthColor = "green" | "amber" | "red" | "gray";

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function plusDaysIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isOverdue(task: Pick<DbTask, "status" | "dueDate">): boolean {
  if (task.status === "Complete") return false;
  if (!task.dueDate) return false;
  return task.dueDate < todayIso();
}

export function isDueSoon(task: Pick<DbTask, "status" | "dueDate">): boolean {
  if (task.status === "Complete") return false;
  if (!task.dueDate) return false;
  const today = todayIso();
  const horizon = plusDaysIso(7);
  return task.dueDate >= today && task.dueDate <= horizon;
}

export interface ProjectRollup {
  taskCount: number;
  percentComplete: number;
  status: ProjectStatus;
  healthColor: HealthColor;
  overdueCount: number;
  completeCount: number;
  blockedCount: number;
}

export function computeProjectRollup(tasks: DbTask[]): ProjectRollup {
  if (tasks.length === 0) {
    return {
      taskCount: 0,
      percentComplete: 0,
      status: "No Tasks",
      healthColor: "gray",
      overdueCount: 0,
      completeCount: 0,
      blockedCount: 0,
    };
  }

  const overdueCount = tasks.filter(isOverdue).length;
  const blockedCount = tasks.filter((t) => t.status === "Blocked").length;
  const completeCount = tasks.filter((t) => t.status === "Complete").length;
  const inProgressOrWaiting = tasks.filter(
    (t) =>
      t.status === "In Progress" ||
      t.status === "Waiting on Someone" ||
      t.status === "Pending Review",
  ).length;

  let status: ProjectStatus;
  if (blockedCount > 0) status = "Blocked";
  else if (overdueCount > 0) status = "At Risk";
  else if (completeCount === tasks.length) status = "Complete";
  else if (inProgressOrWaiting > 0) status = "In Progress";
  else status = "Not Started";

  let healthColor: HealthColor;
  if (status === "Blocked" || status === "At Risk") healthColor = "red";
  else if (status === "Complete" || status === "In Progress")
    healthColor = "green";
  else healthColor = "amber";

  const sum = tasks.reduce((acc, t) => acc + (t.percentComplete ?? 0), 0);
  const percentComplete = Math.round(sum / tasks.length);

  return {
    taskCount: tasks.length,
    percentComplete,
    status,
    healthColor,
    overdueCount,
    completeCount,
    blockedCount,
  };
}

export function projectIsActive(rollup: ProjectRollup): boolean {
  return rollup.taskCount > 0;
}

export type { DbTask, DbProject };
