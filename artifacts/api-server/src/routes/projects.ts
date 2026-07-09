import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  projectsTable,
  focusAreasTable,
  tasksTable,
  type Task,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import {
  ListProjectsResponse,
  GetProjectResponse,
  CreateProjectBody,
  UpdateProjectBody,
  UpdateProjectResponse,
} from "@workspace/api-zod";
import {
  requireAuth,
  requirePermission,
  isEscalationManagerUserId,
} from "../lib/permissions";
import { computeProjectRollup } from "../lib/rollups";
import { loadUserLookup, loadProjectLookup, serializeTask, serializeProject, loadAttachmentsByTask } from "../lib/enrich";

const router: IRouter = Router();

async function tasksByProject(): Promise<Map<string, Task[]>> {
  const all = await db.select().from(tasksTable);
  const m = new Map<string, Task[]>();
  for (const t of all) {
    const arr = m.get(t.projectId) ?? [];
    arr.push(t);
    m.set(t.projectId, arr);
  }
  return m;
}

router.get("/projects", requireAuth, async (_req: Request, res: Response) => {
  const projects = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      focusAreaId: projectsTable.focusAreaId,
      executiveOwnerId: projectsTable.executiveOwnerId,
      strategicGoal: projectsTable.strategicGoal,
      createdAt: projectsTable.createdAt,
      focusAreaName: focusAreasTable.name,
      focusAreaSortOrder: focusAreasTable.sortOrder,
    })
    .from(projectsTable)
    .leftJoin(focusAreasTable, eq(projectsTable.focusAreaId, focusAreasTable.id))
    .orderBy(asc(focusAreasTable.sortOrder), asc(projectsTable.id));

  const users = await loadUserLookup();
  const taskMap = await tasksByProject();

  const data = projects.map((p) => {
    const tasks = taskMap.get(p.id) ?? [];
    const rollup = computeProjectRollup(tasks);
    return serializeProject(
      {
        id: p.id,
        name: p.name,
        focusAreaId: p.focusAreaId,
        executiveOwnerId: p.executiveOwnerId,
        strategicGoal: p.strategicGoal,
        createdAt: p.createdAt,
      },
      p.focusAreaName ?? "",
      p.executiveOwnerId ? users.get(p.executiveOwnerId)?.name ?? null : null,
      rollup,
    );
  });

  res.json(ListProjectsResponse.parse(data));
});

router.get("/projects/:id", requireAuth, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [fa] = await db.select().from(focusAreasTable).where(eq(focusAreasTable.id, project.focusAreaId));
  const users = await loadUserLookup();
  const projectLookup = await loadProjectLookup();
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, id));
  const attsByTask = await loadAttachmentsByTask(tasks.map((t) => t.id));
  const rollup = computeProjectRollup(tasks);

  const ownerName = project.executiveOwnerId
    ? users.get(project.executiveOwnerId)?.name ?? null
    : null;

  res.json(
    GetProjectResponse.parse({
      ...serializeProject(project, fa?.name ?? "", ownerName, rollup),
      tasks: tasks.map((t) => serializeTask(t, users, projectLookup, attsByTask.get(t.id) ?? [])),
    }),
  );
});

router.post(
  "/projects",
  requireAuth,
  requirePermission("edit_initiatives"),
  async (req: Request, res: Response) => {
    const parsed = CreateProjectBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.format() });
      return;
    }
    // The executive owner is the escalation target for this initiative's
    // roadblocks, so it must be a higher-up — never a peer/member developer.
    if (
      parsed.data.executiveOwnerId &&
      !(await isEscalationManagerUserId(parsed.data.executiveOwnerId))
    ) {
      res
        .status(400)
        .json({ error: "Executive owner must be a manager (higher-up)" });
      return;
    }
    const [row] = await db
      .insert(projectsTable)
      .values({
        id: parsed.data.id,
        name: parsed.data.name,
        focusAreaId: parsed.data.focusAreaId,
        executiveOwnerId: parsed.data.executiveOwnerId ?? null,
        strategicGoal: parsed.data.strategicGoal,
      })
      .returning();
    const [fa] = await db.select().from(focusAreasTable).where(eq(focusAreasTable.id, row!.focusAreaId));
    const users = await loadUserLookup();
    const rollup = computeProjectRollup([]);
    res.status(201).json(
      UpdateProjectResponse.parse(
        serializeProject(
          row!,
          fa?.name ?? "",
          row!.executiveOwnerId ? users.get(row!.executiveOwnerId)?.name ?? null : null,
          rollup,
        ),
      ),
    );
  },
);

router.patch(
  "/projects/:id",
  requireAuth,
  requirePermission("edit_initiatives"),
  async (req: Request, res: Response) => {
    const parsed = UpdateProjectBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    // A non-null executive owner must be a higher-up (escalation target).
    if (
      parsed.data.executiveOwnerId &&
      !(await isEscalationManagerUserId(parsed.data.executiveOwnerId))
    ) {
      res
        .status(400)
        .json({ error: "Executive owner must be a manager (higher-up)" });
      return;
    }
    const patch: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.focusAreaId !== undefined) patch.focusAreaId = parsed.data.focusAreaId;
    if (parsed.data.executiveOwnerId !== undefined)
      patch.executiveOwnerId = parsed.data.executiveOwnerId;
    if (parsed.data.strategicGoal !== undefined) patch.strategicGoal = parsed.data.strategicGoal;

    const [row] = await db
      .update(projectsTable)
      .set(patch)
      .where(eq(projectsTable.id, String(req.params.id)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const [fa] = await db.select().from(focusAreasTable).where(eq(focusAreasTable.id, row.focusAreaId));
    const users = await loadUserLookup();
    const tasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, row.id));
    const rollup = computeProjectRollup(tasks);
    res.json(
      UpdateProjectResponse.parse(
        serializeProject(
          row,
          fa?.name ?? "",
          row.executiveOwnerId ? users.get(row.executiveOwnerId)?.name ?? null : null,
          rollup,
        ),
      ),
    );
  },
);

router.delete(
  "/projects/:id",
  requireAuth,
  requirePermission("delete_initiatives"),
  async (req: Request, res: Response) => {
    const result = await db
      .delete(projectsTable)
      .where(eq(projectsTable.id, String(req.params.id)))
      .returning();
    if (result.length === 0) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(204).end();
  },
);

export default router;
