import { useState } from "react";
import {
  useListEscalations,
  useListBlockedTasks,
  useResolveEscalation,
  useListUsers,
  useGetMe,
  getGetMeQueryKey,
  getListEscalationsQueryKey,
  getListBlockedTasksQueryKey,
  getListTasksQueryKey,
  getListProjectsQueryKey,
  getGetDashboardQueryKey,
  getGetReportTreeQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { PriorityChip } from "@/components/ui/priority-chip";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getInitials } from "@/lib/utils";
import { Link } from "wouter";
import { ShieldAlert, CheckCircle2, Ban } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function RoadblocksPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: me } = useGetMe({ query: { enabled: !!user, queryKey: getGetMeQueryKey() } });
  const canApprove = (me?.permissions ?? []).includes("approve_completion");

  const { data: escalations, isLoading } = useListEscalations({
    query: { enabled: !!me, queryKey: getListEscalationsQueryKey() } as any,
  });
  const { data: blockedTasks, isLoading: blockedLoading } = useListBlockedTasks({
    query: { enabled: !!me && canApprove, queryKey: getListBlockedTasksQueryKey() } as any,
  });
  const { data: users } = useListUsers();
  const resolveMutation = useResolveEscalation();

  const [resolving, setResolving] = useState<any | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [reassign, setReassign] = useState(false);
  const [reassignToId, setReassignToId] = useState("");

  const queue = escalations ?? [];

  const openResolve = (task: any) => {
    setResolving(task);
    setResolutionNote("");
    setReassign(false);
    setReassignToId("");
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListEscalationsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListBlockedTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetReportTreeQueryKey() });
  };

  const submitResolve = async () => {
    if (!resolving) return;
    if (reassign && !reassignToId) {
      toast.error("Pick who to reassign the task to");
      return;
    }
    try {
      await resolveMutation.mutateAsync({
        id: resolving.id,
        data: {
          resolutionNote: resolutionNote.trim() || null,
          reassignToId: reassign ? reassignToId : null,
        },
      });
      toast.success(
        reassign ? "Resolved and reassigned" : "Resolved — returned to the original developer",
      );
      invalidate();
      setResolving(null);
    } catch {
      toast.error("Failed to resolve the roadblock");
    }
  };

  if (me && !canApprove) {
    return (
      <div className="max-w-7xl mx-auto">
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground">
            You don't have access to this page.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Original developer is who the task returns to by default.
  const returnName =
    resolving?.escalationOriginalAssigneeName || resolving?.assigneeName || "the original developer";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <ShieldAlert className="w-7 h-7 text-amber-600" />
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Roadblocks</h1>
          <p className="text-sm text-muted-foreground">
            Roadblocks your team escalated to you. Resolve to unblock — the task returns to the
            developer by default, or reassign it if someone else should pick it up.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Loading…</div>
      ) : queue.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
            No roadblocks need your attention right now.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {queue.map((task) => (
            <Card key={task.id} className="border-amber-200" data-testid={`card-escalation-${task.id}`}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <PriorityChip priority={task.priority} />
                      <span className="text-xs font-mono text-muted-foreground">{task.projectCode}</span>
                      <Link
                        href={`/projects/${task.projectId}`}
                        className="text-xs text-muted-foreground hover:underline hover:text-primary truncate"
                      >
                        {task.projectName}
                      </Link>
                    </div>
                    <p className="font-medium text-foreground">{task.description}</p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0"
                    onClick={() => openResolve(task)}
                    data-testid={`button-open-resolve-${task.id}`}
                  >
                    Resolve
                  </Button>
                </div>

                {task.roadblock && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">
                      What's blocking them
                    </p>
                    <p className="text-sm text-amber-900">{task.roadblock}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback
                        style={{ backgroundColor: task.assigneeAvatarColor || "#333", color: "white", fontSize: "10px" }}
                      >
                        {getInitials(task.escalatedByName || task.assigneeName || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      Raised by <span className="font-medium text-foreground">{task.escalatedByName || task.assigneeName}</span>
                    </span>
                  </div>
                  {task.escalatedAt && (
                    <span>Escalated {format(new Date(task.escalatedAt), "MMM d, yyyy")}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="pt-2">
        <div className="flex items-center gap-3 mb-1">
          <Ban className="w-6 h-6 text-muted-foreground" />
          <div>
            <h2 className="text-2xl font-serif font-bold text-foreground">Blocked across the team</h2>
            <p className="text-sm text-muted-foreground">
              Every task currently marked Blocked, whether or not it was escalated. Read-only — escalated
              roadblocks above are excluded so nothing shows up twice.
            </p>
          </div>
        </div>

        {blockedLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : (blockedTasks ?? []).length === 0 ? (
          <Card className="border-dashed mt-4">
            <CardContent className="p-12 text-center text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
              Nothing is blocked across the team right now.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 mt-4">
            {(blockedTasks ?? []).map((task) => (
              <Card key={task.id} className="border-muted" data-testid={`card-blocked-${task.id}`}>
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <PriorityChip priority={task.priority} />
                      <span className="text-xs font-mono text-muted-foreground">{task.projectCode}</span>
                      <Link
                        href={`/projects/${task.projectId}`}
                        className="text-xs text-muted-foreground hover:underline hover:text-primary truncate"
                      >
                        {task.projectName}
                      </Link>
                    </div>
                    <p className="font-medium text-foreground">{task.description}</p>
                  </div>

                  {(task.roadblock || task.blockNotes) && (
                    <div className="rounded-md bg-muted/50 border p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        What's blocking them
                      </p>
                      <p className="text-sm text-foreground">{task.roadblock || task.blockNotes}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback
                          style={{ backgroundColor: task.assigneeAvatarColor || "#333", color: "white", fontSize: "10px" }}
                        >
                          {getInitials(task.assigneeName || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <span>
                        Assigned to <span className="font-medium text-foreground">{task.assigneeName}</span>
                      </span>
                    </div>
                    {task.blockedByName && (
                      <span>
                        Needs <span className="font-medium text-foreground">{task.blockedByName}</span> to unblock
                      </span>
                    )}
                    {task.updatedAt && (
                      <span>Blocked since {format(new Date(task.updatedAt), "MMM d, yyyy")}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!resolving} onOpenChange={(o) => { if (!o) setResolving(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resolve roadblock</DialogTitle>
          </DialogHeader>
          {resolving && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/40 border p-3">
                <p className="text-sm font-medium">{resolving.description}</p>
                {resolving.roadblock && (
                  <p className="text-sm text-muted-foreground mt-1 italic">"{resolving.roadblock}"</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Resolution note (optional)</label>
                <Textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  rows={3}
                  placeholder="How did you unblock this? The developer will see this."
                  data-testid="input-resolution-note"
                />
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Reassign instead of returning</p>
                    <p className="text-xs text-muted-foreground">
                      {reassign
                        ? "Pick who should take this task over."
                        : `By default this returns to ${returnName}.`}
                    </p>
                  </div>
                  <Switch
                    checked={reassign}
                    onCheckedChange={(v) => setReassign(!!v)}
                    data-testid="switch-reassign"
                  />
                </div>
                {reassign && (
                  <Select value={reassignToId} onValueChange={setReassignToId}>
                    <SelectTrigger data-testid="select-reassign-to">
                      <SelectValue placeholder="Select who takes this over" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {(users ?? []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolving(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitResolve}
              disabled={resolveMutation.isPending}
              data-testid="button-submit-resolve"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {resolveMutation.isPending ? "Resolving…" : reassign ? "Resolve & reassign" : "Resolve & return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
