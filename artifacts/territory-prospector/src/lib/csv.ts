import type { Lead } from "../types";

// "Download the lead list" — client-side CSV export, opens straight in Excel
// or Google Sheets and imports cleanly into any CRM.

const COLUMNS: { header: string; value: (l: Lead) => string | number | null }[] = [
  { header: "Name", value: (l) => l.name },
  { header: "Category", value: (l) => l.category },
  { header: "Tier", value: (l) => l.tier },
  { header: "Address", value: (l) => l.address },
  { header: "Phone", value: (l) => l.phone },
  { header: "Website", value: (l) => l.website },
  { header: "Rating", value: (l) => l.rating },
  { header: "Reviews", value: (l) => l.ratingCount },
  { header: "Business Status", value: (l) => l.businessStatus },
  { header: "Latitude", value: (l) => l.lat },
  { header: "Longitude", value: (l) => l.lng },
  { header: "Google Place ID", value: (l) => l.placeId },
  { header: "Found Via Search", value: (l) => l.searchQuery },
  { header: "Saved At", value: (l) => l.savedAt },
];

function escapeCell(value: string | number | null): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function leadsToCsv(leads: Lead[]): string {
  const header = COLUMNS.map((c) => escapeCell(c.header)).join(",");
  const rows = leads.map((l) => COLUMNS.map((c) => escapeCell(c.value(l))).join(","));
  return [header, ...rows].join("\r\n");
}

export function downloadLeadsCsv(leads: Lead[]): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([leadsToCsv(leads)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `territory-leads-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
