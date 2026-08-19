import type { Prospect, Tier } from "../types";

// Wrapper around the Maps JS SDK's Places "Text Search" (the sanctioned way to
// query Google Business Profile listings from the browser — same key as the
// map, no separate backend required).

// Request only the fields the lead list stores — field masks drive Places
// billing SKUs.
const PLACE_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "businessStatus",
  "websiteURI",
  "nationalPhoneNumber",
  "primaryTypeDisplayName",
  "types",
];

export const MAX_RESULTS = 20; // Places text search page maximum

// Prominence-based default priority: strong rating + real review volume marks
// the hottest targets. Tiers stay editable after import.
export function deriveTier(
  rating: number | null | undefined,
  ratingCount: number | null | undefined,
): Tier {
  if (rating != null && rating >= 4.5 && (ratingCount ?? 0) >= 50) return "Tier 1";
  if (rating != null && rating >= 3.5) return "Tier 2";
  return "Tier 3";
}

// Map one Place onto the prospect shape; drop listings missing the
// identity/coordinates a territory lead requires.
export function normalizePlace(place: google.maps.places.Place): Prospect | null {
  const location = place.location;
  const name = place.displayName;
  if (!place.id || !name || !location) return null;

  const rating = place.rating ?? null;
  const ratingCount = place.userRatingCount ?? null;
  return {
    placeId: place.id,
    name,
    category: place.primaryTypeDisplayName ?? place.types?.[0] ?? null,
    address: place.formattedAddress ?? null,
    phone: place.nationalPhoneNumber ?? null,
    website: place.websiteURI ?? null,
    lat: location.lat(),
    lng: location.lng(),
    rating,
    ratingCount,
    businessStatus: place.businessStatus ?? null,
    suggestedTier: deriveTier(rating, ratingCount),
  };
}

export async function searchPlaces(
  placesLib: google.maps.PlacesLibrary,
  query: string,
  bias?: google.maps.LatLngBounds | null,
): Promise<Prospect[]> {
  const { places } = await placesLib.Place.searchByText({
    textQuery: query,
    fields: PLACE_FIELDS,
    maxResultCount: MAX_RESULTS,
    ...(bias ? { locationBias: bias } : {}),
  });
  return places
    .map(normalizePlace)
    .filter((p): p is Prospect => p != null);
}

// Deep link to the listing on Google Maps (documented Maps URL API).
export function googleMapsUrl(p: { name: string; address: string | null; placeId: string }): string {
  const query = encodeURIComponent(p.address ? `${p.name} ${p.address}` : p.name);
  return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${encodeURIComponent(p.placeId)}`;
}
