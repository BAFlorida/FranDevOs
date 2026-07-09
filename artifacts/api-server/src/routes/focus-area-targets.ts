import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  focusAreaTargetsTable,
  focusAreasTable,
  usersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requirePermission, displayNameFor } from "../lib/permissions";

const router: IRouter = Router();

async function loadAll() {
  const rows = await db
    .select({
      focusAreaId: focusAreaTargetsTable.focusAreaId,
      focusAreaName: focusAreasTable.name,
      goalText: focusAreaTargetsTable.goalText,
      targetNumeric: focusAreaTargetsTable.targetNumeric,
      currentNumeric: focusAreaTargetsTable.currentNumeric,
      unitLabel: focusAreaTargetsTable.unitLabel,
      updatedAt: focusAreaTargetsTable.updatedAt,
      updatedByDisplay: usersTable.displayName,
      updatedByFirst: usersTable.firstName,
      updatedByLast: usersTable.lastName,
      updatedByEmail: usersTable.email,
      updatedById: usersTable.id,
    })
    .from(focusAreaTargetsTable)
    .innerJoin(focusAreasTable, eq(focusAreaTargetsTable.focusAreaId, focusAreasTable.id))
    .leftJoin(usersTable, eq(focusAreaTargetsTable.updatedById, usersTable.id));
  return rows.map((r) => ({
    focusAreaId: r.focusAreaId,
    focusAreaName: r.focusAreaName,
    goalText: r.goalText,
    targetNumeric: r.targetNumeric,
    currentNumeric: r.currentNumeric,
    unitLabel: r.unitLabel,
    updatedByName: r.updatedById
      ? displayNameFor({
          id: r.updatedById,
          displayName: r.updatedByDisplay,
          firstName: r.updatedByFirst,
          lastName: r.updatedByLast,
          email: r.updatedByEmail,
        })
      : null,
    updatedAt: r.updatedAt,
  }));
}

router.get("/focus-area-targets", requireAuth, async (_req, res) => {
  res.json(await loadAll());
});

router.put(
  "/focus-area-targets",
  requireAuth,
  requirePermission("manage_targets"),
  async (req: Request, res: Response) => {
    const { focusAreaId, goalText, targetNumeric, currentNumeric, unitLabel } = req.body ?? {};
    if (typeof focusAreaId !== "number" || typeof goalText !== "string") {
      res.status(400).json({ error: "focusAreaId and goalText required" });
      return;
    }
    const [area] = await db.select().from(focusAreasTable).where(eq(focusAreasTable.id, focusAreaId));
    if (!area) {
      res.status(404).json({ error: "Focus area not found" });
      return;
    }
    const values = {
      focusAreaId,
      goalText,
      targetNumeric: typeof targetNumeric === "number" ? targetNumeric : null,
      currentNumeric: typeof currentNumeric === "number" ? currentNumeric : 0,
      unitLabel: typeof unitLabel === "string" ? unitLabel : "",
      updatedById: req.appUser!.id,
    };
    const [existing] = await db
      .select()
      .from(focusAreaTargetsTable)
      .where(eq(focusAreaTargetsTable.focusAreaId, focusAreaId));
    if (existing) {
      await db
        .update(focusAreaTargetsTable)
        .set(values)
        .where(eq(focusAreaTargetsTable.focusAreaId, focusAreaId));
    } else {
      await db.insert(focusAreaTargetsTable).values(values);
    }
    const all = await loadAll();
    const out = all.find((r) => r.focusAreaId === focusAreaId);
    res.json(out);
  },
);

export default router;
