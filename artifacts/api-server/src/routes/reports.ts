import { Router, type IRouter, type Request, type Response } from "express";
import ExcelJS from "exceljs";
import {
  db,
  projectsTable,
  tasksTable,
  usersTable,
  focusAreasTable,
  focusAreaTargetsTable,
  recurringMetricsTable,
  metricEntriesTable,
  type Task,
} from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { requireAuth, requirePermission, displayNameFor } from "../lib/permissions";
import { computeProjectRollup, isOverdue } from "../lib/rollups";
import { loadAttachmentsByTask, serializeAttachment } from "../lib/enrich";
import { mondayOf, priorMonday } from "../lib/weeks";
import {
  BRAND,
  styleHeaderRow,
  applyBodyStyle,
  setLandscapePrint,
  autoWidthFromHeaders,
  styleInitiativeBand,
  styleTacticBand,
  colorByStatus,
  dataBarRule,
} from "../lib/excel-style";

const router: IRouter = Router();

router.get(
  "/reports/export.xlsx",
  requireAuth,
  requirePermission("run_reports"),
  async (req: Request, res: Response) => {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Franchise Development OS";
    wb.created = new Date();
    wb.title = "Franchise Development OS — Board Update";
    wb.company = "Franchise Development";

    const [users, areas, targets, projects, tasks, metrics, entries] = await Promise.all([
      db.select().from(usersTable),
      db.select().from(focusAreasTable).orderBy(asc(focusAreasTable.sortOrder)),
      db.select().from(focusAreaTargetsTable),
      db.select().from(projectsTable),
      db.select().from(tasksTable),
      db.select().from(recurringMetricsTable),
      db.select().from(metricEntriesTable),
    ]);

    const userById = new Map(users.map((u) => [u.id, u]));
    const areaById = new Map(areas.map((a) => [a.id, a]));
    const targetByArea = new Map(targets.map((t) => [t.focusAreaId, t]));

    const tasksByProject = new Map<string, Task[]>();
    for (const t of tasks) {
      const arr = tasksByProject.get(t.projectId) ?? [];
      arr.push(t);
      tasksByProject.set(t.projectId, arr);
    }
    const projectsWithRollups = projects.map((p) => ({
      project: p,
      rollup: computeProjectRollup(tasksByProject.get(p.id) ?? []),
    }));

    const totalTasks = tasks.length;
    const completeTasks = tasks.filter((t) => t.status === "Complete").length;
    const overdueTasks = tasks.filter(isOverdue).length;
    const blockedTasks = tasks.filter((t) => t.status === "Blocked").length;
    const onTrackTactics = projectsWithRollups.filter((p) => p.rollup.healthColor === "green").length;
    const activeTactics = projectsWithRollups.filter((p) => p.rollup.taskCount > 0).length;
    const avgCompletion = projectsWithRollups.length
      ? Math.round(
          projectsWithRollups.reduce((s, p) => s + p.rollup.percentComplete, 0) /
            projectsWithRollups.length,
        )
      : 0;

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 30);
    const completedRecent = tasks
      .filter((t) => t.status === "Complete" && t.completedAt && t.completedAt >= cutoff)
      .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());

    const week = mondayOf(new Date());
    const sessionUser = (req as Request & { user?: { id?: string } }).user;
    const vpName = sessionUser?.id
      ? userById.get(sessionUser.id)
        ? displayNameFor(userById.get(sessionUser.id)!)
        : "Executive Sponsor"
      : "Executive Sponsor";
    const generatedAt = new Date();

    // ===== Sheet 1: Cover =====
    {
      const cover = wb.addWorksheet("Cover", {
        properties: { tabColor: { argb: BRAND.dark } },
        views: [{ showGridLines: false }],
      });
      cover.getColumn(1).width = 4;
      cover.getColumn(2).width = 36;
      cover.getColumn(3).width = 36;
      cover.getColumn(4).width = 24;
      cover.getColumn(5).width = 24;

      cover.mergeCells("B2:E2");
      const titleCell = cover.getCell("B2");
      titleCell.value = "Franchise Development OS";
      titleCell.font = { name: "Calibri", size: 28, bold: true, color: { argb: BRAND.white } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.dark } };
      titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      cover.getRow(2).height = 48;

      cover.mergeCells("B3:E3");
      const subCell = cover.getCell("B3");
      subCell.value = `Board Update — Week of ${week}`;
      subCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: BRAND.white } };
      subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.darkAlt } };
      subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      cover.getRow(3).height = 28;

      cover.mergeCells("B4:E4");
      const meta = cover.getCell("B4");
      meta.value = `Prepared by ${vpName}  ·  Generated ${generatedAt.toLocaleString()}`;
      meta.font = { name: "Calibri", size: 11, italic: true, color: { argb: BRAND.muted } };
      meta.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      cover.getRow(4).height = 20;

      const summaryRows: Array<[string, string | number]> = [
        ["Strategic Initiatives", areas.length],
        ["Active Tactics", `${activeTactics} of ${projects.length}`],
        ["Tactics on Track", `${onTrackTactics} of ${projects.length}`],
        ["Portfolio Avg Completion", `${avgCompletion}%`],
        ["Total Tasks", totalTasks],
        ["Tasks Complete", completeTasks],
        ["Tasks Overdue", overdueTasks],
        ["Tasks Blocked", blockedTasks],
        ["Tasks Completed (Last 30 Days)", completedRecent.length],
      ];
      let r = 6;
      cover.mergeCells(`B${r}:E${r}`);
      const sectionHeader = cover.getCell(`B${r}`);
      sectionHeader.value = "PORTFOLIO AT A GLANCE";
      sectionHeader.font = { name: "Calibri", size: 11, bold: true, color: { argb: BRAND.white } };
      sectionHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.dark } };
      sectionHeader.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      cover.getRow(r).height = 20;
      r++;
      for (const [label, value] of summaryRows) {
        const lc = cover.getCell(`B${r}`);
        cover.mergeCells(`B${r}:D${r}`);
        lc.value = label;
        lc.font = { name: "Calibri", size: 11, color: { argb: BRAND.dark } };
        lc.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        const vc = cover.getCell(`E${r}`);
        vc.value = value;
        vc.font = { name: "Calibri", size: 11, bold: true, color: { argb: BRAND.dark } };
        vc.alignment = { vertical: "middle", horizontal: "right" };
        if ((r - 7) % 2 === 0) {
          for (const col of ["B", "C", "D", "E"]) {
            cover.getCell(`${col}${r}`).fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: BRAND.light },
            };
          }
        }
        cover.getRow(r).height = 18;
        r++;
      }

      r += 1;
      cover.mergeCells(`B${r}:E${r}`);
      const legendHeader = cover.getCell(`B${r}`);
      legendHeader.value = "LEGEND — TACTIC HEALTH";
      legendHeader.font = { name: "Calibri", size: 11, bold: true, color: { argb: BRAND.white } };
      legendHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.dark } };
      legendHeader.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      cover.getRow(r).height = 20;
      r++;
      const legend: Array<[string, string]> = [
        ["On Track / In Progress", "In Progress"],
        ["Complete", "Complete"],
        ["At Risk (overdue tasks)", "At Risk"],
        ["Blocked", "Blocked"],
        ["Not Started", "Not Started"],
      ];
      for (const [label, status] of legend) {
        const sw = cover.getCell(`B${r}`);
        sw.value = "";
        colorByStatus(sw, status);
        const lab = cover.getCell(`C${r}`);
        cover.mergeCells(`C${r}:E${r}`);
        lab.value = label;
        lab.font = { name: "Calibri", size: 11, color: { argb: BRAND.dark } };
        lab.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        cover.getRow(r).height = 18;
        r++;
      }

      setLandscapePrint(cover, "Franchise Development OS — Board Update");
    }

    // ===== Sheet 2: Strategic Initiatives =====
    {
      const ws = wb.addWorksheet("Strategic Initiatives", {
        properties: { tabColor: { argb: BRAND.darkAlt } },
      });
      ws.columns = [
        { header: "Strategic Initiative", key: "name", width: 36 },
        { header: "Owner", key: "owner", width: 22 },
        { header: "Status", key: "status", width: 14 },
        { header: "Goal", key: "goal", width: 60 },
        { header: "Current", key: "current", width: 12 },
        { header: "Target", key: "target", width: 12 },
        { header: "Unit", key: "unit", width: 20 },
        { header: "% Attainment", key: "attain", width: 16 },
        { header: "Tactics", key: "tactics", width: 10 },
        { header: "On Track", key: "ontrack", width: 12 },
        { header: "% On Track", key: "ontrackPct", width: 14 },
        { header: "Tasks", key: "tasks", width: 9 },
        { header: "Overdue", key: "overdue", width: 10 },
        { header: "Avg %", key: "avg", width: 10 },
      ];

      const statusRowMap: Array<{ row: number; status: string }> = [];

      for (const a of areas) {
        const t = targetByArea.get(a.id);
        const areaProjs = projectsWithRollups.filter((p) => p.project.focusAreaId === a.id);
        const onTrack = areaProjs.filter((p) => p.rollup.healthColor === "green").length;
        const onTrackPct = areaProjs.length ? Math.round((onTrack / areaProjs.length) * 100) : 0;
        const allAreaTasks = areaProjs.flatMap((p) => tasksByProject.get(p.project.id) ?? []);
        const overdue = allAreaTasks.filter(isOverdue).length;
        const avgPct = areaProjs.length
          ? Math.round(
              areaProjs.reduce((s, p) => s + p.rollup.percentComplete, 0) / areaProjs.length,
            )
          : 0;
        const attain =
          t && t.targetNumeric && t.targetNumeric > 0
            ? Math.round((t.currentNumeric / t.targetNumeric) * 100)
            : null;

        // Owner = most common executive owner across tactics in this initiative
        const ownerCounts = new Map<string, number>();
        for (const { project } of areaProjs) {
          if (project.executiveOwnerId) {
            ownerCounts.set(
              project.executiveOwnerId,
              (ownerCounts.get(project.executiveOwnerId) ?? 0) + 1,
            );
          }
        }
        let ownerName = "";
        if (ownerCounts.size > 0) {
          const topOwnerId = Array.from(ownerCounts.entries()).sort(
            (x, y) => y[1] - x[1],
          )[0]![0];
          const u = userById.get(topOwnerId);
          if (u) ownerName = displayNameFor(u);
        }

        // Initiative status rollup
        const blockedCount = areaProjs.filter((p) => p.rollup.healthColor === "red").length;
        const atRiskCount = areaProjs.filter((p) => p.rollup.healthColor === "amber").length;
        const completeCount = areaProjs.filter((p) => p.rollup.status === "Complete").length;
        let initiativeStatus: string;
        if (areaProjs.length === 0) initiativeStatus = "No Tasks";
        else if (completeCount === areaProjs.length) initiativeStatus = "Complete";
        else if (blockedCount > 0) initiativeStatus = "Blocked";
        else if (atRiskCount > 0) initiativeStatus = "At Risk";
        else initiativeStatus = "On Track";

        const addedRow = ws.addRow({
          name: a.name,
          owner: ownerName,
          status: initiativeStatus,
          goal: t?.goalText ?? "—",
          current: t?.currentNumeric ?? "",
          target: t?.targetNumeric ?? "",
          unit: t?.unitLabel ?? "",
          attain: attain !== null ? attain / 100 : "",
          tactics: areaProjs.length,
          ontrack: onTrack,
          ontrackPct: onTrackPct / 100,
          tasks: allAreaTasks.length,
          overdue,
          avg: avgPct / 100,
        });
        statusRowMap.push({ row: addedRow.number, status: initiativeStatus });
      }

      styleHeaderRow(ws, 1);

      // Percent formats (H, K, N now after adding Owner+Status)
      const lastRow = ws.rowCount;
      ["H", "K", "N"].forEach((col) => {
        for (let r = 2; r <= lastRow; r++) {
          ws.getCell(`${col}${r}`).numFmt = "0%";
          ws.getCell(`${col}${r}`).alignment = { horizontal: "center" };
        }
      });

      applyBodyStyle(ws);

      // Apply status badge color AFTER body style so it isn't overridden
      for (const { row, status } of statusRowMap) {
        colorByStatus(ws.getCell(`C${row}`), status);
      }

      // Data bars
      if (lastRow >= 2) {
        ws.addConditionalFormatting({ ref: `H2:H${lastRow}`, rules: [dataBarRule("FF6366F1")] });
        ws.addConditionalFormatting({ ref: `K2:K${lastRow}`, rules: [dataBarRule("FF10B981")] });
        ws.addConditionalFormatting({ ref: `N2:N${lastRow}`, rules: [dataBarRule("FF0F2238")] });
        // Overdue (M) — red highlight when > 0
        ws.addConditionalFormatting({
          ref: `M2:M${lastRow}`,
          rules: [
            {
              type: "cellIs",
              operator: "greaterThan",
              priority: 1,
              formulae: ["0"],
              style: {
                font: { bold: true, color: { argb: "FFB91C1C" } },
                fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFEE2E2" } },
              },
            },
          ],
        });
      }
      autoWidthFromHeaders(ws);
      setLandscapePrint(ws, "Strategic Initiatives");
    }

    // ===== Sheet 3: Drill-Down (Initiatives → Tactics → Tasks) =====
    {
      const ws = wb.addWorksheet("Drill-Down", {
        properties: {
          tabColor: { argb: "FF6366F1" },
          outlineProperties: { summaryBelow: false, summaryRight: false },
        },
      });
      ws.columns = [
        { header: "Name", key: "name", width: 56 },
        { header: "Owner / Assignee", key: "owner", width: 22 },
        { header: "Status", key: "status", width: 16 },
        { header: "Priority", key: "priority", width: 11 },
        { header: "Due", key: "due", width: 13 },
        { header: "Completed", key: "completed", width: 13 },
        { header: "% Complete", key: "pct", width: 13 },
        { header: "Notes / Blockers", key: "notes", width: 50 },
      ];
      styleHeaderRow(ws, 1);

      const dataBarRanges: string[] = [];
      const overdueRows: number[] = [];

      for (const a of areas) {
        const areaProjs = projectsWithRollups
          .filter((p) => p.project.focusAreaId === a.id)
          .sort((x, y) =>
            x.project.id.localeCompare(y.project.id, undefined, { numeric: true }),
          );
        const allAreaTasks = areaProjs.flatMap((p) => tasksByProject.get(p.project.id) ?? []);
        const areaPct = allAreaTasks.length
          ? Math.round(
              allAreaTasks.reduce((s, t) => s + t.percentComplete, 0) / allAreaTasks.length,
            )
          : 0;
        const initRow = ws.addRow({
          name: `▸ ${a.name}`,
          owner: "",
          status: `${areaProjs.length} tactics`,
          priority: "",
          due: "",
          completed: "",
          pct: areaPct / 100,
          notes: targetByArea.get(a.id)?.goalText ?? "",
        });
        initRow.outlineLevel = 0;
        styleInitiativeBand(initRow);
        initRow.getCell("pct").numFmt = "0%";

        for (const { project, rollup } of areaProjs) {
          const ownerName = project.executiveOwnerId
            ? displayNameFor(userById.get(project.executiveOwnerId)!) ?? ""
            : "";
          const tacticRow = ws.addRow({
            name: `    ${project.id} · ${project.name}`,
            owner: ownerName,
            status: rollup.status,
            priority: "",
            due: "",
            completed: "",
            pct: rollup.percentComplete / 100,
            notes: project.strategicGoal ?? "",
          });
          tacticRow.outlineLevel = 1;
          styleTacticBand(tacticRow);
          tacticRow.getCell("pct").numFmt = "0%";
          colorByStatus(tacticRow.getCell("status"), rollup.status);

          const projTasks = (tasksByProject.get(project.id) ?? [])
            .slice()
            .sort((x, y) => (x.dueDate ?? "9999").localeCompare(y.dueDate ?? "9999"));
          for (const t of projTasks) {
            const assignee = userById.get(t.assigneeId)
              ? displayNameFor(userById.get(t.assigneeId)!)
              : t.assigneeId;
            const completedOn = t.completedAt ? t.completedAt.toISOString().slice(0, 10) : "";
            const notesBits: string[] = [];
            if (t.blockNotes) notesBits.push(`Blocker: ${t.blockNotes}`);
            if (t.roadblock) notesBits.push(`Roadblock: ${t.roadblock}`);
            if (t.nextStep) notesBits.push(`Next: ${t.nextStep}`);
            const taskRow = ws.addRow({
              name: `        ${t.description}`,
              owner: assignee,
              status: t.status,
              priority: t.priority,
              due: t.dueDate ?? "",
              completed: completedOn,
              pct: t.percentComplete / 100,
              notes: notesBits.join(" • "),
            });
            taskRow.outlineLevel = 2;
            taskRow.getCell("pct").numFmt = "0%";
            taskRow.getCell("pct").alignment = { horizontal: "center" };
            colorByStatus(taskRow.getCell("status"), t.status);
            if (isOverdue(t)) overdueRows.push(taskRow.number);
            dataBarRanges.push(`G${taskRow.number}`);
          }
        }
      }

      const lastRow = ws.rowCount;
      if (lastRow >= 2) {
        ws.addConditionalFormatting({ ref: `G2:G${lastRow}`, rules: [dataBarRule("FF6366F1")] });
      }
      for (const rn of overdueRows) {
        const cell = ws.getCell(`E${rn}`);
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFB91C1C" } };
      }

      // Body alignment without overriding band fills — only on outlineLevel 2 (task rows)
      for (let r = 2; r <= lastRow; r++) {
        const row = ws.getRow(r);
        if (row.outlineLevel !== 2) continue;
        row.eachCell({ includeEmpty: false }, (cell) => {
          if (!cell.font) cell.font = { name: "Calibri", size: 10 };
          cell.alignment = { vertical: "middle", wrapText: true, ...cell.alignment };
        });
      }

      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } };
      setLandscapePrint(ws, "Drill-Down — Initiatives, Tactics, Tasks");
    }

    // ===== Sheet 4: Tasks Completed (Last 30 Days) =====
    {
      const ws = wb.addWorksheet("Tasks Completed (30d)", {
        properties: { tabColor: { argb: "FF10B981" } },
      });
      ws.columns = [
        { header: "Completed On", key: "completedOn", width: 14 },
        { header: "Tactic", key: "tactic", width: 12 },
        { header: "Tactic Name", key: "tacticName", width: 38 },
        { header: "Initiative", key: "initiative", width: 30 },
        { header: "Assignee", key: "assignee", width: 22 },
        { header: "Role", key: "role", width: 12 },
        { header: "Description", key: "description", width: 60 },
        { header: "Priority", key: "priority", width: 11 },
        { header: "Due Date", key: "due", width: 12 },
        { header: "Days vs. Due", key: "delta", width: 14 },
      ];
      const projectById = new Map(projects.map((p) => [p.id, p]));
      for (const t of completedRecent) {
        const proj = projectById.get(t.projectId);
        const initiative = proj ? areaById.get(proj.focusAreaId)?.name ?? "" : "";
        const delta =
          t.dueDate && t.completedAt
            ? Math.round((t.completedAt.getTime() - new Date(t.dueDate).getTime()) / 86400000)
            : null;
        ws.addRow({
          completedOn: t.completedAt!.toISOString().slice(0, 10),
          tactic: t.projectId,
          tacticName: proj?.name ?? "",
          initiative,
          assignee: userById.get(t.assigneeId) ? displayNameFor(userById.get(t.assigneeId)!) : "",
          role: t.role,
          description: t.description,
          priority: t.priority,
          due: t.dueDate ?? "",
          delta: delta === null ? "" : delta <= 0 ? `${-delta} early` : `${delta} late`,
        });
      }
      styleHeaderRow(ws, 1);
      applyBodyStyle(ws);

      const lastRow = ws.rowCount;
      if (lastRow >= 2) {
        ws.addConditionalFormatting({
          ref: `J2:J${lastRow}`,
          rules: [
            {
              type: "containsText",
              operator: "containsText",
              text: "late",
              priority: 1,
              style: {
                font: { bold: true, color: { argb: "FFB91C1C" } },
                fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFEE2E2" } },
              },
            },
            {
              type: "containsText",
              operator: "containsText",
              text: "early",
              priority: 2,
              style: {
                font: { bold: true, color: { argb: "FF15803D" } },
                fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFDCFCE7" } },
              },
            },
          ],
        });
      }
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 10 } };
      autoWidthFromHeaders(ws);
      setLandscapePrint(ws, "Tasks Completed — Last 30 Days");
    }

    // ===== Sheet 5: Weekly KPI Breakdown =====
    {
      const breakdownWeeks = Array.from({ length: 6 }, (_, i) => priorMonday(5 - i));
      const ws = wb.addWorksheet("Weekly KPI Breakdown", {
        properties: { tabColor: { argb: "FFF59E0B" } },
      });
      ws.columns = [
        { header: "Metric", key: "metric", width: 32 },
        { header: "Developer", key: "user", width: 22 },
        { header: "Target/wk", key: "target", width: 11 },
        ...breakdownWeeks.map((w, i) => ({ header: `Wk ${i + 1} (${w})`, key: `w${i}`, width: 15 })),
        { header: "6-wk Total", key: "total", width: 12 },
        { header: "6-wk Target", key: "totalTarget", width: 12 },
        { header: "% of Target", key: "pct", width: 13 },
      ];
      const entriesByKey = new Map(
        entries.map((e) => [`${e.metricId}|${e.userId}|${e.periodStart}`, e]),
      );
      const teamRowNumbers: number[] = [];
      for (const m of metrics) {
        const applicable = users.filter((u) =>
          m.appliesTo === "developers" ? u.role === "member" || u.role === "lead" : true,
        );
        for (const u of applicable.sort((a, b) =>
          displayNameFor(a).localeCompare(displayNameFor(b)),
        )) {
          const counts = breakdownWeeks.map(
            (w) => entriesByKey.get(`${m.id}|${u.id}|${w}`)?.count ?? 0,
          );
          const total = counts.reduce((s, c) => s + c, 0);
          const totalTarget = m.targetCount * breakdownWeeks.length;
          const row: Record<string, string | number> = {
            metric: m.name,
            user: displayNameFor(u),
            target: m.targetCount,
            total,
            totalTarget,
            pct: totalTarget ? total / totalTarget : 0,
          };
          counts.forEach((c, i) => {
            row[`w${i}`] = c;
          });
          ws.addRow(row);
        }
        const teamCounts = breakdownWeeks.map((w) =>
          applicable.reduce(
            (s, u) => s + (entriesByKey.get(`${m.id}|${u.id}|${w}`)?.count ?? 0),
            0,
          ),
        );
        const teamTotal = teamCounts.reduce((s, c) => s + c, 0);
        const teamTotalTarget = m.targetCount * applicable.length * breakdownWeeks.length;
        const teamRow: Record<string, string | number> = {
          metric: m.name,
          user: "TEAM TOTAL",
          target: m.targetCount * applicable.length,
          total: teamTotal,
          totalTarget: teamTotalTarget,
          pct: teamTotalTarget ? teamTotal / teamTotalTarget : 0,
        };
        teamCounts.forEach((c, i) => {
          teamRow[`w${i}`] = c;
        });
        const added = ws.addRow(teamRow);
        teamRowNumbers.push(added.number);
      }
      styleHeaderRow(ws, 1);
      applyBodyStyle(ws);

      const lastRow = ws.rowCount;
      const pctCol = String.fromCharCode("A".charCodeAt(0) + ws.columns.length - 1);
      for (let r = 2; r <= lastRow; r++) {
        ws.getCell(`${pctCol}${r}`).numFmt = "0%";
        ws.getCell(`${pctCol}${r}`).alignment = { horizontal: "center" };
      }
      if (lastRow >= 2) {
        ws.addConditionalFormatting({
          ref: `${pctCol}2:${pctCol}${lastRow}`,
          rules: [dataBarRule("FF10B981")],
        });
      }
      for (const rn of teamRowNumbers) {
        const row = ws.getRow(rn);
        row.eachCell({ includeEmpty: false }, (cell) => {
          cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: BRAND.dark } };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE8EDF4" },
          };
        });
      }
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
      autoWidthFromHeaders(ws);
      setLandscapePrint(ws, "Weekly KPI Breakdown — 6-Week Rolling");
    }

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `franchise-dev-board-update-${generatedAt.toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  },
);

// Flat snapshot retained for backwards compat
router.get(
  "/reports/snapshot",
  requireAuth,
  requirePermission("run_reports"),
  async (_req: Request, res: Response) => {
    const [users, projects, tasks, areas] = await Promise.all([
      db.select().from(usersTable),
      db.select().from(projectsTable),
      db.select().from(tasksTable),
      db.select().from(focusAreasTable),
    ]);
    const totalTasks = tasks.length;
    const complete = tasks.filter((t) => t.status === "Complete").length;
    const blocked = tasks.filter((t) => t.status === "Blocked").length;
    const overdue = tasks.filter((t) => {
      if (!t.dueDate || t.status === "Complete") return false;
      return new Date(t.dueDate) < new Date();
    }).length;
    const byArea = areas
      .map((a) => {
        const projs = projects.filter((p) => p.focusAreaId === a.id);
        const projTasks = tasks.filter((t) => projs.some((p) => p.id === t.projectId));
        const pct =
          projTasks.length === 0
            ? 0
            : Math.round(
                projTasks.reduce((s, t) => s + t.percentComplete, 0) / projTasks.length,
              );
        return {
          focusAreaId: a.id,
          focusAreaName: a.name,
          projectCount: projs.length,
          taskCount: projTasks.length,
          percentComplete: pct,
        };
      })
      .sort((a, b) => a.focusAreaName.localeCompare(b.focusAreaName));

    res.json({
      generatedAt: new Date().toISOString(),
      totals: {
        users: users.length,
        projects: projects.length,
        tasks: totalTasks,
        complete,
        blocked,
        overdue,
        avgCompletion:
          tasks.length === 0
            ? 0
            : Math.round(tasks.reduce((s, t) => s + t.percentComplete, 0) / tasks.length),
      },
      byFocusArea: byArea,
    });
  },
);

// Drill-down tree: focus area → projects → tasks
router.get(
  "/reports/tree",
  requireAuth,
  requirePermission("view_reports"),
  async (_req: Request, res: Response) => {
    const [users, areas, targets, projects, tasks] = await Promise.all([
      db.select().from(usersTable),
      db.select().from(focusAreasTable).orderBy(asc(focusAreasTable.sortOrder)),
      db.select().from(focusAreaTargetsTable),
      db.select().from(projectsTable),
      db.select().from(tasksTable),
    ]);
    const userById = new Map(users.map((u) => [u.id, u]));
    const targetByArea = new Map(targets.map((t) => [t.focusAreaId, t]));
    const attachmentsByTask = await loadAttachmentsByTask(tasks.map((t) => t.id));
    const userLookup = new Map(
      users.map((u) => [u.id, { id: u.id, name: displayNameFor(u), avatarColor: u.avatarColor }]),
    );

    const tasksByProject = new Map<string, Task[]>();
    for (const t of tasks) {
      const arr = tasksByProject.get(t.projectId) ?? [];
      arr.push(t);
      tasksByProject.set(t.projectId, arr);
    }

    const totals = {
      projects: projects.length,
      tasks: tasks.length,
      complete: tasks.filter((t) => t.status === "Complete").length,
      blocked: tasks.filter((t) => t.status === "Blocked").length,
      overdue: tasks.filter(isOverdue).length,
      avgCompletion: tasks.length
        ? Math.round(tasks.reduce((s, t) => s + t.percentComplete, 0) / tasks.length)
        : 0,
    };

    const focusAreaNodes = areas.map((a) => {
      const areaProjects = projects.filter((p) => p.focusAreaId === a.id);
      const projectNodes = areaProjects
        .map((p) => {
          const pt = tasksByProject.get(p.id) ?? [];
          const rollup = computeProjectRollup(pt);
          return {
            id: p.id,
            name: p.name,
            executiveOwnerName: p.executiveOwnerId
              ? displayNameFor(userById.get(p.executiveOwnerId)!) ?? null
              : null,
            strategicGoal: p.strategicGoal,
            status: rollup.status,
            healthColor: rollup.healthColor,
            percentComplete: rollup.percentComplete,
            taskCount: rollup.taskCount,
            overdueCount: rollup.overdueCount,
            blockedCount: rollup.blockedCount,
            tasks: pt
              .slice()
              .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
              .map((t) => ({
                id: t.id,
                description: t.description,
                assigneeId: t.assigneeId,
                assigneeName: userById.get(t.assigneeId)
                  ? displayNameFor(userById.get(t.assigneeId)!)
                  : t.assigneeId,
                status: t.status,
                priority: t.priority,
                percentComplete: t.percentComplete,
                dueDate: t.dueDate,
                isOverdue: isOverdue(t),
                completedAt: t.completedAt ? t.completedAt.toISOString() : null,
                blockNotes: t.blockNotes ?? null,
                attachments: (attachmentsByTask.get(t.id) ?? []).map((a) =>
                  serializeAttachment(a, userLookup),
                ),
              })),
          };
        })
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

      const allAreaTasks = areaProjects.flatMap((p) => tasksByProject.get(p.id) ?? []);
      const pct = allAreaTasks.length
        ? Math.round(allAreaTasks.reduce((s, t) => s + t.percentComplete, 0) / allAreaTasks.length)
        : 0;
      const target = targetByArea.get(a.id);
      return {
        focusAreaId: a.id,
        focusAreaName: a.name,
        percentComplete: pct,
        projectCount: areaProjects.length,
        taskCount: allAreaTasks.length,
        overdueCount: allAreaTasks.filter(isOverdue).length,
        target: target
          ? {
              focusAreaId: target.focusAreaId,
              focusAreaName: a.name,
              goalText: target.goalText,
              targetNumeric: target.targetNumeric,
              currentNumeric: target.currentNumeric,
              unitLabel: target.unitLabel,
              updatedByName: null,
              updatedAt: target.updatedAt,
            }
          : null,
        projects: projectNodes,
      };
    });

    res.json({
      generatedAt: new Date().toISOString(),
      totals,
      focusAreas: focusAreaNodes,
    });
  },
);

// VP/admin Weekly KPI breakdown with 6-week sparklines
router.get(
  "/reports/kpi-breakdown",
  requireAuth,
  requirePermission("run_reports"),
  async (req: Request, res: Response) => {
    const requested = typeof req.query.weekStart === "string" ? req.query.weekStart : null;
    const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
    const currentWeekStart =
      requested && isValidDate(requested) ? mondayOf(new Date(`${requested}T00:00:00Z`)) : mondayOf(new Date());
    // Build 6-week window ending at currentWeekStart (oldest first)
    const baseDate = new Date(`${currentWeekStart}T00:00:00Z`);
    const weeks = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(baseDate);
      d.setUTCDate(d.getUTCDate() - (5 - i) * 7);
      return mondayOf(d);
    });
    const [users, metrics, entries] = await Promise.all([
      db.select().from(usersTable),
      db.select().from(recurringMetricsTable),
      db.select().from(metricEntriesTable),
    ]);

    const entriesByKey = new Map(
      entries.map((e) => [`${e.metricId}|${e.userId}|${e.periodStart}`, e]),
    );

    const metricBreakdowns = metrics.map((m) => {
      const applicable = users.filter((u) => {
        if (m.appliesTo === "developers") return u.role === "member" || u.role === "lead";
        return true;
      });
      const rows = applicable.map((u) => {
        const current = entriesByKey.get(`${m.id}|${u.id}|${currentWeekStart}`);
        const sparkline = weeks.map(
          (w) => entriesByKey.get(`${m.id}|${u.id}|${w}`)?.count ?? 0,
        );
        return {
          userId: u.id,
          userName: displayNameFor(u),
          avatarColor: u.avatarColor,
          count: current?.count ?? 0,
          target: m.targetCount,
          source: current?.source ?? "manual",
          isSelfReported: !!current && current.source === "manual",
          lastEvidenceNote: current?.lastEvidenceNote ?? null,
          sparkline,
        };
      });
      const totalActual = rows.reduce((s, r) => s + r.count, 0);
      const totalTarget = rows.length * m.targetCount;
      return {
        metricId: m.id,
        metricName: m.name,
        target: m.targetCount,
        weekStart: currentWeekStart,
        totalActual,
        totalTarget,
        rows: rows.sort((a, b) => a.userName.localeCompare(b.userName)),
      };
    });

    res.json({
      generatedAt: new Date().toISOString(),
      currentWeekStart,
      weeks,
      metrics: metricBreakdowns,
    });
  },
);

// Board Brief — server-rendered print HTML the client downloads/prints to PDF
router.get(
  "/reports/board-brief",
  requireAuth,
  requirePermission("run_reports"),
  async (_req: Request, res: Response) => {
    const [users, areas, targets, projects, tasks, metrics, entries] = await Promise.all([
      db.select().from(usersTable),
      db.select().from(focusAreasTable).orderBy(asc(focusAreasTable.sortOrder)),
      db.select().from(focusAreaTargetsTable),
      db.select().from(projectsTable),
      db.select().from(tasksTable),
      db.select().from(recurringMetricsTable),
      db.select().from(metricEntriesTable),
    ]);
    const userById = new Map(users.map((u) => [u.id, u]));
    const targetByArea = new Map(targets.map((t) => [t.focusAreaId, t]));
    const tasksByProject = new Map<string, Task[]>();
    for (const t of tasks) {
      const arr = tasksByProject.get(t.projectId) ?? [];
      arr.push(t);
      tasksByProject.set(t.projectId, arr);
    }
    const week = mondayOf(new Date());
    const entriesByKey = new Map(
      entries.map((e) => [`${e.metricId}|${e.userId}|${e.periodStart}`, e]),
    );

    const esc = (s: unknown) =>
      String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

    let body = "";
    body += `<header class="brief-header"><div><h1>Franchise Development OS — Board Readiness Brief</h1><p class="subtitle">Generated ${new Date().toLocaleString()}</p></div></header>`;

    // Portfolio totals
    const totalComplete = tasks.filter((t) => t.status === "Complete").length;
    const totalOverdue = tasks.filter(isOverdue).length;
    const totalBlocked = tasks.filter((t) => t.status === "Blocked").length;
    const avgPct = tasks.length ? Math.round(tasks.reduce((s, t) => s + t.percentComplete, 0) / tasks.length) : 0;
    body += `<section class="totals"><h2>Portfolio at a glance</h2><div class="metric-grid">
      <div class="metric-card"><div class="num">${projects.length}</div><div class="lbl">Tactics</div></div>
      <div class="metric-card"><div class="num">${tasks.length}</div><div class="lbl">Tasks</div></div>
      <div class="metric-card"><div class="num">${avgPct}%</div><div class="lbl">Avg completion</div></div>
      <div class="metric-card"><div class="num ${totalOverdue ? "danger" : ""}">${totalOverdue}</div><div class="lbl">Overdue</div></div>
      <div class="metric-card"><div class="num ${totalBlocked ? "danger" : ""}">${totalBlocked}</div><div class="lbl">Blocked</div></div>
      <div class="metric-card"><div class="num">${totalComplete}</div><div class="lbl">Complete</div></div>
    </div></section>`;

    // Each focus area
    for (const a of areas) {
      const t = targetByArea.get(a.id);
      const areaProjects = projects.filter((p) => p.focusAreaId === a.id);
      const allAreaTasks = areaProjects.flatMap((p) => tasksByProject.get(p.id) ?? []);
      const pct = allAreaTasks.length
        ? Math.round(allAreaTasks.reduce((s, x) => s + x.percentComplete, 0) / allAreaTasks.length)
        : 0;
      const targetPct = t && t.targetNumeric ? Math.round((t.currentNumeric / t.targetNumeric) * 100) : null;
      body += `<section class="area"><h2>${esc(a.name)}</h2>`;
      if (t) {
        body += `<div class="target-row"><strong>Goal:</strong> ${esc(t.goalText)} &nbsp;<strong>Progress:</strong> ${t.currentNumeric}${t.targetNumeric ? ` / ${t.targetNumeric}` : ""} ${esc(t.unitLabel)} ${targetPct !== null ? `(${targetPct}%)` : ""}</div>`;
      }
      body += `<div class="area-stats">${areaProjects.length} tactics · ${allAreaTasks.length} tasks · ${pct}% complete</div>`;
      for (const p of areaProjects.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))) {
        const pt = (tasksByProject.get(p.id) ?? []).slice().sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
        const r = computeProjectRollup(pt);
        const owner = p.executiveOwnerId ? displayNameFor(userById.get(p.executiveOwnerId)!) : "";
        body += `<div class="proj-block"><div class="proj-head"><span class="proj-code">${esc(p.id)}</span> <strong>${esc(p.name)}</strong> — ${esc(owner)} · ${esc(r.status)} · ${r.percentComplete}% · ${r.taskCount} tasks${r.overdueCount ? ` · <span class="danger">${r.overdueCount} overdue</span>` : ""}</div>`;
        if (pt.length === 0) {
          body += `<div class="muted task-empty">No tasks.</div>`;
        } else {
          body += `<table class="task-table"><thead><tr><th>Description</th><th>Assignee</th><th>Status</th><th>%</th><th>Due</th><th>Completed</th><th>Blocker notes</th></tr></thead><tbody>`;
          for (const t of pt) {
            const assignee = userById.get(t.assigneeId) ? displayNameFor(userById.get(t.assigneeId)!) : t.assigneeId;
            const overdue = isOverdue(t);
            const completed = t.completedAt ? t.completedAt.toISOString().slice(0, 10) : "—";
            body += `<tr><td>${esc(t.description)}</td><td>${esc(assignee)}</td><td>${esc(t.status)}</td><td>${t.percentComplete}%</td><td class="${overdue ? "danger" : ""}">${esc(t.dueDate ?? "—")}</td><td>${esc(completed)}</td><td class="muted">${esc(t.blockNotes ?? "")}</td></tr>`;
          }
          body += `</tbody></table>`;
        }
        body += `</div>`;
      }
      body += `</section>`;
    }

    // KPI breakdown
    body += `<section class="kpis"><h2>Weekly KPI scorecard — Week of ${week}</h2>`;
    for (const m of metrics) {
      body += `<h3>${esc(m.name)} <span class="muted">(target ${m.targetCount}/wk)</span></h3>`;
      body += `<table class="kpi-table"><thead><tr><th>Developer</th><th>Count</th><th>Target</th><th>Status</th><th>Source</th></tr></thead><tbody>`;
      const applicable = users.filter((u) =>
        m.appliesTo === "developers" ? u.role === "member" || u.role === "lead" : true,
      );
      for (const u of applicable.sort((a, b) => displayNameFor(a).localeCompare(displayNameFor(b)))) {
        const e = entriesByKey.get(`${m.id}|${u.id}|${week}`);
        const count = e?.count ?? 0;
        const onTarget = count >= m.targetCount;
        body += `<tr><td>${esc(displayNameFor(u))}</td><td>${count}</td><td>${m.targetCount}</td><td class="${onTarget ? "ok" : "danger"}">${onTarget ? "✓ On target" : "Behind"}</td><td>${esc(e?.source ?? "—")}</td></tr>`;
      }
      body += `</tbody></table>`;
    }
    body += `</section>`;

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Board Readiness Brief</title>
<style>
  @media print {
    @page { size: letter; margin: 0.5in; }
    .no-print { display: none; }
    section { page-break-inside: avoid; }
  }
  body { font-family: Georgia, 'Iowan Old Style', serif; color: #1c1917; margin: 24px; line-height: 1.4; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  h2 { font-size: 18px; margin: 24px 0 8px; border-bottom: 2px solid #1c1917; padding-bottom: 4px; }
  h3 { font-size: 14px; margin: 16px 0 6px; }
  .brief-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px double #1c1917; padding-bottom: 12px; }
  .subtitle { color: #6b7280; margin: 0; font-size: 12px; }
  .metric-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
  .metric-card { border: 1px solid #d6d3d1; padding: 10px; border-radius: 4px; text-align: center; }
  .metric-card .num { font-size: 24px; font-weight: bold; }
  .metric-card .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0; }
  th, td { border: 1px solid #e7e5e4; padding: 6px 8px; text-align: left; }
  th { background: #f5f5f4; }
  .target-row { font-size: 12px; margin: 6px 0; }
  .area-stats { font-size: 11px; color: #6b7280; margin-bottom: 6px; }
  .danger { color: #b91c1c; font-weight: bold; }
  .ok { color: #15803d; font-weight: bold; }
  .muted { color: #6b7280; font-weight: normal; font-size: 11px; }
  .print-btn { position: fixed; top: 16px; right: 16px; padding: 8px 14px; background: #1c1917; color: #fff; border: 0; border-radius: 4px; cursor: pointer; font-size: 12px; }
</style></head><body><button class="print-btn no-print" onclick="window.print()">Print to PDF</button>${body}</body></html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  },
);

export default router;
