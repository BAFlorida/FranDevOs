import { formatDistanceToNow } from "date-fns";
import type { CrmSourceSystem } from "@workspace/api-client-react";

export const SOURCE_META: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  salesforce: {
    label: "Salesforce",
    className:
      "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
    dot: "#00A1E0",
  },
  hubspot: {
    label: "HubSpot",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    dot: "#FF7A59",
  },
  internal: {
    label: "Internal",
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    dot: "#64748B",
  },
};

export function sourceMeta(source?: CrmSourceSystem | string | null) {
  if (!source) return SOURCE_META.internal!;
  return SOURCE_META[source] ?? SOURCE_META.internal!;
}

export function formatCurrency(value?: string | number | null): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatCompactCurrency(value?: string | number | null): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function freshness(syncedAt?: string | null): string {
  if (!syncedAt) return "never synced";
  const d = new Date(syncedAt);
  if (Number.isNaN(d.getTime())) return "—";
  return `synced ${formatDistanceToNow(d, { addSuffix: true })}`;
}

const STALE_MS = 1000 * 60 * 60 * 24; // 24h

export function isStale(syncedAt?: string | null): boolean {
  if (!syncedAt) return true;
  const d = new Date(syncedAt);
  if (Number.isNaN(d.getTime())) return true;
  return Date.now() - d.getTime() > STALE_MS;
}

export function ratePct(numerator: number, denominator: number): string {
  if (!denominator) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}
