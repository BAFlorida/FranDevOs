import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getInitials } from "@/lib/utils";
import {
  useGetKpiBreakdown,
  useGetMe,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { AlertCircle, TrendingUp, ShieldCheck, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";
import { toast } from "sonner";

function mondayOfUTC(d: Date): string {
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
  return m.toISOString().slice(0, 10);
}

function Sparkline({ values, target }: { values: number[]; target: number }) {
  if (values.length === 0) return null;
  const max = Math.max(target, ...values, 1);
  const w = 110;
  const h = 28;
  const step = w / Math.max(values.length - 1, 1);
  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (v / max) * (h - 4) - 2}`)
    .join(" ");
  const targetY = h - (target / max) * (h - 4) - 2;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <line x1={0} y1={targetY} x2={w} y2={targetY} stroke="currentColor" className="text-muted-foreground/40" strokeDasharray="2 2" />
      <path d={path} fill="none" stroke="currentColor" className="text-primary" strokeWidth="1.5" />
      {values.map((v, i) => (
        <circle
          key={i}
          cx={i * step}
          cy={h - (v / max) * (h - 4) - 2}
          r={2}
          className={v >= target ? "fill-emerald-600" : "fill-primary"}
        />
      ))}
    </svg>
  );
}

export default function KpiBreakdownPage() {
  const { user } = useAuth();
  const { data: me } = useGetMe({ query: { enabled: !!user, queryKey: getGetMeQueryKey() } });

  // Build a 12-week selector ending at this week's Monday.
  const weekOptions = useMemo(() => {
    const out: string[] = [];
    const base = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() - i * 7);
      out.push(mondayOfUTC(d));
    }
    return out;
  }, []);
  const [selectedWeek, setSelectedWeek] = useState<string>(weekOptions[0]!);
  const { data, isLoading, isError, refetch, isRefetching } = useGetKpiBreakdown({ weekStart: selectedWeek });
  const [downloading, setDownloading] = useState(false);

  const canAccess = (me?.permissions ?? []).includes("run_reports");

  const downloadXlsx = async () => {
    setDownloading(true);
    try {
      const base = import.meta.env.BASE_URL;
      const res = await fetch(`${base}api/reports/export.xlsx`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `franchise-dev-board-update-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Downloaded");
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <Card className="border-destructive/30">
          <CardContent className="p-8 text-center space-y-2">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <h2 className="text-xl font-serif font-bold">VP only</h2>
            <p className="text-muted-foreground text-sm">This breakdown is for VP and Admin roles.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading breakdown...</div>;
  }
  if (isError || !data) {
    return (
      <QueryError
        message="Failed to load breakdown"
        onRetry={() => refetch()}
        retrying={isRefetching}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-primary" />
            Weekly KPI Breakdown
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Week of {data.currentWeekStart} · 6-week trend per developer · {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Week</label>
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-44" data-testid="select-kpi-week">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weekOptions.map((w, i) => (
                  <SelectItem key={w} value={w}>
                    Week of {w}{i === 0 ? " (current)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={downloadXlsx} disabled={downloading} data-testid="button-kpi-export-xlsx">
            <Download className="w-4 h-4 mr-2" />
            {downloading ? "Generating..." : "Board Excel"}
          </Button>
        </div>
      </div>

      {data.metrics.map((m) => {
        const targetPct = m.totalTarget ? Math.round((m.totalActual / m.totalTarget) * 100) : 0;
        const onTargetCount = m.rows.filter((r) => r.count >= m.target).length;
        const teamOnTargetPct = m.rows.length ? Math.round((onTargetCount / m.rows.length) * 100) : 0;
        return (
          <Card key={m.metricId}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-baseline justify-between gap-3 flex-wrap pb-3 border-b">
                <div>
                  <h2 className="font-serif font-bold text-lg">{m.metricName}</h2>
                  <p className="text-xs text-muted-foreground">Target {m.target}/wk per developer</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-serif font-bold">
                    {m.totalActual}<span className="text-sm text-muted-foreground font-normal">/{m.totalTarget}</span>
                  </div>
                  <Badge variant={targetPct >= 100 ? "default" : targetPct >= 75 ? "secondary" : "outline"}>
                    {targetPct}% of team target
                  </Badge>
                </div>
              </div>

              <div className="rounded-md border bg-muted/20 p-3">
                <div className="flex items-baseline justify-between mb-1.5">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Team on-target this week
                  </div>
                  <div className="text-sm font-mono">
                    <span className={`font-bold ${teamOnTargetPct >= 75 ? "text-emerald-700" : teamOnTargetPct >= 50 ? "text-amber-700" : "text-destructive"}`}>
                      {onTargetCount}
                    </span>
                    <span className="text-muted-foreground"> / {m.rows.length} devs</span>
                    <span className="ml-2 font-bold">{teamOnTargetPct}%</span>
                  </div>
                </div>
                <Progress value={teamOnTargetPct} className="h-2" data-testid={`progress-team-${m.metricId}`} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 font-medium">Developer</th>
                      <th className="py-2 font-medium">This week</th>
                      <th className="py-2 font-medium">vs. target</th>
                      <th className="py-2 font-medium">Source</th>
                      <th className="py-2 font-medium">6-week trend</th>
                      <th className="py-2 font-medium text-right">Latest evidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {m.rows.map((r) => {
                      const hit = r.count >= m.target;
                      return (
                        <tr key={r.userId} className="hover:bg-muted/30">
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                <AvatarFallback style={{ backgroundColor: r.avatarColor, color: "white", fontSize: 10 }}>
                                  {getInitials(r.userName)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">{r.userName}</span>
                            </div>
                          </td>
                          <td className="py-2">
                            <span className={`font-mono font-bold ${hit ? "text-emerald-700" : ""}`}>{r.count}</span>
                            <span className="text-muted-foreground font-mono">/{r.target}</span>
                          </td>
                          <td className="py-2">
                            {hit ? (
                              <Badge variant="default" className="text-[9px]">✓ On target</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px]">
                                {Math.max(0, r.target - r.count)} short
                              </Badge>
                            )}
                          </td>
                          <td className="py-2">
                            {r.source === "salesforce" ? (
                              <Badge variant="secondary" className="text-[9px] gap-0.5">
                                <ShieldCheck className="w-2.5 h-2.5" /> SF
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px]">
                                {r.isSelfReported ? "Self-reported" : "Manual"}
                              </Badge>
                            )}
                          </td>
                          <td className="py-2"><Sparkline values={r.sparkline} target={r.target} /></td>
                          <td className="py-2 text-right text-[11px] text-muted-foreground italic max-w-[200px] truncate">
                            {r.lastEvidenceNote || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
