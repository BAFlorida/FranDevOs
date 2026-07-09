import {
  useListProjects,
  useListFocusAreas,
  HealthColor,
  ProjectStatus,
  type ProjectWithRollup,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import {
  Plus,
  FolderKanban,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  CheckSquare,
  Circle,
  X,
  Layers,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useSearch } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { ProjectFormDialog } from "@/components/project-form-dialog";
import { PillarFormDialog } from "@/components/pillar-form-dialog";
import { EditPillarDialog } from "@/components/edit-pillar-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const STATUS_FILTERS: Record<
  string,
  { label: string; predicate: (p: ProjectWithRollup) => boolean; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  onTrack: {
    label: "On Track",
    predicate: (p) => p.rollup.status === ProjectStatus.In_Progress,
    color: "text-green-600 bg-green-50 border-green-200",
    icon: CheckCircle2,
  },
  atRisk: {
    label: "At Risk",
    predicate: (p) => p.rollup.status === ProjectStatus.At_Risk,
    color: "text-amber-700 bg-amber-50 border-amber-200",
    icon: Clock,
  },
  blocked: {
    label: "Blocked",
    predicate: (p) => p.rollup.status === ProjectStatus.Blocked,
    color: "text-destructive bg-destructive/5 border-destructive/30",
    icon: AlertCircle,
  },
  complete: {
    label: "Complete",
    predicate: (p) => p.rollup.status === ProjectStatus.Complete,
    color: "text-indigo-700 bg-indigo-50 border-indigo-200",
    icon: CheckSquare,
  },
  notStarted: {
    label: "Not Started",
    predicate: (p) => p.rollup.status === ProjectStatus.Not_Started,
    color: "text-gray-700 bg-gray-50 border-gray-200",
    icon: Circle,
  },
};

const healthBorder: Record<string, string> = {
  [HealthColor.green]: "border-l-green-500",
  [HealthColor.amber]: "border-l-amber-500",
  [HealthColor.red]: "border-l-destructive",
  [HealthColor.gray]: "border-l-border",
};

function ProjectCard({ project }: { project: ProjectWithRollup }) {
  const border = healthBorder[project.rollup.healthColor] || healthBorder[HealthColor.gray];
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className={`hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5 border-l-4 ${border}`}>
        <CardContent className="p-4 flex flex-col h-full">
          <div className="flex justify-between items-start mb-2 gap-2">
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-background rounded border border-border shrink-0">
              {project.id}
            </span>
            {project.rollup.overdueCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {project.rollup.overdueCount} OVERDUE
              </Badge>
            )}
          </div>
          <h3 className="font-serif font-bold text-sm mb-3 line-clamp-3 leading-snug">{project.name}</h3>

          <div className="mt-auto space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">{project.rollup.status}</span>
                <span className="font-bold">{Math.round(project.rollup.percentComplete)}%</span>
              </div>
              <Progress value={project.rollup.percentComplete} className="h-1.5" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <Avatar className="w-6 h-6">
                <AvatarFallback className="bg-primary text-primary-foreground" style={{ fontSize: 10 }}>
                  {getInitials(project.executiveOwnerName || "?")}
                </AvatarFallback>
              </Avatar>
              <span className="text-[11px] text-muted-foreground">{project.rollup.taskCount} tasks</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ProjectsPage() {
  const { data: projects, isLoading } = useListProjects();
  const { data: focusAreas } = useListFocusAreas();
  const { user } = useAuth();
  const { data: me } = useGetMe({ query: { enabled: !!user, queryKey: getGetMeQueryKey() } });
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [pillarModalOpen, setPillarModalOpen] = useState(false);
  const [addTacticFocusAreaId, setAddTacticFocusAreaId] = useState<number | undefined>(undefined);
  const [editPillar, setEditPillar] = useState<{ id: number; name: string } | null>(null);
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const statusKey = searchParams.get("status");
  const pillarKey = searchParams.get("pillar");
  const filter = statusKey ? STATUS_FILTERS[statusKey] : null;

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading tactics...</div>;
  }

  const canCreate = (me?.permissions ?? []).includes("edit_initiatives");
  const canDeletePillar = (me?.permissions ?? []).includes("delete_initiatives");
  const all = projects ?? [];

  // Pillar filter mode (from dashboard Strategic Pillar chart click)
  const pillarId = pillarKey ? Number(pillarKey) : null;
  if (pillarId != null && !Number.isNaN(pillarId)) {
    const pillar = (focusAreas ?? []).find((fa) => fa.id === pillarId);
    const pillarProjects = all
      .filter((p) => p.focusAreaId === pillarId)
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-serif font-bold flex items-center gap-3">
            <FolderKanban className="w-8 h-8 text-primary" />
            Tactics
          </h1>
          <div className="flex items-center gap-2">
            <Link href="/projects">
              <Button variant="outline" size="sm">
                <X className="w-3.5 h-3.5 mr-1" /> Clear filter
              </Button>
            </Link>
            {canCreate && (
              <Button className="font-medium shadow-sm" onClick={() => { setAddTacticFocusAreaId(pillarId); setProjectModalOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> New Tactic
              </Button>
            )}
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium text-primary bg-primary/5 border-primary/20">
          <Layers className="w-4 h-4" />
          <span>Pillar: {pillar?.name ?? `#${pillarId}`}</span>
          <span className="font-bold">· {pillarProjects.length}</span>
        </div>

        {pillarProjects.length === 0 ? (
          <div className="p-12 text-center border border-dashed rounded-lg bg-card text-muted-foreground">
            No tactics in this pillar.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pillarProjects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}

        {canCreate && (
          <ProjectFormDialog
            open={projectModalOpen}
            onOpenChange={(o) => {
              setProjectModalOpen(o);
              if (!o) setAddTacticFocusAreaId(undefined);
            }}
            defaultFocusAreaId={addTacticFocusAreaId}
          />
        )}
      </div>
    );
  }

  // Filter mode (from dashboard KPI click)
  if (filter) {
    const FilterIcon = filter.icon;
    const filtered = all.filter(filter.predicate);
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-serif font-bold flex items-center gap-3">
            <FolderKanban className="w-8 h-8 text-primary" />
            Tactics
          </h1>
          <div className="flex items-center gap-2">
            <Link href="/projects">
              <Button variant="outline" size="sm">
                <X className="w-3.5 h-3.5 mr-1" /> Clear filter
              </Button>
            </Link>
            {canCreate && (
              <Button className="font-medium shadow-sm" onClick={() => setProjectModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> New Tactic
              </Button>
            )}
          </div>
        </div>

        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${filter.color}`}>
          <FilterIcon className="w-4 h-4" />
          <span>Filtered: {filter.label}</span>
          <span className="font-bold">· {filtered.length}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center border border-dashed rounded-lg bg-card text-muted-foreground">
            No tactics match this status.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}

        {canCreate && (
          <ProjectFormDialog open={projectModalOpen} onOpenChange={setProjectModalOpen} />
        )}
      </div>
    );
  }

  // Default mode: group by focus area
  const byArea = new Map<number, ProjectWithRollup[]>();
  for (const p of all) {
    const arr = byArea.get(p.focusAreaId) ?? [];
    arr.push(p);
    byArea.set(p.focusAreaId, arr);
  }

  const orderedAreas = (focusAreas ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold flex items-center gap-3">
          <FolderKanban className="w-8 h-8 text-primary" />
          Tactics
        </h1>
        {canCreate && (
          <div className="flex items-center gap-2">
            <Button variant="outline" className="font-medium" onClick={() => setPillarModalOpen(true)} data-testid="button-new-pillar">
              <Layers className="w-4 h-4 mr-2" /> New Pillar
            </Button>
            <Button className="font-medium shadow-sm" onClick={() => { setAddTacticFocusAreaId(undefined); setProjectModalOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> New Tactic
            </Button>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {orderedAreas.length} strategic pillars · {all.length} tactics · click a pillar to drill in
      </p>

      {orderedAreas.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-lg bg-card text-muted-foreground">
          No strategic pillars configured.
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {orderedAreas.map((area) => {
            const areaProjects = (byArea.get(area.id) ?? []).slice().sort((a, b) =>
              a.id.localeCompare(b.id, undefined, { numeric: true }),
            );
            const activeCount = areaProjects.filter((p) => p.rollup.taskCount > 0).length;
            const overdueCount = areaProjects.reduce((acc, p) => acc + p.rollup.overdueCount, 0);
            const blockedCount = areaProjects.filter((p) => p.rollup.status === ProjectStatus.Blocked).length;
            const totalTasks = areaProjects.reduce((acc, p) => acc + p.rollup.taskCount, 0);
            const avgPct = areaProjects.length
              ? Math.round(
                  areaProjects.reduce((acc, p) => acc + p.rollup.percentComplete, 0) / areaProjects.length,
                )
              : 0;
            const accentClass =
              overdueCount > 0 || blockedCount > 0
                ? "border-l-amber-500"
                : avgPct >= 100
                  ? "border-l-indigo-500"
                  : activeCount > 0
                    ? "border-l-green-500"
                    : "border-l-border";

            return (
              <AccordionItem
                key={area.id}
                value={`area-${area.id}`}
                className={`bg-card rounded-lg border border-border border-l-4 ${accentClass} overflow-hidden`}
              >
                <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/40 [&[data-state=open]>div>.chev]:rotate-90">
                  <div className="flex items-center justify-between w-full gap-4 mr-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <ChevronRight className="chev w-4 h-4 text-muted-foreground transition-transform shrink-0" />
                      <div className="text-left min-w-0">
                        <h2 className="font-serif font-bold text-lg leading-tight truncate">{area.name}</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {areaProjects.length} tactics · {totalTasks} tasks
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-5 shrink-0">
                      <div className="text-center hidden sm:block">
                        <p className="text-base font-serif font-bold">{activeCount}</p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Active</p>
                      </div>
                      <div className="text-center hidden md:block">
                        <p className={`text-base font-serif font-bold ${overdueCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {overdueCount}
                        </p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Overdue</p>
                      </div>
                      <div className="text-center hidden md:block">
                        <p className={`text-base font-serif font-bold ${blockedCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {blockedCount}
                        </p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Blocked</p>
                      </div>
                      <div className="w-32 hidden lg:block">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-bold">{avgPct}%</span>
                        </div>
                        <Progress value={avgPct} className="h-1.5" />
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5 pt-1">
                  {areaProjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No tactics in this pillar.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {areaProjects.map((p) => (
                        <ProjectCard key={p.id} project={p} />
                      ))}
                    </div>
                  )}
                  {canCreate && (
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditPillar({ id: area.id, name: area.name })}
                        data-testid={`button-edit-pillar-${area.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Edit Pillar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAddTacticFocusAreaId(area.id);
                          setProjectModalOpen(true);
                        }}
                        data-testid={`button-add-tactic-${area.id}`}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Tactic to {area.name}
                      </Button>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {canCreate && (
        <>
          <ProjectFormDialog
            open={projectModalOpen}
            onOpenChange={(o) => {
              setProjectModalOpen(o);
              if (!o) setAddTacticFocusAreaId(undefined);
            }}
            defaultFocusAreaId={addTacticFocusAreaId}
          />
          <PillarFormDialog open={pillarModalOpen} onOpenChange={setPillarModalOpen} />
          <EditPillarDialog
            open={editPillar !== null}
            onOpenChange={(o) => {
              if (!o) setEditPillar(null);
            }}
            pillar={editPillar}
            canDelete={canDeletePillar}
          />
        </>
      )}
    </div>
  );
}
