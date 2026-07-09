import { useMemo, useState } from "react";
import {
  useGetCrmPipeline,
  useListCrmOpportunities,
  CrmStage,
  CrmExternalSource,
  type CrmOpportunity,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { SourceBadge } from "@/components/source-badge";
import { SyncBadge } from "@/components/sync-badge";
import { QueryError } from "@/components/query-error";
import {
  CrmLinkedTaskDialog,
  type LinkedRecord,
} from "@/components/crm-linked-task-dialog";
import { formatCurrency, formatCompactCurrency } from "@/lib/crm";
import { formatDate } from "@/lib/utils";
import { useReadOnly } from "@/lib/use-read-only";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { Database, ExternalLink, Link2, TrendingUp } from "lucide-react";

const STAGE_COLORS: Record<string, string> = {
  Prospecting: "#94A3B8",
  Qualification: "#60A5FA",
  Discovery: "#38BDF8",
  Proposal: "#818CF8",
  Negotiation: "#A78BFA",
  "Closed Won": "#10B981",
  "Closed Lost": "#EF4444",
};

const ALL = "all";

export default function SalesPage() {
  const [source, setSource] = useState<string>(ALL);
  const [stage, setStage] = useState<string>(ALL);
  const [selected, setSelected] = useState<CrmOpportunity | null>(null);
  const [taskRecord, setTaskRecord] = useState<LinkedRecord | null>(null);
  const readOnly = useReadOnly();

  const pipelineParams =
    source === ALL ? undefined : { source: source as CrmExternalSource };
  const {
    data: pipeline,
    isLoading: pipelineLoading,
    isError: pipelineError,
    refetch: refetchPipeline,
    isRefetching: pipelineRefetching,
  } = useGetCrmPipeline(pipelineParams);

  const oppParams = {
    ...(source === ALL ? {} : { source: source as CrmExternalSource }),
    ...(stage === ALL ? {} : { stageCanonical: stage as CrmStage }),
    pageSize: 200,
  };
  const {
    data: opps,
    isLoading: oppsLoading,
    isError: oppsError,
    refetch: refetchOpps,
    isRefetching: oppsRefetching,
  } = useListCrmOpportunities(oppParams);

  const rows = opps?.rows ?? [];

  const chartData = useMemo(
    () =>
      (pipeline ?? []).map((p) => ({
        stage: p.stage,
        value: p.value,
        count: p.count,
      })),
    [pipeline],
  );

  const totalValue = useMemo(
    () => (pipeline ?? []).reduce((s, p) => s + p.value, 0),
    [pipeline],
  );
  const totalCount = useMemo(
    () => (pipeline ?? []).reduce((s, p) => s + p.count, 0),
    [pipeline],
  );
  const openValue = useMemo(
    () =>
      (pipeline ?? [])
        .filter((p) => p.stage !== "Closed Won" && p.stage !== "Closed Lost")
        .reduce((s, p) => s + p.value, 0),
    [pipeline],
  );

  if (pipelineError || oppsError) {
    return (
      <QueryError
        message="Failed to load sales data"
        onRetry={() => {
          if (pipelineError) refetchPipeline();
          if (oppsError) refetchOpps();
        }}
        retrying={pipelineRefetching || oppsRefetching}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-primary" /> Sales
          </h1>
          <p className="text-muted-foreground mt-1">
            Unified pipeline across Salesforce & HubSpot — read from canonical
            records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sources</SelectItem>
              <SelectItem value={CrmExternalSource.salesforce}>
                Salesforce
              </SelectItem>
              <SelectItem value={CrmExternalSource.hubspot}>HubSpot</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All stages</SelectItem>
              {Object.values(CrmStage).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Pipeline</p>
            <p className="text-2xl font-bold font-serif">
              {formatCurrency(totalValue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Open Pipeline</p>
            <p className="text-2xl font-bold font-serif">
              {formatCurrency(openValue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Opportunities</p>
            <p className="text-2xl font-bold font-serif">{totalCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline by Stage</CardTitle>
        </CardHeader>
        <CardContent>
          {pipelineLoading ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              Loading…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatCompactCurrency(v)}
                />
                <Tooltip
                  formatter={(v: number, _n, p: any) => [
                    formatCurrency(v),
                    `${p.payload.count} opps`,
                  ]}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((d) => (
                    <Cell
                      key={d.stage}
                      fill={STAGE_COLORS[d.stage] ?? "#818CF8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Records table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Opportunities{" "}
            <span className="text-muted-foreground font-normal">
              ({rows.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {oppsLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading opportunities…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No opportunities match these filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Freshness</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((o) => (
                    <TableRow
                      key={`${o.sourceSystem}-${o.id}`}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setSelected(o)}
                    >
                      <TableCell className="font-medium max-w-[220px] truncate">
                        {o.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {o.ownerName ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-medium border-transparent"
                          style={{
                            backgroundColor: `${STAGE_COLORS[o.stageCanonical] ?? "#818CF8"}22`,
                            color: STAGE_COLORS[o.stageCanonical] ?? "#818CF8",
                          }}
                        >
                          {o.stageCanonical}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(o.amount)}
                      </TableCell>
                      <TableCell>
                        <SourceBadge source={o.sourceSystem} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(o.lastActivityAt)}
                      </TableCell>
                      <TableCell>
                        <SyncBadge syncedAt={o.syncedAt} showIcon={false} />
                      </TableCell>
                      <TableCell>
                        {!readOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTaskRecord({
                              sourceSystem: o.sourceSystem,
                              recordType: "opportunity",
                              recordId: o.id,
                              title: o.name,
                            });
                          }}
                          title="Create follow-up task"
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drill-down drawer */}
      <Sheet
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <SourceBadge source={selected.sourceSystem} />
                  <SyncBadge syncedAt={selected.syncedAt} />
                </div>
                <SheetTitle className="mt-2">{selected.name}</SheetTitle>
                <SheetDescription>
                  {selected.stageCanonical}
                  {selected.stageRaw && selected.stageRaw !== selected.stageCanonical
                    ? ` · raw: ${selected.stageRaw}`
                    : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <Field label="Amount" value={formatCurrency(selected.amount)} />
                  <Field label="Owner" value={selected.ownerName ?? "—"} />
                  <Field
                    label="Close Date"
                    value={formatDate(selected.closeDate)}
                  />
                  <Field
                    label="Last Activity"
                    value={formatDate(selected.lastActivityAt)}
                  />
                  <Field
                    label="Source Record ID"
                    value={selected.sourceRecordId}
                  />
                  <Field
                    label="Account ID"
                    value={selected.accountId != null ? String(selected.accountId) : "—"}
                  />
                </dl>

                {!readOnly && (
                <Button
                  className="w-full"
                  onClick={() =>
                    setTaskRecord({
                      sourceSystem: selected.sourceSystem,
                      recordType: "opportunity",
                      recordId: selected.id,
                      title: selected.name,
                    })
                  }
                >
                  <Link2 className="h-4 w-4 mr-2" /> Create Follow-up Task
                </Button>
                )}

                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">
                      Raw payload preview
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <ExternalLink className="h-3 w-3" /> fetch live from source
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Untransformed object preserved from {""}
                    {selected.sourceSystem}. In production this drill-down would
                    fetch the live record from the source system on demand.
                  </p>
                  <pre className="text-xs bg-background rounded-md border p-3 overflow-x-auto max-h-72">
                    {JSON.stringify(selected.rawPayload ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <CrmLinkedTaskDialog
        open={!!taskRecord}
        onOpenChange={(o) => {
          if (!o) setTaskRecord(null);
        }}
        record={taskRecord}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>
  );
}
