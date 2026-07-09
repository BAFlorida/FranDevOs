import {
  db,
  reportDefinitionsTable,
  type ReportDefinition,
} from "@workspace/db";
import { desc } from "drizzle-orm";
import {
  readOpportunities,
  readCampaigns,
  readAccounts,
  readPeople,
  readEmailActivity,
} from "./canonicalStore";

// Internal reporting service. Aggregates over the canonical CRM tables only —
// it never calls an external CRM. Future real integrations populate those
// canonical tables via the adapters; reporting always runs against canonical
// data, so the contract and UI are insulated from the source system.

export type ReportSource =
  | "opportunities"
  | "campaigns"
  | "accounts"
  | "people"
  | "email_activity";
export type ReportAgg = "count" | "sum" | "avg";
export type ReportFilterOp = "eq" | "neq" | "in" | "notIn" | "gt" | "gte" | "lt" | "lte";
export type ReportChartType = "bar" | "line" | "pie" | "area" | "table";

export interface ReportFilter {
  field: string;
  op: ReportFilterOp;
  value: unknown;
}

export interface ReportMetric {
  agg: ReportAgg;
  field?: string | null;
  label?: string | null;
}

export interface ReportSpec {
  sources: ReportSource[];
  dimensions: string[];
  metrics: ReportMetric[];
  filters?: ReportFilter[];
  groupBy?: string | null;
  chartType?: ReportChartType | null;
}

export type ReportCell = string | number | null;

export interface ReportColumn {
  key: string;
  label: string;
  kind: "dimension" | "metric";
}

export interface ReportResult {
  spec: ReportSpec;
  generatedAt: string;
  columns: ReportColumn[];
  rows: Record<string, ReportCell>[];
}

type Row = Record<string, unknown>;

async function loadRows(source: ReportSource): Promise<Row[]> {
  switch (source) {
    case "opportunities":
      return (await readOpportunities()) as Row[];
    case "campaigns":
      return (await readCampaigns()) as Row[];
    case "accounts":
      return (await readAccounts()) as Row[];
    case "people":
      return (await readPeople()) as Row[];
    case "email_activity":
      return (await readEmailActivity()) as Row[];
  }
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function matchesFilter(row: Row, f: ReportFilter): boolean {
  const left = row[f.field];
  switch (f.op) {
    case "eq":
      return left === f.value;
    case "neq":
      return left !== f.value;
    case "in":
      return Array.isArray(f.value) && f.value.includes(left as never);
    case "notIn":
      return Array.isArray(f.value) && !f.value.includes(left as never);
    case "gt":
      return toNumber(left) > toNumber(f.value);
    case "gte":
      return toNumber(left) >= toNumber(f.value);
    case "lt":
      return toNumber(left) < toNumber(f.value);
    case "lte":
      return toNumber(left) <= toNumber(f.value);
  }
}

function metricKey(metric: ReportMetric, index: number): string {
  if (metric.label) return metric.label;
  if (metric.agg === "count") return "count";
  return `${metric.agg}_${metric.field ?? "value"}_${index}`;
}

function metricLabel(metric: ReportMetric): string {
  if (metric.label) return metric.label;
  if (metric.agg === "count") return "Count";
  return `${metric.agg}(${metric.field ?? "value"})`;
}

function aggregate(metric: ReportMetric, bucket: Row[]): number {
  if (metric.agg === "count") return bucket.length;
  const field = metric.field;
  if (!field) return 0;
  const nums = bucket.map((r) => toNumber(r[field]));
  const sum = nums.reduce((s, n) => s + n, 0);
  if (metric.agg === "sum") return sum;
  return nums.length ? sum / nums.length : 0;
}

export async function runReport(spec: ReportSpec): Promise<ReportResult> {
  // Read each requested source and tag every record with its dataset so a
  // report can span multiple canonical entities. All reads are internal.
  const datasets = await Promise.all(
    spec.sources.map(async (source) => {
      const rows = await loadRows(source);
      return rows.map((r) => ({ ...r, source }) as Row);
    }),
  );
  const all = datasets.flat();

  const filters = spec.filters ?? [];
  const filtered = all.filter((row) => filters.every((f) => matchesFilter(row, f)));

  const dimensions = spec.dimensions.length > 0 ? spec.dimensions : [];

  // Group by the concatenation of all dimension values.
  const groups = new Map<string, { dims: ReportCell[]; rows: Row[] }>();
  for (const row of filtered) {
    const dims: ReportCell[] = dimensions.map((d) => {
      const v = row[d];
      if (v == null) return null;
      return typeof v === "number" ? v : String(v);
    });
    const key = JSON.stringify(dims);
    const bucket = groups.get(key) ?? { dims, rows: [] };
    bucket.rows.push(row);
    groups.set(key, bucket);
  }

  const columns: ReportColumn[] = [
    ...dimensions.map((d) => ({ key: d, label: d, kind: "dimension" as const })),
    ...spec.metrics.map((m, i) => ({
      key: metricKey(m, i),
      label: metricLabel(m),
      kind: "metric" as const,
    })),
  ];

  const primaryMetric = spec.metrics[0]!;
  const rows: Record<string, ReportCell>[] = [];
  for (const { dims, rows: bucket } of groups.values()) {
    const out: Record<string, ReportCell> = {};
    dimensions.forEach((d, i) => {
      out[d] = dims[i] ?? null;
    });
    spec.metrics.forEach((m, i) => {
      out[metricKey(m, i)] = aggregate(m, bucket);
    });
    rows.push(out);
  }

  // Sort by the first metric descending for a stable, useful default ordering.
  const primaryKey = metricKey(primaryMetric, 0);
  rows.sort((a, b) => toNumber(b[primaryKey]) - toNumber(a[primaryKey]));

  return { spec, generatedAt: new Date().toISOString(), columns, rows };
}

export async function listDefinitions(): Promise<ReportDefinition[]> {
  return db
    .select()
    .from(reportDefinitionsTable)
    .orderBy(desc(reportDefinitionsTable.isPreset), desc(reportDefinitionsTable.createdAt));
}

export async function createDefinition(input: {
  name: string;
  spec: ReportSpec;
  createdById: string | null;
}): Promise<ReportDefinition> {
  const [row] = await db
    .insert(reportDefinitionsTable)
    .values({
      name: input.name,
      spec: input.spec,
      isPreset: false,
      createdById: input.createdById,
    })
    .returning();
  return row!;
}
