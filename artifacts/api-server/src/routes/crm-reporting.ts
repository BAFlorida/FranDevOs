import { Router, type IRouter, type Request, type Response } from "express";
import { CreateReportDefinitionBody, RunReportBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/permissions";
import { reportingService } from "../integrations";
import type { ReportSpec } from "../integrations/reportingService";

const router: IRouter = Router();

router.get("/reports/definitions", requireAuth, async (_req: Request, res: Response) => {
  const definitions = await reportingService.listDefinitions();
  res.json(definitions);
});

router.post("/reports/definitions", requireAuth, async (req: Request, res: Response) => {
  const parsed = CreateReportDefinitionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid report definition" });
    return;
  }
  const definition = await reportingService.createDefinition({
    name: parsed.data.name,
    spec: parsed.data.spec as ReportSpec,
    createdById: req.appUser?.id ?? null,
  });
  res.status(201).json(definition);
});

router.post("/reports/run", requireAuth, async (req: Request, res: Response) => {
  const parsed = RunReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid report spec" });
    return;
  }
  const result = await reportingService.runReport(parsed.data as ReportSpec);
  res.json(result);
});

export default router;
