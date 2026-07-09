import { Router, type IRouter, type Request, type Response } from "express";
import { RefreshIntegrationBody } from "@workspace/api-zod";
import { requireAuth, requirePermission } from "../lib/permissions";
import { getAdapters, getAdapter, type CrmSource } from "../integrations";

const router: IRouter = Router();

// GET /integrations/status — connection cards: per-source status, last sync,
// objects synced, and recent sync events.
router.get(
  "/integrations/status",
  requireAuth,
  async (_req: Request, res: Response) => {
    const cards = await Promise.all(getAdapters().map((a) => a.getConnectionCard()));
    res.json(cards);
  },
);

// POST /integrations/refresh — mock "refresh from source": bumps
// syncedAt/lastSyncAt and writes a sync event. No external CRM call.
router.post(
  "/integrations/refresh",
  requireAuth,
  requirePermission("manage_integrations"),
  async (req: Request, res: Response) => {
    const parsed = RefreshIntegrationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    if (parsed.data.source !== "salesforce" && parsed.data.source !== "hubspot") {
      res.status(404).json({ error: "Connection not found" });
      return;
    }
    const source: CrmSource = parsed.data.source;
    const card = await getAdapter(source).refresh();
    res.json(card);
  },
);

export default router;
