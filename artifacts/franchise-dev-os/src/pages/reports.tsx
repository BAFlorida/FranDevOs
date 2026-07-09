import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Download,
  FileSpreadsheet,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Target,
  FileText,
  Pencil,
  Paperclip,
  ExternalLink,
} from "lucide-react";
import {
  useGetMe,
  useListFocusAreaTargets,
  useUpsertFocusAreaTarget,
  getGetMeQueryKey,
  getListFocusAreaTargetsQueryKey,
  getGetReportTreeQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";

const apiBase = () => import.meta.env.BASE_URL + "api";

type ReportTree = {
  generatedAt: string;
  totals: { projects: number; tasks: number; complete: number; blocked: number; overdue: number; avgCompletion: number };
  focusAreas: {
    focusAreaId: number;
    focusAreaName: string;
    percentComplete: number;
    projectCount: number;
    taskCount: number;
    overdueCount: number;
    target: {
      focusAreaId: number;
      focusAreaName: string;
      goalText: string;
      targetNumeric: number | null;
      currentNumeric: number;
      unitLabel: string;
      updatedByName: string | null;
      updatedAt: string;
    } | null;
    projects: {
      id: string;
      name: string;
      executiveOwnerName: string | null;
      strategicGoal: string;
      status: string;
      healthColor: string;
      percentComplete: number;
      taskCount: number;
      overdueCount: number;
      blockedCount: number;
      tasks: {
        id: number;
        description: string;
        assigneeName: string;
        status: string;
        priority: string;
        percentComplete: number;
        dueDate: string | null;
        isOverdue: boolean;
        completedAt: string | null;
        blockNotes: string | null;
        attachments?: { id: number; label: string; url: string }[];
      }[];
    }[];
  }[];
};

async function fetchTree(): Promise<ReportTree> {
  const res = await fetch(`${apiBase()}/reports/tree`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load report tree");
  return res.json();
}

export default function ReportsPage() {
  const { user } = useAuth();
  const { data: me } = useGetMe({ query: { enabled: !!user, queryKey: getGetMeQueryKey() } });
  const { data, isLoading, error } = useQuery({ queryKey: getGetReportTreeQueryKey(), queryFn: fetchTree });
  const { data: targets } = useListFocusAreaTargets();
  const [downloading, setDownloading] = useState(false);
  const [expandedAreas, setExpandedAreas] = useState<Set<number>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [editTargetId, setEditTargetId] = useState<number | null>(null);

  const perms = me?.permissions ?? [];
  const canAccess = perms.includes("view_reports") || perms.includes("run_reports");
  const canExport = perms.includes("run_reports");

  if (!canAccess) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <Card className="border-destructive/30">
          <CardContent className="p-8 text-center space-y-2">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <h2 className="text-xl font-serif font-bold">Restricted</h2>
            <p className="text-muted-foreground text-sm">Reports available to Leads, VP, and Admins.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const downloadFile = async (path: string, filename: string) => {
    setDownloading(true);
    try {
      const res = await fetch(`${apiBase()}${path}`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
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

  const openBoardBrief = () => {
    window.open(`${apiBase()}/reports/board-brief`, "_blank");
  };

  const toggleArea = (id: number) => {
    const next = new Set(expandedAreas);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedAreas(next);
  };
  const toggleProject = (id: string) => {
    const next = new Set(expandedProjects);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedProjects(next);
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading report...</div>;
  if (error || !data) return <div className="p-8 text-center text-destructive">Failed to load report</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-primary" />
            PE Board Readiness Pack
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Drill-down view with strategic targets · Generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>
        {canExport && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={openBoardBrief} data-testid="button-board-brief">
              <FileText className="w-4 h-4 mr-2" /> Board Brief (PDF)
            </Button>
            <Button
              onClick={() =>
                downloadFile("/reports/export.xlsx", `franchise-dev-report-${new Date().toISOString().slice(0, 10)}.xlsx`)
              }
              disabled={downloading}
              data-testid="button-export-xlsx"
            >
              <Download className="w-4 h-4 mr-2" /> {downloading ? "Generating..." : "Excel"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-serif font-bold">{data.totals.projects}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tactics</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-serif font-bold">{data.totals.tasks}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tasks</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-serif font-bold">{data.totals.avgCompletion}%</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-serif font-bold text-emerald-600">{data.totals.complete}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Complete</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className={`text-2xl font-serif font-bold ${data.totals.blocked > 0 ? "text-amber-600" : ""}`}>{data.totals.blocked}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Blocked</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className={`text-2xl font-serif font-bold ${data.totals.overdue > 0 ? "text-destructive" : ""}`}>{data.totals.overdue}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overdue</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {data.focusAreas.map((area) => {
              const isOpen = expandedAreas.has(area.focusAreaId);
              const target = area.target ?? targets?.find((t) => t.focusAreaId === area.focusAreaId);
              const targetPct =
                target && target.targetNumeric && target.targetNumeric > 0
                  ? Math.round((target.currentNumeric / target.targetNumeric) * 100)
                  : null;
              return (
                <Collapsible key={area.focusAreaId} open={isOpen} onOpenChange={() => toggleArea(area.focusAreaId)}>
                  <CollapsibleTrigger className="w-full text-left">
                    <div className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-3">
                        {isOpen ? <ChevronDown className="w-4 h-4 mt-1.5 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 mt-1.5 text-muted-foreground" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-3 flex-wrap">
                            <h3 className="font-serif font-bold text-base">{area.focusAreaName}</h3>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{area.projectCount} tactics</span>
                              <span>{area.taskCount} tasks</span>
                              {area.overdueCount > 0 && (
                                <span className="text-destructive font-medium">{area.overdueCount} overdue</span>
                              )}
                              <span className="font-mono font-bold text-foreground">{area.percentComplete}%</span>
                            </div>
                          </div>
                          {target && (
                            <div className="mt-2 rounded-md bg-primary/5 border border-primary/20 p-2.5 text-xs">
                              <div className="flex items-start gap-2">
                                <Target className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-foreground">{target.goalText}</div>
                                  <div className="text-muted-foreground mt-0.5">
                                    <span className="font-mono font-bold text-foreground">{target.currentNumeric}</span>
                                    {target.targetNumeric ? <> / <span className="font-mono">{target.targetNumeric}</span></> : null}{" "}
                                    {target.unitLabel}
                                    {targetPct !== null && (
                                      <Badge variant={targetPct >= 100 ? "default" : targetPct >= 75 ? "secondary" : "outline"} className="ml-2">
                                        {targetPct}%
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                {canExport && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditTargetId(area.focusAreaId);
                                    }}
                                    data-testid={`button-edit-target-${area.focusAreaId}`}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                          <Progress value={area.percentComplete} className="h-1.5 mt-2" />
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="bg-muted/20 px-6 pb-4 pt-1 space-y-2">
                      {area.projects.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic py-2">No tactics in this pillar.</div>
                      ) : (
                        area.projects.map((p) => {
                          const pOpen = expandedProjects.has(p.id);
                          return (
                            <Collapsible key={p.id} open={pOpen} onOpenChange={() => toggleProject(p.id)}>
                              <CollapsibleTrigger className="w-full text-left">
                                <div className="rounded-md bg-card border p-3 hover:bg-muted/30">
                                  <div className="flex items-start gap-2">
                                    {pOpen ? <ChevronDown className="w-3.5 h-3.5 mt-1 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 mt-1 text-muted-foreground" />}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                                        <div className="min-w-0">
                                          <span className="font-mono text-[10px] text-muted-foreground mr-2">{p.id}</span>
                                          <span className="font-semibold text-sm">{p.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                          {p.executiveOwnerName && <span>Owner: {p.executiveOwnerName}</span>}
                                          <Badge variant="outline" className="text-[9px]">{p.status}</Badge>
                                          <span className="font-mono font-bold text-foreground">{p.percentComplete}%</span>
                                        </div>
                                      </div>
                                      <Progress value={p.percentComplete} className="h-1 mt-1.5" />
                                      <div className="flex gap-3 text-[10px] text-muted-foreground mt-1.5">
                                        <span>{p.taskCount} tasks</span>
                                        {p.overdueCount > 0 && <span className="text-destructive font-medium">{p.overdueCount} overdue</span>}
                                        {p.blockedCount > 0 && <span className="text-amber-600 font-medium">{p.blockedCount} blocked</span>}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="ml-6 mt-2 border-l-2 border-primary/20 pl-3 space-y-1">
                                  {p.tasks.length === 0 ? (
                                    <div className="text-[11px] italic text-muted-foreground py-1">No tasks.</div>
                                  ) : (
                                    p.tasks.map((t) => (
                                      <div key={t.id} className="text-xs py-1.5 border-b border-muted/30 last:border-0">
                                        <div className="flex items-baseline justify-between gap-2">
                                          <div className="min-w-0 flex-1">
                                            <span className="truncate">{t.description}</span>
                                            <span className="text-muted-foreground ml-2">— {t.assigneeName}</span>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0 text-[10px]">
                                            <Badge variant="outline" className="text-[9px]">{t.status}</Badge>
                                            {t.dueDate && (
                                              <span className={t.isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                                                Due {formatDate(t.dueDate)}
                                              </span>
                                            )}
                                            {t.completedAt && (
                                              <span className="text-emerald-700 font-medium">
                                                ✓ {formatDate(t.completedAt.slice(0, 10))}
                                              </span>
                                            )}
                                            <span className="font-mono w-9 text-right">{t.percentComplete}%</span>
                                          </div>
                                        </div>
                                        {t.blockNotes && (
                                          <div className="mt-1 ml-1 text-[10px] text-amber-700 italic">
                                            Blocker: {t.blockNotes}
                                          </div>
                                        )}
                                        {t.attachments && t.attachments.length > 0 && (
                                          <div className="mt-1 ml-1 flex flex-wrap items-center gap-1.5">
                                            <Paperclip className="w-3 h-3 text-muted-foreground" />
                                            {t.attachments.map((a) => (
                                              <a
                                                key={a.id}
                                                href={a.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 max-w-[220px] truncate"
                                                title={a.url}
                                                data-testid={`link-attachment-${a.id}`}
                                              >
                                                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                                <span className="truncate">{a.label}</span>
                                              </a>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {editTargetId !== null && targets && (() => {
        const t = targets.find((x) => x.focusAreaId === editTargetId);
        return (
          <TargetEditDialog
            focusAreaId={editTargetId}
            currentTarget={
              t
                ? {
                    goalText: t.goalText,
                    targetNumeric: t.targetNumeric ?? null,
                    currentNumeric: t.currentNumeric,
                    unitLabel: t.unitLabel,
                  }
                : undefined
            }
            focusAreaName={data.focusAreas.find((a) => a.focusAreaId === editTargetId)?.focusAreaName ?? ""}
            open
            onOpenChange={(o) => !o && setEditTargetId(null)}
          />
        );
      })()}
    </div>
  );
}

function TargetEditDialog({
  focusAreaId,
  focusAreaName,
  currentTarget,
  open,
  onOpenChange,
}: {
  focusAreaId: number;
  focusAreaName: string;
  currentTarget?: {
    goalText: string;
    targetNumeric: number | null;
    currentNumeric: number;
    unitLabel: string;
  };
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [goalText, setGoalText] = useState(currentTarget?.goalText ?? "");
  const [targetNumeric, setTargetNumeric] = useState(currentTarget?.targetNumeric?.toString() ?? "");
  const [currentNumeric, setCurrentNumeric] = useState(currentTarget?.currentNumeric.toString() ?? "0");
  const [unitLabel, setUnitLabel] = useState(currentTarget?.unitLabel ?? "");
  const mut = useUpsertFocusAreaTarget();
  const qc = useQueryClient();

  const save = async () => {
    try {
      await mut.mutateAsync({
        data: {
          focusAreaId,
          goalText,
          targetNumeric: targetNumeric ? Number(targetNumeric) : null,
          currentNumeric: Number(currentNumeric) || 0,
          unitLabel,
        },
      });
      qc.invalidateQueries({ queryKey: getListFocusAreaTargetsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetReportTreeQueryKey() });
      toast.success("Target updated");
      onOpenChange(false);
    } catch {
      toast.error("Failed to save target");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Strategic Target — {focusAreaName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Goal statement</label>
            <Input value={goalText} onChange={(e) => setGoalText(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Current</label>
              <Input type="number" value={currentNumeric} onChange={(e) => setCurrentNumeric(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Target</label>
              <Input type="number" value={targetNumeric} onChange={(e) => setTargetNumeric(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Unit</label>
              <Input value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={mut.isPending}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
