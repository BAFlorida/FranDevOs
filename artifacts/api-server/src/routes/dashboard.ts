import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  projectsTable,
  focusAreasTable,
  tasksTable,
  usersTable,
  type Task,
} from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { GetDashboardResponse } from "@workspace/api-zod";
import { requireAuth, displayNameFor } from "../lib/permissions";
import { computeProjectRollup, isOverdue, isDueSoon } from "../lib/rollups";

const router: IRouter = Router();

router.get("/dashboard", requireAuth, async (_req: Request, res: Response) => {
  const [users, focusAreas, projects, tasks] = await Promise.all([
    db.select().from(usersTable),
    db.select().from(focusAreasTable).orderBy(asc(focusAreasTable.sortOrder)),
    db.select().from(projectsTable),
    db.select().from(tasksTable),
  ]);

  const usersMap = new Map(users.map((u) => [u.id, u]));

  const tasksByProject = new Map<string, Task[]>();
  for (const t of tasks) {
    const arr = tasksByProject.get(t.projectId) ?? [];
    arr.push(t);
    tasksByProject.set(t.projectId, arr);
  }

  const projectRollups = projects.map((p) => ({
    project: p,
    rollup: computeProjectRollup(tasksByProject.get(p.id) ?? []),
  }));

  const activeProjects = projectRollups.filter((p) => p.rollup.taskCount > 0);
  const onTrack = activeProjects.filter((p) => p.rollup.status === "In Progress").length;
  const atRisk = activeProjects.filter((p) => p.rollup.status === "At Risk").length;
  const blocked = activeProjects.filter((p) => p.rollup.status === "Blocked").length;
  const complete = activeProjects.filter((p) => p.rollup.status === "Complete").length;
  const notStarted = activeProjects.filter((p) => p.rollup.status === "Not Started").length;
  const avgCompletion = activeProjects.length
    ? Math.round(
        activeProjects.reduce((acc, p) => acc + p.rollup.percentComplete, 0) /
          activeProjects.length,
      )
    : 0;

  const totalTasks = tasks.length;
  const overdueTasks = tasks.filter(isOverdue).length;
  const dueSoonTasks = tasks.filter(isDueSoon).length;
  const notStartedTasks = tasks.filter((t) => t.status === "Not Started").length;

  const kpis = {
    activeProjects: activeProjects.length,
    onTrack,
    atRisk,
    blocked,
    complete,
    avgCompletion,
    totalTasks,
    overdueTasks,
    dueSoonTasks,
    notStartedTasks,
    notStartedProjects: notStarted,
    teamMemberCount: users.length,
  };

  const taskBreakdown = {
    critical: tasks.filter((t) => t.priority === "Critical").length,
    high: tasks.filter((t) => t.priority === "High").length,
    medium: tasks.filter((t) => t.priority === "Medium").length,
    low: tasks.filter((t) => t.priority === "Low").length,
    notStarted: tasks.filter((t) => t.status === "Not Started").length,
    inProgress: tasks.filter((t) => t.status === "In Progress").length,
    waitingOnSomeone: tasks.filter((t) => t.status === "Waiting on Someone").length,
    blocked: tasks.filter((t) => t.status === "Blocked").length,
    pendingReview: tasks.filter((t) => t.status === "Pending Review").length,
    complete: tasks.filter((t) => t.status === "Complete").length,
  };

  // Focus area rollups
  const focusAreaRollups = focusAreas.map((fa) => {
    const faProjects = projectRollups.filter((p) => p.project.focusAreaId === fa.id);
    const faTasks = faProjects.flatMap((p) => tasksByProject.get(p.project.id) ?? []);
    const faOverdue = faTasks.filter(isOverdue).length;
    const percent = faTasks.length
      ? Math.round(faTasks.reduce((acc, t) => acc + t.percentComplete, 0) / faTasks.length)
      : 0;
    return {
      focusAreaId: fa.id,
      focusAreaName: fa.name,
      projectCount: faProjects.length,
      taskCount: faTasks.length,
      percentComplete: percent,
      hasOverdue: faOverdue > 0,
    };
  });

  // Needs attention: overdue or blocked tasks
  const projectsMap = new Map(projects.map((p) => [p.id, p]));
  const needsAttention = tasks
    .filter((t) => isOverdue(t) || t.status === "Blocked")
    .map((t) => {
      const p = projectsMap.get(t.projectId);
      const u = usersMap.get(t.assigneeId);
      const reason = isOverdue(t) ? "Overdue" : "Blocked";
      return {
        taskId: t.id,
        description: t.description,
        projectId: t.projectId,
        projectName: p?.name ?? "",
        assigneeId: t.assigneeId,
        assigneeName: u ? displayNameFor(u) : "",
        assigneeAvatarColor: u?.avatarColor ?? "#888",
        dueDate: t.dueDate,
        status: t.status,
        reason,
      };
    })
    .sort((a, b) => {
      const da = a.dueDate ?? "9999";
      const db = b.dueDate ?? "9999";
      return String(da).localeCompare(String(db));
    });

  // Workload by team member
  const tasksByUser = new Map<string, Task[]>();
  for (const t of tasks) {
    const arr = tasksByUser.get(t.assigneeId) ?? [];
    arr.push(t);
    tasksByUser.set(t.assigneeId, arr);
  }
  const workload = users
    .map((u) => {
      const userTasks = tasksByUser.get(u.id) ?? [];
      const open = userTasks.filter((t) => t.status !== "Complete").length;
      const overdue = userTasks.filter(isOverdue).length;
      const percent = userTasks.length
        ? Math.round(
            userTasks.reduce((acc, t) => acc + t.percentComplete, 0) / userTasks.length,
          )
        : 0;
      return {
        userId: u.id,
        name: displayNameFor(u),
        avatarColor: u.avatarColor,
        totalTasks: userTasks.length,
        openTasks: open,
        overdueCount: overdue,
        percentComplete: percent,
      };
    })
    .sort((a, b) => b.totalTasks - a.totalTasks);

  res.json(
    GetDashboardResponse.parse({
      kpis,
      focusAreas: focusAreaRollups,
      needsAttention,
      workload,
      taskBreakdown,
    }),
  );
});

export default router;
