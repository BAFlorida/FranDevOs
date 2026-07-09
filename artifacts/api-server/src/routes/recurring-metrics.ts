import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  recurringMetricsTable,
  metricEntriesTable,
  kpiAuditEntriesTable,
  weekLockOverridesTable,
  usersTable,
} from "@workspace/db";
import { and, eq, gte, desc } from "drizzle-orm";
import { requireAuth, requirePermission, displayNameFor } from "../lib/permissions";
import { mondayOf, priorMonday, isWeekLocked, hasUnlockOverride, canEditWeek, lockEffectiveAt } from "../lib/weeks";

const router: IRouter = Router();

router.get("/recurring-metrics", requireAuth, async (_req: Request, res: Response) => {
  const rows = await db.select().from(recurringMetricsTable);
  res.json(rows);
});

router.get("/recurring-metrics/this-week", requireAuth, async (req: Request, res: Response) => {
  const week = mondayOf(new Date());
  const metrics = await db.select().from(recurringMetricsTable);
  const users = await db.select().from(usersTable);
  const out = [];
  for (const m of metrics) {
    const applicable = users.filter((u) => {
      if (m.appliesTo === "all") return true;
      if (m.appliesTo === "developers") return u.role === "member" || u.role === "lead";
      return false;
    });
    const entries = await db
      .select()
      .from(metricEntriesTable)
      .where(and(eq(metricEntriesTable.metricId, m.id), eq(metricEntriesTable.periodStart, week)));
    const byUser = new Map(entries.map((e) => [e.userId, e]));
    out.push({
      metric: m,
      weekStart: week,
      isMine: req.appUser!.id,
      entries: applicable
        .map((u) => {
          const e = byUser.get(u.id);
          return {
            userId: u.id,
            userName: displayNameFor(u),
            avatarColor: u.avatarColor,
            count: e?.count ?? 0,
            target: m.targetCount,
            source: e?.source ?? "manual",
            isSelfReported: !!e && e.source === "manual" && e.userId === req.appUser!.id,
            lastEvidenceNote: e?.lastEvidenceNote ?? null,
          };
        })
        .sort((a, b) => a.userName.localeCompare(b.userName)),
    });
  }
  res.json(out);
});

// POST /metric-entries — upsert with evidence (required when count > 0)
router.post("/metric-entries", requireAuth, async (req: Request, res: Response) => {
  const { metricId, userId, count, weekStart, evidenceNote, evidenceUrl } = req.body ?? {};
  if (typeof metricId !== "number" || typeof userId !== "string" || typeof count !== "number") {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const me = req.appUser!;
  if (me.role === "member" && userId !== me.id) {
    res.status(403).json({ error: "Members can only update their own metrics" });
    return;
  }
  const week = typeof weekStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(weekStart)
    ? weekStart
    : mondayOf(new Date());

  // Week lock enforcement (admin/vp can still write — they have override mechanism)
  if (!(await canEditWeek(week))) {
    if (me.role !== "vp" && me.role !== "admin") {
      res.status(423).json({ error: "Week is locked. Ask VP to unlock prior week." });
      return;
    }
  }

  // Only the salesforce ingest path may set source="salesforce".
  // Client-submitted entries are always recorded as manual / self-reported.
  const safeSource: "manual" | "salesforce" = "manual";
  const note = typeof evidenceNote === "string" && evidenceNote.trim() ? evidenceNote.trim() : null;
  const url = typeof evidenceUrl === "string" && evidenceUrl.trim() ? evidenceUrl.trim() : null;

  const existing = await db
    .select()
    .from(metricEntriesTable)
    .where(
      and(
        eq(metricEntriesTable.metricId, metricId),
        eq(metricEntriesTable.userId, userId),
        eq(metricEntriesTable.periodStart, week),
      ),
    );

  const oldCount = existing[0]?.count ?? 0;
  // Require evidence for any positive delta on self-reported KPIs.
  if (count > oldCount && !note && !url) {
    res.status(400).json({ error: "Evidence note required when increasing self-reported KPI count." });
    return;
  }

  let row;
  if (existing.length > 0) {
    [row] = await db
      .update(metricEntriesTable)
      .set({
        count,
        source: safeSource,
        lastEvidenceNote: note ?? existing[0]!.lastEvidenceNote,
        lastEvidenceUrl: url ?? existing[0]!.lastEvidenceUrl,
      })
      .where(eq(metricEntriesTable.id, existing[0]!.id))
      .returning();
  } else {
    [row] = await db
      .insert(metricEntriesTable)
      .values({
        metricId,
        userId,
        periodStart: week,
        count,
        source: safeSource,
        lastEvidenceNote: note,
        lastEvidenceUrl: url,
      })
      .returning();
  }

  // Audit log — every change recorded
  if (oldCount !== count || note || url) {
    await db.insert(kpiAuditEntriesTable).values({
      metricId,
      userId,
      periodStart: week,
      oldCount,
      newCount: count,
      source: safeSource,
      evidenceNote: note,
      evidenceUrl: url,
      changedById: me.id,
    });
  }

  res.status(existing.length > 0 ? 200 : 201).json(row);
});

router.get("/metric-entries", requireAuth, async (req: Request, res: Response) => {
  const sinceParam = typeof req.query.since === "string" ? req.query.since : undefined;
  const conds = [];
  if (sinceParam && /^\d{4}-\d{2}-\d{2}$/.test(sinceParam)) {
    conds.push(gte(metricEntriesTable.periodStart, sinceParam));
  }
  const rows =
    conds.length > 0
      ? await db.select().from(metricEntriesTable).where(and(...conds))
      : await db.select().from(metricEntriesTable);
  res.json(rows);
});

// Audit log endpoint
router.get("/recurring-metrics/:id/audit", requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const rows = await db
    .select()
    .from(kpiAuditEntriesTable)
    .where(eq(kpiAuditEntriesTable.metricId, id))
    .orderBy(desc(kpiAuditEntriesTable.createdAt));
  const users = await db.select().from(usersTable);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const me = req.appUser!;
  const filtered = me.role === "member" ? rows.filter((r) => r.userId === me.id) : rows;
  res.json(
    filtered.map((r) => {
      const u = userMap.get(r.userId);
      const ch = userMap.get(r.changedById);
      return {
        id: r.id,
        metricId: r.metricId,
        userId: r.userId,
        userName: u ? displayNameFor(u) : r.userId,
        periodStart: r.periodStart,
        oldCount: r.oldCount,
        newCount: r.newCount,
        source: r.source,
        evidenceNote: r.evidenceNote,
        evidenceUrl: r.evidenceUrl,
        changedById: r.changedById,
        changedByName: ch ? displayNameFor(ch) : r.changedById,
        createdAt: r.createdAt,
      };
    }),
  );
});

// Week-lock status
router.get("/recurring-metrics/lock-status", requireAuth, async (_req: Request, res: Response) => {
  const currentWeekStart = mondayOf(new Date());
  const priorWeekStart = priorMonday(1);
  const lockActive = isWeekLocked(priorWeekStart);
  const overrideActive = await hasUnlockOverride(priorWeekStart);
  res.json({
    currentWeekStart,
    priorWeekStart,
    lockActive,
    overrideActive,
    lockEffectiveAt: lockEffectiveAt().toISOString(),
  });
});

router.post(
  "/recurring-metrics/unlock-week",
  requireAuth,
  requirePermission("manage_metrics"),
  async (req: Request, res: Response) => {
    const { periodStart, reason } = req.body ?? {};
    if (typeof periodStart !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart)) {
      res.status(400).json({ error: "periodStart required (YYYY-MM-DD)" });
      return;
    }
    const reasonText = typeof reason === "string" ? reason : "";
    const [existing] = await db
      .select()
      .from(weekLockOverridesTable)
      .where(eq(weekLockOverridesTable.periodStart, periodStart));
    if (!existing) {
      await db.insert(weekLockOverridesTable).values({
        periodStart,
        reason: reasonText,
        unlockedById: req.appUser!.id,
      });
    }
    const currentWeekStart = mondayOf(new Date());
    res.json({
      currentWeekStart,
      priorWeekStart: priorMonday(1),
      lockActive: isWeekLocked(periodStart),
      overrideActive: true,
      lockEffectiveAt: lockEffectiveAt().toISOString(),
    });
  },
);

export default router;
