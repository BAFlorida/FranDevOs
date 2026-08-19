# Territory Prospector

Google Maps powered prospecting tool: scan Google's business listings (Google
Business Profile data via the Places API) straight from the map, build a
tiered target-customer list, and download it as CSV.

## What it does

- **Scan** — type a search like `roofing companies in Dallas, TX` and hit
  SCAN. Results come from Places Text Search (up to 20 per scan, biased to the
  map viewport when the query has no explicit location) and appear as amber
  markers + a results list.
- **Build the lead list** — add results one at a time or all at once. Each
  lead is auto-ranked (Tier 1 = rating ≥ 4.5 with ≥ 50 reviews, Tier 2 =
  rating ≥ 3.5, Tier 3 = the rest) and re-tierable from its detail panel.
  Saved leads render as the tier-colored glowing markers.
- **Work a lead** — click a marker or card for address, rating, phone,
  website, and a Google Maps deep link.
- **Download** — EXPORT CSV produces `territory-leads-<date>.csv` (name,
  category, tier, address, phone, website, rating, coordinates, place id,
  originating search). Opens in Excel / Google Sheets and imports into any CRM.

The lead list persists in the browser (localStorage) — no backend, no
database, no login. The repo also carries an optional server-side seam
(`artifacts/api-server` `/crm/territory-*` routes + `crm_territory_leads`
table) for a future shared, multi-user lead list inside Franchise Dev OS; this
tool does not depend on it.

## Run it

```bash
cp .env.example .env   # then set VITE_GOOGLE_MAPS_API_KEY
pnpm install           # from the repo root
pnpm --filter @workspace/territory-prospector run dev
```

Open http://localhost:5173 (or set `PORT`).

### Google Cloud setup

1. In the Google Cloud console, create (or reuse) an API key.
2. Enable **Maps JavaScript API** and **Places API (New)** for the project.
3. Restrict the key to your site's HTTP referrers (it ships to the browser).
4. Optional: create a Map ID (dark style recommended) and set
   `VITE_GOOGLE_MAPS_MAP_ID`; without one the app uses Google's `DEMO_MAP_ID`,
   which is fine for development.

Places Text Search is billed per request — each SCAN is one request.

## Notes

- Google's Places policy allows storing place IDs indefinitely; other listing
  fields are cached in the lead list / CSV for your own prospecting use.
- Clearing browser storage clears the lead list — export to CSV to keep it.
