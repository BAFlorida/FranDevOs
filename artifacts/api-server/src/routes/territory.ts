import { Router, type IRouter, type Request, type Response } from "express";
import { db, crmTerritoryLeadsTable } from "@workspace/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  SearchTerritoryPlacesBody,
  ListTerritoryLeadsQueryParams,
  ImportTerritoryLeadsBody,
  UpdateTerritoryLeadParams,
  UpdateTerritoryLeadBody,
  DeleteTerritoryLeadParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/permissions";
import {
  searchPlaces,
  deriveTier,
  isGooglePlacesConfigured,
  GooglePlacesNotConfiguredError,
  GooglePlacesRequestError,
} from "../integrations/googlePlaces";

const router: IRouter = Router();

// POST /crm/territory/search — proxy a Google Places text search so the key
// stays server-side. Results are returned normalized + flagged when already in
// the lead list; nothing is persisted until an explicit import.
router.post("/crm/territory/search", requireAuth, async (req: Request, res: Response) => {
  const parsed = SearchTerritoryPlacesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  if (!isGooglePlacesConfigured()) {
    res.status(503).json({
      error:
        "Google Places search is not configured. Set GOOGLE_MAPS_API_KEY on the API server.",
    });
    return;
  }
  try {
    const result = await searchPlaces({
      query: parsed.data.query,
      pageToken: parsed.data.pageToken,
    });

    // Flag places that are already saved so the UI can show membership.
    const placeIds = result.places.map((p) => p.placeId);
    const existing =
      placeIds.length === 0
        ? []
        : await db
            .select({ sourceRecordId: crmTerritoryLeadsTable.sourceRecordId })
            .from(crmTerritoryLeadsTable)
            .where(
              and(
                eq(crmTerritoryLeadsTable.sourceSystem, "google_places"),
                inArray(crmTerritoryLeadsTable.sourceRecordId, placeIds),
              ),
            );
    const imported = new Set(existing.map((r) => r.sourceRecordId));

    res.json({
      places: result.places.map(({ rawPayload: _raw, ...place }) => ({
        ...place,
        alreadyImported: imported.has(place.placeId),
      })),
      nextPageToken: result.nextPageToken,
    });
  } catch (err) {
    if (err instanceof GooglePlacesNotConfiguredError) {
      res.status(503).json({ error: err.message });
      return;
    }
    if (err instanceof GooglePlacesRequestError) {
      res.status(502).json({ error: `Google Places search failed: ${err.message}` });
      return;
    }
    throw err;
  }
});

// GET /crm/territory-leads — the saved target-customer list, hottest first.
router.get("/crm/territory-leads", requireAuth, async (req: Request, res: Response) => {
  const parsed = ListTerritoryLeadsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  const { tier, source } = parsed.data;
  const filters = [
    tier ? eq(crmTerritoryLeadsTable.tier, tier) : undefined,
    source ? eq(crmTerritoryLeadsTable.sourceSystem, source) : undefined,
  ].filter((f): f is NonNullable<typeof f> => f != null);

  const rows = await db
    .select()
    .from(crmTerritoryLeadsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(
      asc(crmTerritoryLeadsTable.tier),
      sql`${crmTerritoryLeadsTable.rating} DESC NULLS LAST`,
      asc(crmTerritoryLeadsTable.name),
    );
  res.json(rows);
});

// POST /crm/territory-leads/import — bulk-save search results as canonical
// rows with google_places provenance. Dedup on (sourceSystem, sourceRecordId):
// re-importing an existing place is a skip, never a duplicate. rawPayload
// stores the normalized place the client submitted (the server does not
// re-fetch from Google on import).
router.post(
  "/crm/territory-leads/import",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = ImportTerritoryLeadsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.format() });
      return;
    }

    // Drop same-batch duplicates so `skipped` counts only places already saved.
    const byPlaceId = new Map(parsed.data.places.map((p) => [p.placeId, p]));
    const places = [...byPlaceId.values()];

    const inserted = await db
      .insert(crmTerritoryLeadsTable)
      .values(
        places.map((p) => ({
          sourceSystem: "google_places",
          sourceRecordId: p.placeId,
          rawPayload: p,
          name: p.name,
          category: p.category ?? null,
          address: p.address ?? null,
          phone: p.phone ?? null,
          website: p.website ?? null,
          latitude: p.latitude,
          longitude: p.longitude,
          rating: p.rating ?? null,
          ratingCount: p.ratingCount ?? null,
          businessStatus: p.businessStatus ?? null,
          tier: p.tier ?? deriveTier(p.rating, p.ratingCount),
          searchQuery: p.searchQuery ?? null,
        })),
      )
      .onConflictDoNothing({
        target: [crmTerritoryLeadsTable.sourceSystem, crmTerritoryLeadsTable.sourceRecordId],
      })
      .returning();

    res.status(201).json({
      imported: inserted.length,
      skipped: places.length - inserted.length,
      leads: inserted,
    });
  },
);

// PATCH /crm/territory-leads/:id — re-tier / annotate a lead.
router.patch(
  "/crm/territory-leads/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    const params = UpdateTerritoryLeadParams.safeParse(req.params);
    const body = UpdateTerritoryLeadBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const d = body.data;
    const patch: Partial<typeof crmTerritoryLeadsTable.$inferInsert> = {};
    if (d.tier !== undefined) patch.tier = d.tier;
    if (d.value !== undefined) patch.value = d.value;
    if (d.ownerName !== undefined) patch.ownerName = d.ownerName;
    if (d.region !== undefined) patch.region = d.region;
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }
    const [updated] = await db
      .update(crmTerritoryLeadsTable)
      .set(patch)
      .where(eq(crmTerritoryLeadsTable.id, params.data.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Territory lead not found" });
      return;
    }
    res.json(updated);
  },
);

// DELETE /crm/territory-leads/:id — drop a lead from the list.
router.delete(
  "/crm/territory-leads/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    const params = DeleteTerritoryLeadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid path parameters" });
      return;
    }
    const deleted = await db
      .delete(crmTerritoryLeadsTable)
      .where(eq(crmTerritoryLeadsTable.id, params.data.id))
      .returning({ id: crmTerritoryLeadsTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Territory lead not found" });
      return;
    }
    res.status(204).end();
  },
);

export default router;
