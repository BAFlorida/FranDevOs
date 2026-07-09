import { Router, type IRouter, type Request, type Response } from "express";
import { db, focusAreasTable, projectsTable } from "@workspace/db";
import { asc, eq, sql } from "drizzle-orm";
import {
  ListFocusAreasResponse,
  CreateFocusAreaBody,
  UpdateFocusAreaBody,
} from "@workspace/api-zod";
import { requireAuth, requirePermission } from "../lib/permissions";

const router: IRouter = Router();

router.get(
  "/focus-areas",
  requireAuth,
  async (_req: Request, res: Response) => {
    const rows = await db
      .select()
      .from(focusAreasTable)
      .orderBy(asc(focusAreasTable.sortOrder));
    res.json(ListFocusAreasResponse.parse(rows));
  },
);

router.post(
  "/focus-areas",
  requireAuth,
  requirePermission("edit_initiatives"),
  async (req: Request, res: Response) => {
    const parsed = CreateFocusAreaBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.format() });
      return;
    }
    let sortOrder = parsed.data.sortOrder;
    if (sortOrder === undefined || sortOrder === null) {
      const [max] = await db
        .select({ value: sql<number>`cast(coalesce(max(${focusAreasTable.sortOrder}), 0) as int)` })
        .from(focusAreasTable);
      sortOrder = (max?.value ?? 0) + 1;
    }
    const [row] = await db
      .insert(focusAreasTable)
      .values({ name: parsed.data.name.trim(), sortOrder })
      .returning();
    res.status(201).json(row);
  },
);

router.patch(
  "/focus-areas/:id",
  requireAuth,
  requirePermission("edit_initiatives"),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid pillar id" });
      return;
    }
    const parsed = UpdateFocusAreaBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.format() });
      return;
    }
    const patch: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
    if (parsed.data.sortOrder !== undefined) patch.sortOrder = parsed.data.sortOrder;
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }
    const [row] = await db
      .update(focusAreasTable)
      .set(patch)
      .where(eq(focusAreasTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Pillar not found" });
      return;
    }
    res.json(row);
  },
);

router.delete(
  "/focus-areas/:id",
  requireAuth,
  requirePermission("delete_initiatives"),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid pillar id" });
      return;
    }
    // A pillar with tactics can't be deleted (projects.focus_area_id is a
    // restricting FK). Surface a clear, actionable error instead of a raw 500.
    const tactics = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(eq(projectsTable.focusAreaId, id));
    if (tactics.length > 0) {
      res.status(400).json({
        error: `Move or delete this pillar's ${tactics.length} tactic${
          tactics.length === 1 ? "" : "s"
        } before deleting the pillar.`,
      });
      return;
    }
    const deleted = await db
      .delete(focusAreasTable)
      .where(eq(focusAreasTable.id, id))
      .returning();
    if (deleted.length === 0) {
      res.status(404).json({ error: "Pillar not found" });
      return;
    }
    res.status(204).end();
  },
);

export default router;
