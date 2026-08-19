export const TIERS = ["Tier 1", "Tier 2", "Tier 3"] as const;

export type Tier = (typeof TIERS)[number];

// A business surfaced by a Google Places search — not yet in the lead list.
export interface Prospect {
  placeId: string;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  lat: number;
  lng: number;
  rating: number | null;
  ratingCount: number | null;
  businessStatus: string | null;
  suggestedTier: Tier;
}

// A saved target in the lead list.
export interface Lead extends Omit<Prospect, "suggestedTier"> {
  tier: Tier;
  savedAt: string; // ISO timestamp
  searchQuery: string | null; // the search that surfaced this lead
}

export type Selection =
  | { kind: "prospect"; placeId: string }
  | { kind: "lead"; placeId: string }
  | null;

export function prospectToLead(p: Prospect, searchQuery: string | null): Lead {
  const { suggestedTier, ...rest } = p;
  return {
    ...rest,
    tier: suggestedTier,
    savedAt: new Date().toISOString(),
    searchQuery,
  };
}
