import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  tasksTable,
  crmTaskLinksTable,
  CRM_STAGE_VOCABULARY,
} from "@workspace/db";
import {
  ListCrmOpportunitiesQueryParams,
  GetCrmOpportunityParams,
  GetCrmPipelineQueryParams,
  ListCrmCampaignsQueryParams,
  ListCrmEmailActivityQueryParams,
  CreateLinkedTaskBody,
  GetTaskResponse,
} from "@workspace/api-zod";
import { requireAuth, hasPermission } from "../lib/permissions";
import { getAdapters, type CrmSource } from "../integrations";
import { linkedRecordExists } from "../integrations/canonicalStore";
import { loadUserLookup, loadProjectLookup, serializeTask } from "../lib/enrich";

const router: IRouter = Router();

// Adapters only exist for real external sources. `internal` has no adapter, so
// it is treated as "no source filter applies to an adapter".
function adapterSource(source?: string): CrmSource | undefined {
  return source === "salesforce" || source === "hubspot" ? source : undefined;
}

function toDateString(d: unknown): string | null {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return null;
}

// GET /crm/opportunities — filter by source + canonical stage, paginated.
router.get("/crm/opportunities", requireAuth, async (req: Request, res: Response) => {
  const parsed = ListCrmOpportunitiesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  const { source, stageCanonical, page, pageSize } = parsed.data;
  const adapterSrc = adapterSource(source);
  const results = await Promise.all(
    getAdapters(adapterSrc).map((a) => a.listOpportunities({ stageCanonical })),
  );
  const all = results.flat();
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const rows = all.slice(start, start + pageSize);
  res.json({ rows, pagination: { page, pageSize, total, totalPages } });
});

// GET /crm/opportunities/:id — drill-down detail including rawPayload. This is
// the single "fetch live from source" seam; probe each adapter until one
// resolves the opportunity by id.
router.get(
  "/crm/opportunities/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = GetCrmOpportunityParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid path parameters" });
      return;
    }
    for (const adapter of getAdapters()) {
      const opportunity = await adapter.getOpportunity(parsed.data.id);
      if (opportunity) {
        res.json(opportunity);
        return;
      }
    }
    res.status(404).json({ error: "Opportunity not found" });
  },
);

// GET /crm/pipeline — sum amount + count per canonical stage.
router.get("/crm/pipeline", requireAuth, async (req: Request, res: Response) => {
  const parsed = GetCrmPipelineQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  const adapterSrc = adapterSource(parsed.data.source);
  const results = await Promise.all(
    getAdapters(adapterSrc).map((a) => a.listOpportunities()),
  );
  const opportunities = results.flat();

  const byStage = new Map<string, { value: number; count: number }>();
  for (const stage of CRM_STAGE_VOCABULARY) {
    byStage.set(stage, { value: 0, count: 0 });
  }
  for (const opp of opportunities) {
    const bucket = byStage.get(opp.stageCanonical) ?? { value: 0, count: 0 };
    bucket.value += opp.amount != null ? Number(opp.amount) : 0;
    bucket.count += 1;
    byStage.set(opp.stageCanonical, bucket);
  }
  // Return in canonical funnel order.
  const pipeline = CRM_STAGE_VOCABULARY.map((stage) => ({
    stage,
    value: byStage.get(stage)!.value,
    count: byStage.get(stage)!.count,
  }));
  res.json(pipeline);
});

// GET /crm/campaigns — canonical marketing campaigns.
router.get("/crm/campaigns", requireAuth, async (req: Request, res: Response) => {
  const parsed = ListCrmCampaignsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  const adapterSrc = adapterSource(parsed.data.source);
  const results = await Promise.all(getAdapters(adapterSrc).map((a) => a.listCampaigns()));
  res.json(results.flat());
});

// GET /crm/email-activity — canonical marketing email activity.
router.get(
  "/crm/email-activity",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = ListCrmEmailActivityQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }
    const adapterSrc = adapterSource(parsed.data.source);
    const results = await Promise.all(
      getAdapters(adapterSrc).map((a) =>
        a.listEmailActivity({ campaignId: parsed.data.campaignId }),
      ),
    );
    res.json(results.flat());
  },
);

// POST /crm/linked-tasks — create a follow-up task in the existing task module
// and link it to a CRM record, without modifying the tasks contract.
router.post("/crm/linked-tasks", requireAuth, async (req: Request, res: Response) => {
  const parsed = CreateLinkedTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.format() });
    return;
  }
  const d = parsed.data;
  const me = req.appUser!;

  // Authz parity with POST /tasks: members may only create tasks for themselves.
  if (me.role === "member" && d.assigneeId !== me.id) {
    res.status(403).json({ error: "Members can only create tasks for themselves" });
    return;
  }

  const exists = await linkedRecordExists(d.sourceSystem, d.recordType, d.recordId);
  if (!exists) {
    res.status(404).json({ error: "Linked CRM record not found" });
    return;
  }

  // Only managers may mark a task Complete outright; others go to Pending Review.
  let createStatus: string = d.status;
  if (createStatus === "Complete" && !hasPermission(me, "approve_completion")) {
    createStatus = "Pending Review";
  }

  const [task] = await db
    .insert(tasksTable)
    .values({
      projectId: d.projectId,
      assigneeId: d.assigneeId,
      role: d.role,
      description: d.description,
      priority: d.priority,
      status: createStatus,
      percentComplete: d.percentComplete,
      startDate: toDateString(d.startDate),
      dueDate: toDateString(d.dueDate),
      nextStep: d.nextStep ?? null,
      completedAt: createStatus === "Complete" ? new Date() : null,
    })
    .returning();

  const [link] = await db
    .insert(crmTaskLinksTable)
    .values({
      taskId: task!.id,
      sourceSystem: d.sourceSystem,
      recordType: d.recordType,
      recordId: d.recordId,
    })
    .returning();

  const users = await loadUserLookup();
  const projects = await loadProjectLookup();
  res.status(201).json({
    task: GetTaskResponse.parse(serializeTask(task!, users, projects, [])),
    link,
  });
});

export default router;
