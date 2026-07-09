import { Router, type IRouter, type Request, type Response } from "express";
import { db, focusAreasTable } from "@workspace/db";
import { asc, sql } from "drizzle-orm";
import { ListFocusAreasResponse, CreateFocusAreaBody } from "@workspace/api-zod";
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

export default router;
