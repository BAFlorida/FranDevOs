import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus,
  Minus,
  TrendingUp,
  Target,
  Clock,
  History,
  Lock,
  Unlock,
  ShieldCheck,
} from "lucide-react";
import { getInitials } from "@/lib/utils";
import {
  useGetMe,
  useGetWeekLockStatus,
  useUnlockWeek,
  useListMetricAudit,
  getGetMeQueryKey,
  getGetWeekLockStatusQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useReadOnly } from "@/lib/use-read-only";
import { toast } from "sonner";

type Entry = {
  userId: string;
  userName: string;
  avatarColor: string;
  count: number;
  target: number;
  source: "manual" | "salesforce";
  isSelfReported: boolean;
  lastEvidenceNote: string | null;
};

type WeekMetric = {
  metric: { id: number; name: string; description: string; targetCount: number; cadence: string; appliesTo: string };
  weekStart: string;
  entries: Entry[];
};

async function fetchThisWeek(): Promise<WeekMetric[]> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}api/recurring-metrics/this-week`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load weekly KPIs");
  return res.json();
}

async function updateCount(payload: {
  metricId: number;
  userId: string;
  count: number;
  evidenceNote?: string | null;
  evidenceUrl?: string | null;
}) {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}api/metric-entries`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update count");
  }
  return res.json();
}

export function WeeklyKpiPanel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: me } = useGetMe({ query: { enabled: !!user, queryKey: getGetMeQueryKey() } });
  const { data, isLoading } = useQuery({ queryKey: ["recurring-metrics-this-week"], queryFn: fetchThisWeek });
  const { data: lockStatus } = useGetWeekLockStatus();
  const unlockMut = useUnlockWeek();
  const [evidenceFor, setEvidenceFor] = useState<{
    metricId: number;
    userId: string;
    userName: string;
    metricName: string;
    nextCount: number;
  } | null>(null);
  const [auditFor, setAuditFor] = useState<{ id: number; name: string } | null>(null);

  const mutation = useMutation({
    mutationFn: updateCount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-metrics-this-week"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const readOnly = useReadOnly();
  const kpiPerms = me?.permissions ?? [];
  const canEditAny = kpiPerms.includes("manage_metrics");
  const isVpAdmin = kpiPerms.includes("manage_metrics");

  const handleUnlockPrior = async () => {
    if (!lockStatus) return;
    const reason = window.prompt(
      `Unlock previous week (${lockStatus.priorWeekStart}) for late edits?\nEnter reason (will be recorded in audit log):`,
    );
    if (!reason) return;
    try {
      await unlockMut.mutateAsync({ data: { periodStart: lockStatus.priorWeekStart, reason } });
      queryClient.invalidateQueries({ queryKey: getGetWeekLockStatusQueryKey() });
      toast.success("Previous week unlocked for late edits");
    } catch {
      toast.error("Failed to unlock");
    }
  };

  if (isLoading || !data) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Loading weekly KPIs...</CardContent></Card>;
  }
  if (data.length === 0) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No recurring KPIs configured.</CardContent></Card>;
  }

  const tryUpdate = (
    metricId: number,
    userId: string,
    userName: string,
    metricName: string,
    nextCount: number,
    oldCount: number,
  ) => {
    if (nextCount > oldCount) {
      // Evidence required modal
      setEvidenceFor({ metricId, userId, userName, metricName, nextCount });
    } else {
      mutation.mutate({ metricId, userId, count: Math.max(0, nextCount) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-xl font-serif font-bold">Weekly KPIs</h2>
            <p className="text-xs text-muted-foreground">Week of {data[0]?.weekStart}</p>
          </div>
        </div>
        {lockStatus && (
          <div className="flex items-center gap-2 text-xs">
            {lockStatus.overrideActive ? (
              <Badge variant="secondary" className="gap-1"><Unlock className="w-3 h-3" /> Prior week unlocked</Badge>
            ) : lockStatus.lockActive ? (
              <Badge variant="outline" className="gap-1"><Lock className="w-3 h-3" /> Prior week locked</Badge>
            ) : (
              <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> Locks Mon 9am</Badge>
            )}
            {isVpAdmin && lockStatus.lockActive && !lockStatus.overrideActive && (
              <Button size="sm" variant="ghost" onClick={handleUnlockPrior} data-testid="button-unlock-week">
                <Unlock className="w-3 h-3 mr-1" /> Unlock prior week
              </Button>
            )}
          </div>
        )}
      </div>

      {data.map((wm) => {
        const target = wm.metric.targetCount;
        const totalCount = wm.entries.reduce((s, e) => s + e.count, 0);
        const totalTarget = target * wm.entries.length;
        const onTarget = wm.entries.filter((e) => e.count >= target).length;
        return (
          <Card key={wm.metric.id}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
                <div className="min-w-0">
                  <h3 className="font-serif font-bold text-lg flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    {wm.metric.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">{wm.metric.description}</p>
                </div>
                <div className="text-right shrink-0 flex items-start gap-2">
                  <div>
                    <div className="text-2xl font-serif font-bold">
                      {totalCount}<span className="text-sm text-muted-foreground font-normal">/{totalTarget}</span>
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {onTarget}/{wm.entries.length} on target
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setAuditFor({ id: wm.metric.id, name: wm.metric.name })}
                    data-testid={`button-audit-${wm.metric.id}`}
                    title="View audit history"
                  >
                    <History className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {wm.entries.map((e) => {
                  const pct = Math.min(100, Math.round((e.count / target) * 100));
                  const hit = e.count >= target;
                  const canEdit = !readOnly && (canEditAny || e.userId === me?.id);
                  return (
                    <div
                      key={e.userId}
                      className={`rounded-lg border p-3 ${hit ? "border-emerald-300 bg-emerald-50/40" : "bg-card"}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarFallback style={{ backgroundColor: e.avatarColor, color: "white", fontSize: 11 }}>
                            {getInitials(e.userName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm font-semibold truncate">{e.userName}</span>
                              {e.source === "salesforce" ? (
                                <Badge variant="secondary" className="text-[9px] gap-0.5 px-1.5">
                                  <ShieldCheck className="w-2.5 h-2.5" /> SF
                                </Badge>
                              ) : e.isSelfReported && e.count > 0 ? (
                                <Badge variant="outline" className="text-[9px] px-1.5" title="Self-reported">SR</Badge>
                              ) : null}
                            </div>
                            <span className={`font-mono text-sm shrink-0 ${hit ? "text-emerald-700 font-bold" : ""}`}>
                              {e.count}/{target} {hit && "✓"}
                            </span>
                          </div>
                          <Progress value={pct} className="h-1.5 mt-1" />
                          {e.lastEvidenceNote && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="text-[10px] text-muted-foreground hover:text-foreground mt-1 truncate block max-w-full text-left underline-offset-2 hover:underline">
                                  📝 {e.lastEvidenceNote}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="max-w-xs text-xs">{e.lastEvidenceNote}</PopoverContent>
                            </Popover>
                          )}
                        </div>
                        {canEdit && (
                          <div className="flex gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              disabled={e.count <= 0 || mutation.isPending}
                              onClick={() =>
                                tryUpdate(wm.metric.id, e.userId, e.userName, wm.metric.name, e.count - 1, e.count)
                              }
                              data-testid={`button-kpi-dec-${e.userId}`}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              disabled={mutation.isPending}
                              onClick={() =>
                                tryUpdate(wm.metric.id, e.userId, e.userName, wm.metric.name, e.count + 1, e.count)
                              }
                              data-testid={`button-kpi-inc-${e.userId}`}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {evidenceFor && (
        <EvidenceDialog
          open
          onOpenChange={(o) => !o && setEvidenceFor(null)}
          info={evidenceFor}
          onSubmit={(note, url) => {
            mutation.mutate(
              {
                metricId: evidenceFor.metricId,
                userId: evidenceFor.userId,
                count: evidenceFor.nextCount,
                evidenceNote: note,
                evidenceUrl: url,
              },
              {
                onSuccess: () => {
                  toast.success("Logged with evidence");
                  setEvidenceFor(null);
                },
              },
            );
          }}
        />
      )}

      {auditFor && (
        <AuditDialog metricId={auditFor.id} metricName={auditFor.name} open onOpenChange={(o) => !o && setAuditFor(null)} />
      )}
    </div>
  );
}

function EvidenceDialog({
  open,
  onOpenChange,
  info,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  info: { userName: string; metricName: string; nextCount: number };
  onSubmit: (note: string, url: string | null) => void;
}) {
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Evidence required</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Logging <strong>{info.metricName}</strong> for <strong>{info.userName}</strong> (count → {info.nextCount}). Add a brief note so VP can verify.
          </p>
          <div className="space-y-1">
            <label className="text-sm font-medium">Note</label>
            <Textarea
              autoFocus
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Followed up with Acme franchisee re: disclosure docs"
              data-testid="textarea-evidence-note"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Link (optional)</label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => onSubmit(note, url || null)} disabled={!note.trim()} data-testid="button-evidence-submit">
              Log
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AuditDialog({
  metricId,
  metricName,
  open,
  onOpenChange,
}: {
  metricId: number;
  metricName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: entries, isLoading } = useListMetricAudit(metricId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="w-5 h-5" /> {metricName} — audit history</DialogTitle></DialogHeader>
        {isLoading ? (
          <div className="p-6 text-center text-muted-foreground text-sm">Loading...</div>
        ) : !entries || entries.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">No changes recorded yet.</div>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="border rounded-md p-3 text-sm space-y-1">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div className="font-medium">{e.userName}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString()} · Week {e.periodStart}
                  </div>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground">Count:</span> <span className="font-mono">{e.oldCount}</span>
                  <span className="mx-1">→</span>
                  <span className="font-mono font-bold">{e.newCount}</span>
                  <Badge variant="outline" className="ml-2 text-[9px]">{e.source}</Badge>
                </div>
                {e.evidenceNote && <div className="text-xs italic text-muted-foreground">"{e.evidenceNote}"</div>}
                {e.evidenceUrl && (
                  <a href={e.evidenceUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline truncate block">
                    {e.evidenceUrl}
                  </a>
                )}
                <div className="text-[10px] text-muted-foreground">Logged by {e.changedByName}</div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
