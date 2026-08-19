import type { Lead } from "../types";

// Lead-list persistence: localStorage keeps the tool fully standalone (no
// backend). The versioned key leaves room for a future shape migration.
const STORAGE_KEY = "territory-prospector.leads.v1";

export function loadLeads(): Lead[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is Lead =>
        typeof l === "object" &&
        l !== null &&
        typeof (l as Lead).placeId === "string" &&
        typeof (l as Lead).name === "string" &&
        typeof (l as Lead).lat === "number" &&
        typeof (l as Lead).lng === "number",
    );
  } catch {
    return [];
  }
}

export function saveLeads(leads: Lead[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  } catch {
    // Storage full or blocked — the in-memory list still works this session.
  }
}
