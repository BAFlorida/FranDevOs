import { useMemo, useState } from "react";
import {
  useListCrmCampaigns,
  useListCrmEmailActivity,
  CrmExternalSource,
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
import { Badge } from "@/components/ui/badge";
import { SourceBadge } from "@/components/source-badge";
import { QueryError } from "@/components/query-error";
import { SyncBadge } from "@/components/sync-badge";
import {
  CrmLinkedTaskDialog,
  type LinkedRecord,
} from "@/components/crm-linked-task-dialog";
import { formatCurrency, formatCompactCurrency, ratePct } from "@/lib/crm";
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
  Legend,
} from "recharts";
import { Megaphone, Link2, Mail } from "lucide-react";

const ALL = "all";

export default function MarketingPage() {
  const [source, setSource] = useState<string>(ALL);
  const [taskRecord, setTaskRecord] = useState<LinkedRecord | null>(null);
  const readOnly = useReadOnly();

  const params =
    source === ALL ? undefined : { source: source as CrmExternalSource };
  const {
    data: campaigns,
    isLoading,
    isError,
    refetch: refetchCampaigns,
    isRefetching: campaignsRefetching,
  } = useListCrmCampaigns(params);
  const {
    data: emails,
    isLoading: emailsLoading,
    isError: emailsError,
    refetch: refetchEmails,
    isRefetching: emailsRefetching,
  } = useListCrmEmailActivity(params);

  const rows = campaigns ?? [];

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, c) => {
        acc.sends += c.sends;
        acc.opens += c.opens;
        acc.clicks += c.clicks;
        acc.influenced += c.influencedPipeline
          ? Number(c.influencedPipeline)
          : 0;
        return acc;
      },
      { sends: 0, opens: 0, clicks: 0, influenced: 0 },
    );
  }, [rows]);

  const chartData = useMemo(
    () =>
      rows.map((c) => ({
        name: c.name.length > 18 ? c.name.slice(0, 18) + "…" : c.name,
        Opens: c.opens,
        Clicks: c.clicks,
      })),
    [rows],
  );

  if (isError || emailsError) {
    return (
      <QueryError
        message="Failed to load marketing data"
        onRetry={() => {
          if (isError) refetchCampaigns();
          if (emailsError) refetchEmails();
        }}
        retrying={campaignsRefetching || emailsRefetching}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
            <Megaphone className="h-7 w-7 text-primary" /> Marketing
          </h1>
          <p className="text-muted-foreground mt-1">
            Campaign performance across Salesforce & HubSpot, plus HubSpot
            marketing emails.
          </p>
        </div>
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
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Sends" value={totals.sends.toLocaleString()} />
        <Stat
          label="Open Rate"
          value={ratePct(totals.opens, totals.sends)}
          sub={`${totals.opens.toLocaleString()} opens`}
        />
        <Stat
          label="Click Rate"
          value={ratePct(totals.clicks, totals.sends)}
          sub={`${totals.clicks.toLocaleString()} clicks`}
        />
        <Stat
          label="Influenced Pipeline"
          value={formatCurrency(totals.influenced)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Engagement by Campaign</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              Loading…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Opens" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Clicks" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Campaign Performance{" "}
            <span className="text-muted-foreground font-normal">
              ({rows.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading campaigns…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No campaigns found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Campaign</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead className="text-right">Sends</TableHead>
                    <TableHead className="text-right">Opens</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">Influenced</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Freshness</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={`${c.sourceSystem}-${c.id}`}>
                      <TableCell className="font-medium max-w-[220px] truncate">
                        {c.name}
                        {c.status && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-[10px] capitalize"
                          >
                            {c.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground capitalize">
                        {c.channel ?? c.type ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {c.sends.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {c.opens.toLocaleString()}
                        <span className="text-muted-foreground ml-1 text-xs">
                          {ratePct(c.opens, c.sends)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {c.clicks.toLocaleString()}
                        <span className="text-muted-foreground ml-1 text-xs">
                          {ratePct(c.clicks, c.sends)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCompactCurrency(c.influencedPipeline)}
                      </TableCell>
                      <TableCell>
                        <SourceBadge source={c.sourceSystem} />
                      </TableCell>
                      <TableCell>
                        <SyncBadge syncedAt={c.syncedAt} showIcon={false} />
                      </TableCell>
                      <TableCell>
                        {!readOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            setTaskRecord({
                              sourceSystem: c.sourceSystem,
                              recordType: "campaign",
                              recordId: c.id,
                              title: c.name,
                            })
                          }
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" /> Marketing Emails
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {emailsLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading emails…
            </div>
          ) : (emails ?? []).length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No marketing emails found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">Sends</TableHead>
                    <TableHead className="text-right">Opens</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Freshness</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(emails ?? []).map((e) => (
                    <TableRow key={`${e.sourceSystem}-${e.id}`}>
                      <TableCell className="font-medium max-w-[260px] truncate">
                        {e.subject ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {e.sends.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {e.opens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {e.clicks.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(e.sentAt)}
                      </TableCell>
                      <TableCell>
                        <SourceBadge source={e.sourceSystem} />
                      </TableCell>
                      <TableCell>
                        <SyncBadge syncedAt={e.syncedAt} showIcon={false} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold font-serif">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}
