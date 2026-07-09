import { useMemo, useState } from "react";
import {
  useRunReport,
  useListReportDefinitions,
  useCreateReportDefinition,
  useGetIntegrationStatus,
  useRefreshIntegration,
  useListTasks,
  getListReportDefinitionsQueryKey,
  getGetIntegrationStatusQueryKey,
  ReportSource,
  ReportChartType,
  ReportMetricAgg,
  CrmExternalSource,
  type ReportSpec,
  type ReportResult,
  type ReportColumn,
  type ReportMetric,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { freshness, isStale, formatCompactCurrency } from "@/lib/crm";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  BarChart3,
  Download,
  Save,
  RefreshCw,
  Play,
  Database,
} from "lucide-react";

// Source catalog: dimensions + numeric metric fields offered per source.
// `tasks` is computed client-side from the existing task module (no /reports/run
// support); everything else flows through POST /reports/run.
const SOURCE_CATALOG: Record<
  string,
  { label: string; dimensions: string[]; numericFields: string[] }
> = {
  opportunities: {
    label: "Opportunities",
    dimensions: ["stageCanonical", "sourceSystem", "ownerName"],
    numericFields: ["amount"],
  },
  campaigns: {
    label: "Campaigns",
    dimensions: ["channel", "type", "status", "sourceSystem"],
    numericFields: ["sends", "opens", "clicks", "influencedPipeline"],
  },
  accounts: {
    label: "Accounts",
    dimensions: ["type", "region", "ownerName", "sourceSystem"],
    numericFields: [],
  },
  people: {
    label: "People",
    dimensions: ["title", "ownerName", "sourceSystem"],
    numericFields: [],
  },
  email_activity: {
    label: "Email Activity",
    dimensions: ["sourceSystem"],
    numericFields: ["sends", "opens", "clicks"],
  },
  tasks: {
    label: "Tasks (project module)",
    dimensions: ["status", "priority", "assigneeName", "projectName"],
    numericFields: ["percentComplete"],
  },
};

const CHART_COLORS = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#38BDF8",
  "#A78BFA",
  "#EC4899",
  "#94A3B8",
];

type UiSource = keyof typeof SOURCE_CATALOG;

const isCurrencyField = (key: string) =>
  /amount|pipeline|influenced/i.test(key);

export default function ReportBuilderPage() {
  const queryClient = useQueryClient();

  const [source, setSource] = useState<UiSource>("opportunities");
  const [dimension, setDimension] = useState<string>("stageCanonical");
  const [metricAgg, setMetricAgg] = useState<ReportMetricAgg>(
    ReportMetricAgg.sum,
  );
  const [metricField, setMetricField] = useState<string>("amount");
  const [chartType, setChartType] = useState<ReportChartType>(
    ReportChartType.bar,
  );
  const [sourceFilter, setSourceFilter] = useState<CrmExternalSource>(
    CrmExternalSource.salesforce,
  );
  const [result, setResult] = useState<ReportResult | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  const catalog = SOURCE_CATALOG[source]!;
  const { data: definitions } = useListReportDefinitions();
  const { data: integrations } = useGetIntegrationStatus();
  const { data: allTasks } = useListTasks();
  const runMutation = useRunReport();
  const saveMutation = useCreateReportDefinition();
  const refreshMutation = useRefreshIntegration();

  const lastSync = useMemo(() => {
    const times = (integrations ?? [])
      .map((c) => c.connection.lastSyncAt)
      .filter(Boolean) as string[];
    if (times.length === 0) return null;
    return times.sort().reverse()[0]!;
  }, [integrations]);

  const onSourceChange = (s: UiSource) => {
    setSource(s);
    const cat = SOURCE_CATALOG[s]!;
    setDimension(cat.dimensions[0]!);
    if (cat.numericFields.length === 0) {
      setMetricAgg(ReportMetricAgg.count);
      setMetricField("");
    } else {
      setMetricAgg(ReportMetricAgg.sum);
      setMetricField(cat.numericFields[0]!);
    }
  };

  const buildSpec = (): ReportSpec => {
    const metric: ReportMetric = {
      agg: metricAgg,
      field: metricAgg === ReportMetricAgg.count ? null : metricField || null,
      label:
        metricAgg === ReportMetricAgg.count
          ? "Count"
          : `${metricAgg}(${metricField})`,
    };
    return {
      sources: [source as unknown as ReportSource],
      dimensions: [dimension],
      metrics: [metric],
      groupBy: dimension,
      chartType,
      filters: [],
    };
  };

  const runTasksReport = (): ReportResult => {
    const tasks = allTasks ?? [];
    const metricKey =
      metricAgg === ReportMetricAgg.count ? "Count" : `${metricAgg}(${metricField})`;
    const buckets = new Map<string, number[]>();
    for (const t of tasks) {
      const key = String((t as any)[dimension] ?? "—");
      const arr = buckets.get(key) ?? [];
      if (metricAgg !== ReportMetricAgg.count) {
        arr.push(Number((t as any)[metricField] ?? 0));
      } else {
        arr.push(1);
      }
      buckets.set(key, arr);
    }
    const rows = Array.from(buckets.entries()).map(([k, vals]) => {
      let value: number;
      if (metricAgg === ReportMetricAgg.count) value = vals.length;
      else if (metricAgg === ReportMetricAgg.sum)
        value = vals.reduce((a, b) => a + b, 0);
      else
        value = vals.length
          ? vals.reduce((a, b) => a + b, 0) / vals.length
          : 0;
      return { [dimension]: k, [metricKey]: Math.round(value * 100) / 100 };
    });
    rows.sort((a, b) => Number(b[metricKey]) - Number(a[metricKey]));
    const columns: ReportColumn[] = [
      { key: dimension, label: dimension, kind: "dimension" },
      { key: metricKey, label: metricKey, kind: "metric" },
    ];
    return {
      spec: buildSpec(),
      generatedAt: new Date().toISOString(),
      columns,
      rows,
    };
  };

  const handleRun = () => {
    if (source === "tasks") {
      setResult(runTasksReport());
      return;
    }
    runMutation.mutate(
      { data: buildSpec() },
      {
        onSuccess: (r) => setResult(r),
        onError: () => toast.error("Failed to run report"),
      },
    );
  };

  const loadPreset = (id: string) => {
    const def = definitions?.find((d) => d.id === Number(id));
    if (!def) return;
    const spec = def.spec;
    const src = spec.sources[0] as UiSource;
    setSource(src);
    setDimension(spec.dimensions[0] ?? SOURCE_CATALOG[src]!.dimensions[0]!);
    const m = spec.metrics[0];
    if (m) {
      setMetricAgg(m.agg);
      setMetricField(m.field ?? "");
    }
    if (spec.chartType) setChartType(spec.chartType);
    // Run it immediately for instant feedback.
    if (src === "tasks") {
      setTimeout(() => setResult(runTasksReport()), 0);
    } else {
      runMutation.mutate(
        { data: spec },
        {
          onSuccess: (r) => setResult(r),
          onError: () => toast.error("Failed to run preset"),
        },
      );
    }
  };

  const handleSave = () => {
    if (!saveName.trim()) {
      toast.error("Name is required");
      return;
    }
    saveMutation.mutate(
      { data: { name: saveName.trim(), spec: buildSpec() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListReportDefinitionsQueryKey(),
          });
          toast.success("Report preset saved");
          setSaveOpen(false);
          setSaveName("");
        },
        onError: () => toast.error("Failed to save preset"),
      },
    );
  };

  const handleRefresh = () => {
    refreshMutation.mutate(
      { data: { source: sourceFilter } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetIntegrationStatusQueryKey(),
          });
          toast.success(`Refreshed ${sourceFilter} (mock sync)`);
        },
        onError: () => toast.error("Refresh failed"),
      },
    );
  };

  const exportCsv = () => {
    if (!result || result.rows.length === 0) {
      toast.error("Run a report first");
      return;
    }
    const headers = result.columns.map((c) => c.label);
    const keys = result.columns.map((c) => c.key);
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.map(escape).join(","),
      ...result.rows.map((row) => keys.map((k) => escape(row[k])).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const metricKey = result?.columns.find((c) => c.kind === "metric")?.key;
  const dimKey = result?.columns.find((c) => c.kind === "dimension")?.key;

  return (
    <div className="space-y-6 max-w-7xl">
      <header>
        <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-primary" /> Report Builder
        </h1>
        <p className="text-muted-foreground mt-1">
          Compose reports over canonical CRM data. Aggregation is internal —
          nothing queries an external CRM.
        </p>
      </header>

      {/* Freshness banner */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
          isStale(lastSync)
            ? "border-amber-300 bg-amber-50 dark:bg-amber-900/20"
            : "border-border bg-muted/40"
        }`}
      >
        <div className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Reporting data {freshness(lastSync)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={sourceFilter}
            onValueChange={(v) => setSourceFilter(v as CrmExternalSource)}
          >
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CrmExternalSource.salesforce}>
                Salesforce
              </SelectItem>
              <SelectItem value={CrmExternalSource.hubspot}>HubSpot</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1.5 ${refreshMutation.isPending ? "animate-spin" : ""}`}
            />
            Refresh from source
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Config panel */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Cfg label="Source">
              <Select
                value={source}
                onValueChange={(v) => onSourceChange(v as UiSource)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_CATALOG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Cfg>

            <Cfg label="Group by (dimension)">
              <Select value={dimension} onValueChange={setDimension}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {catalog.dimensions.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Cfg>

            <Cfg label="Metric">
              <div className="flex gap-2">
                <Select
                  value={metricAgg}
                  onValueChange={(v) => setMetricAgg(v as ReportMetricAgg)}
                >
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ReportMetricAgg.count}>Count</SelectItem>
                    <SelectItem
                      value={ReportMetricAgg.sum}
                      disabled={catalog.numericFields.length === 0}
                    >
                      Sum
                    </SelectItem>
                    <SelectItem
                      value={ReportMetricAgg.avg}
                      disabled={catalog.numericFields.length === 0}
                    >
                      Average
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={metricField}
                  onValueChange={setMetricField}
                  disabled={metricAgg === ReportMetricAgg.count}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="field" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog.numericFields.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Cfg>

            <Cfg label="Chart type">
              <Select
                value={chartType}
                onValueChange={(v) => setChartType(v as ReportChartType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ReportChartType).map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Cfg>

            <Button
              className="w-full"
              onClick={handleRun}
              disabled={runMutation.isPending}
            >
              <Play className="h-4 w-4 mr-1.5" />
              {runMutation.isPending ? "Running…" : "Run Report"}
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setSaveOpen(true)}>
                <Save className="h-4 w-4 mr-1.5" /> Save
              </Button>
              <Button variant="outline" onClick={exportCsv}>
                <Download className="h-4 w-4 mr-1.5" /> CSV
              </Button>
            </div>

            <div className="pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Saved presets
              </p>
              <Select onValueChange={loadPreset}>
                <SelectTrigger>
                  <SelectValue placeholder="Load a preset…" />
                </SelectTrigger>
                <SelectContent>
                  {(definitions ?? []).map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Visualization</CardTitle>
              {result && (
                <span className="text-xs text-muted-foreground">
                  generated {new Date(result.generatedAt).toLocaleTimeString()}
                </span>
              )}
            </CardHeader>
            <CardContent>
              {!result ? (
                <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <BarChart3 className="h-10 w-10 opacity-30" />
                  <p>Configure and run a report to see results.</p>
                </div>
              ) : result.rows.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No rows returned.
                </div>
              ) : (
                <ReportChart
                  result={result}
                  chartType={chartType}
                  dimKey={dimKey!}
                  metricKey={metricKey!}
                />
              )}
            </CardContent>
          </Card>

          {result && result.rows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Results{" "}
                  <span className="font-normal text-muted-foreground">
                    ({result.rows.length} rows)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        {result.columns.map((c) => (
                          <TableHead
                            key={c.key}
                            className={c.kind === "metric" ? "text-right" : ""}
                          >
                            {c.label}{" "}
                            <Badge
                              variant="outline"
                              className="ml-1 text-[10px] font-normal"
                            >
                              {c.kind}
                            </Badge>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.rows.map((row, i) => (
                        <TableRow key={i}>
                          {result.columns.map((c) => (
                            <TableCell
                              key={c.key}
                              className={
                                c.kind === "metric"
                                  ? "text-right font-mono text-sm"
                                  : ""
                              }
                            >
                              {c.kind === "metric" && isCurrencyField(c.key)
                                ? formatCompactCurrency(row[c.key] as number)
                                : row[c.key] ?? "—"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save report preset</DialogTitle>
            <DialogDescription>
              Saves the current configuration for quick reuse.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="e.g. Pipeline by Owner"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Cfg({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function ReportChart({
  result,
  chartType,
  dimKey,
  metricKey,
}: {
  result: ReportResult;
  chartType: ReportChartType;
  dimKey: string;
  metricKey: string;
}) {
  const data = result.rows.map((r) => ({
    name: String(r[dimKey] ?? "—"),
    value: Number(r[metricKey] ?? 0),
  }));
  const currency = isCurrencyField(metricKey);
  const fmt = (v: number) => (currency ? formatCompactCurrency(v) : String(v));

  if (chartType === "table") {
    return (
      <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
        Table view selected — see the results table below.
      </div>
    );
  }

  if (chartType === "pie") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={110}
            label={(e: any) => e.name}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => fmt(v)} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} />
          <Tooltip formatter={(v: number) => fmt(v)} />
          <Legend />
          <Line type="monotone" dataKey="value" stroke="#6366F1" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "area") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} />
          <Tooltip formatter={(v: number) => fmt(v)} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#6366F1"
            fill="#6366F133"
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} />
        <Tooltip formatter={(v: number) => fmt(v)} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
