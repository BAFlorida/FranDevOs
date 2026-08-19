import type { TerritoryTier } from "@workspace/db";

// Google Places API (New) text-search seam for territory prospecting.
//
// This is the app's first REAL external call: it proxies "search Google
// Business Profile listings" so the Places key stays server-side
// (GOOGLE_MAPS_API_KEY). It is NOT a CrmAdapter — Google is a prospecting
// source, not a synced CRM — so it lives beside the adapter registry rather
// than inside it. Results are normalized here and only persisted when the
// user explicitly imports them (routes/territory.ts).
//
// Google's caching policy allows storing place ids indefinitely; other place
// content is cached in rawPayload for drill-down and should be re-fetched
// periodically if freshness starts to matter.

const PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

// Field mask keeps the request in the cheaper Places SKU tiers — request only
// what the lead list stores.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "nextPageToken",
].join(",");

const PAGE_SIZE = 20; // Places text search maximum per page

export class GooglePlacesNotConfiguredError extends Error {
  constructor() {
    super("GOOGLE_MAPS_API_KEY is not configured on the API server");
    this.name = "GooglePlacesNotConfiguredError";
  }
}

export class GooglePlacesRequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GooglePlacesRequestError";
    this.status = status;
  }
}

// Raw (partial) shape of one place in the Places API (New) response.
export interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
}

export interface NormalizedPlace {
  placeId: string;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  latitude: number;
  longitude: number;
  rating: number | null;
  ratingCount: number | null;
  businessStatus: string | null;
  suggestedTier: TerritoryTier;
  rawPayload: RawPlace;
}

export interface PlacesSearchResult {
  places: NormalizedPlace[];
  nextPageToken: string | null;
}

export function isGooglePlacesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

// Prominence-based default priority: strong rating + real review volume marks
// the hottest targets. Users can re-tier leads after import.
export function deriveTier(
  rating: number | null | undefined,
  ratingCount: number | null | undefined,
): TerritoryTier {
  if (rating != null && rating >= 4.5 && (ratingCount ?? 0) >= 50) return "Tier 1";
  if (rating != null && rating >= 3.5) return "Tier 2";
  return "Tier 3";
}

// Map one raw place onto the lead-list shape. Returns null when the listing is
// missing the identity/coordinates a territory lead requires.
export function normalizePlace(raw: RawPlace): NormalizedPlace | null {
  const placeId = raw.id;
  const name = raw.displayName?.text;
  const latitude = raw.location?.latitude;
  const longitude = raw.location?.longitude;
  if (!placeId || !name || latitude == null || longitude == null) return null;

  const rating = raw.rating ?? null;
  const ratingCount = raw.userRatingCount ?? null;
  return {
    placeId,
    name,
    category: raw.primaryTypeDisplayName?.text ?? raw.types?.[0] ?? null,
    address: raw.formattedAddress ?? null,
    phone: raw.nationalPhoneNumber ?? null,
    website: raw.websiteUri ?? null,
    latitude,
    longitude,
    rating,
    ratingCount,
    businessStatus: raw.businessStatus ?? null,
    suggestedTier: deriveTier(rating, ratingCount),
    rawPayload: raw,
  };
}

export async function searchPlaces(opts: {
  query: string;
  pageToken?: string | null;
}): Promise<PlacesSearchResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new GooglePlacesNotConfiguredError();

  const response = await fetch(PLACES_TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: opts.query,
      pageSize: PAGE_SIZE,
      ...(opts.pageToken ? { pageToken: opts.pageToken } : {}),
    }),
  });

  if (!response.ok) {
    let detail = `Google Places API responded ${response.status}`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body?.error?.message) detail = body.error.message;
    } catch {
      // non-JSON error body — keep the status-based message
    }
    throw new GooglePlacesRequestError(response.status, detail);
  }

  const body = (await response.json()) as {
    places?: RawPlace[];
    nextPageToken?: string;
  };
  const places = (body.places ?? [])
    .map(normalizePlace)
    .filter((p): p is NormalizedPlace => p != null);
  return { places, nextPageToken: body.nextPageToken ?? null };
}
