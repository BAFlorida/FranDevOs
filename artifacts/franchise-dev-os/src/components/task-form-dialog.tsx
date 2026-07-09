import { useListProjects, useListUsers, useListGroups, useGetMe, getGetMeQueryKey, useCreateTask, useUpdateTask, useBulkAssignTasks, useEscalateRoadblock, getListEscalationsQueryKey, TaskRole, TaskPriority, TaskStatus, getListTasksQueryKey, getListProjectsQueryKey, getGetProjectQueryKey, getGetDashboardQueryKey, useListTaskAttachments, createTaskAttachment, deleteTaskAttachment, getListTaskAttachmentsQueryKey, getGetReportTreeQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { useReadOnly } from "@/lib/use-read-only";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { AlertOctagon, Paperclip, ExternalLink, X, Plus, ArrowUpCircle, ShieldAlert, CheckCircle2 } from "lucide-react";

const schema = z.object({
  projectId: z.string().min(1, "Tactic is required"),
  assigneeId: z.string().min(1, "Assignee is required"),
  role: z.nativeEnum(TaskRole),
  description: z.string().min(1, "Description is required"),
  priority: z.nativeEnum(TaskPriority),
  status: z.nativeEnum(TaskStatus),
  percentComplete: z.number().min(0).max(100),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  dependency: z.string().optional().nullable(),
  roadblock: z.string().optional().nullable(),
  lastUpdate: z.string().optional().nullable(),
  nextStep: z.string().optional().nullable(),
  blockedById: z.string().optional().nullable(),
  blockNotes: z.string().optional().nullable(),
});

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaultProjectId,
  defaultAssigneeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: any;
  defaultProjectId?: string;
  defaultAssigneeId?: string;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: projects } = useListProjects();
  const { data: users } = useListUsers();
  const { data: groups } = useListGroups();
  const { data: me } = useGetMe({ query: { enabled: !!user, queryKey: getGetMeQueryKey() } });
  const isManager = (me?.permissions ?? []).includes("assign_tasks");
  const readOnly = useReadOnly();
  const canAssignGroups = !task && isManager;

  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const bulkAssignMutation = useBulkAssignTasks();
  const escalateMutation = useEscalateRoadblock();

  // Upward roadblock escalation. A developer may only escalate a task assigned
  // to them, and the target (their initiative's higher-up) is chosen by the
  // server — never picked here.
  const [escalateNote, setEscalateNote] = useState("");
  const isEscalated = !!task?.isEscalated;
  const canEscalate = !!task && !!me && task.assigneeId === me.id && !isEscalated;
  const wasResolved = !!task?.escalationResolvedAt;

  const submitEscalation = async () => {
    if (!task) return;
    const note = escalateNote.trim();
    if (!note) {
      toast.error("Describe what's blocking you before escalating");
      return;
    }
    try {
      await escalateMutation.mutateAsync({ id: task.id, data: { note } });
      toast.success("Roadblock escalated to your initiative's lead");
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListEscalationsQueryKey() });
      if (task.projectId) {
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(task.projectId) });
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn't escalate — there may be no higher-up to route to");
    }
  };

  // Attachments (deliverable links)
  const { data: existingAttachments } = useListTaskAttachments(task?.id ?? 0, {
    query: { enabled: !!task?.id && open } as any,
  });
  const [pendingNew, setPendingNew] = useState<{ label: string; url: string }[]>([]);
  const [removedExistingIds, setRemovedExistingIds] = useState<number[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  useEffect(() => {
    if (open) {
      setPendingNew([]);
      setRemovedExistingIds([]);
      setNewLabel("");
      setNewUrl("");
      setEscalateNote("");
    }
  }, [open, task?.id]);
  const visibleExisting = (existingAttachments ?? []).filter((a) => !removedExistingIds.includes(a.id));
  const addPending = () => {
    const lbl = newLabel.trim();
    let url = newUrl.trim();
    if (!lbl || !url) {
      toast.error("Both label and URL are required");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    setPendingNew((prev) => [...prev, { label: lbl, url }]);
    setNewLabel("");
    setNewUrl("");
  };

  const baseValues = (t?: any) => ({
    projectId: t?.projectId || defaultProjectId || "",
    assigneeId: t?.assigneeId || defaultAssigneeId || user?.id || "",
    role: t?.role || TaskRole.Owner,
    description: t?.description || "",
    priority: t?.priority || TaskPriority.Medium,
    status: t?.status || TaskStatus.Not_Started,
    percentComplete: t?.percentComplete || 0,
    startDate: t?.startDate ? format(new Date(t.startDate), 'yyyy-MM-dd') : "",
    dueDate: t?.dueDate ? format(new Date(t.dueDate), 'yyyy-MM-dd') : "",
    dependency: t?.dependency || "",
    roadblock: t?.roadblock || "",
    lastUpdate: t?.lastUpdate || "",
    nextStep: t?.nextStep || "",
    blockedById: t?.blockedById || "",
    blockNotes: t?.blockNotes || "",
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: baseValues(task),
  });

  useEffect(() => {
    if (open) form.reset(baseValues(task));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task, defaultProjectId, defaultAssigneeId, user]);

  const selectedProjectId = form.watch("projectId");
  const selectedProject = useMemo(() => projects?.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const status = form.watch("status");
  const isBlocked = status === TaskStatus.Blocked;
  const assigneeId = form.watch("assigneeId");
  const isGroupAssignSelected = canAssignGroups && typeof assigneeId === "string" && assigneeId.startsWith("group:");

  const onSubmit = (data: any) => {
    const payload: any = { ...data };
    // Defensive: a `group:` value must never reach createTask/updateTask.
    if (typeof payload.assigneeId === "string" && payload.assigneeId.startsWith("group:") && !canAssignGroups) {
      toast.error("Group assignment isn't available for this task");
      return;
    }
    if (!payload.startDate) payload.startDate = null;
    if (!payload.dueDate) payload.dueDate = null;
    // Only persist block fields when status is Blocked, else clear them
    if (payload.status !== TaskStatus.Blocked) {
      payload.blockedById = null;
      payload.blockNotes = null;
    } else {
      payload.blockedById = payload.blockedById || null;
      payload.blockNotes = payload.blockNotes || null;
    }

    const invalidateAll = (taskId: number | undefined, projectId?: string) => {
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetReportTreeQueryKey() });
      if (taskId) {
        queryClient.invalidateQueries({ queryKey: getListTaskAttachmentsQueryKey(taskId) });
      }
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      }
      if (task?.projectId && task.projectId !== projectId) {
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(task.projectId) });
      }
    };

    const isGroupAssign = canAssignGroups && typeof payload.assigneeId === "string" && payload.assigneeId.startsWith("group:");

    (async () => {
      // 1) Save the task — surfaces its own error and aborts on failure.
      let savedTaskId: number;
      try {
        if (isGroupAssign) {
          const groupId = Number(payload.assigneeId.slice("group:".length));
          const res = await bulkAssignMutation.mutateAsync({
            data: {
              groupId,
              projectId: payload.projectId,
              description: payload.description,
              role: payload.role,
              priority: payload.priority,
              status: payload.status,
              percentComplete: payload.percentComplete,
              startDate: payload.startDate || null,
              dueDate: payload.dueDate || null,
              nextStep: payload.nextStep || null,
              attachments: pendingNew.map((p) => ({ label: p.label, url: p.url })),
            },
          });
          savedTaskId = res.parentTaskId;
          toast.success(`Assigned to group — ${res.childTaskIds.length} member task${res.childTaskIds.length === 1 ? "" : "s"} created`);
        } else {
          const saved = task
            ? await updateMutation.mutateAsync({ id: task.id, data: payload })
            : await createMutation.mutateAsync({ data: payload });
          savedTaskId = (saved as { id: number }).id;
          toast.success(task ? "Task updated" : "Task created");
        }
      } catch {
        toast.error("Failed to save task");
        return;
      }

      // 2) Apply attachment changes independently. Partial failure is reported
      // but never causes the user to re-create the task. For group fan-out the
      // deliverable links are sent inline with the bulk-assign request (copied
      // onto every member's task), so we skip the per-task attachment calls here.
      if (!isGroupAssign) {
        const results = await Promise.allSettled([
          ...removedExistingIds.map((attId) => deleteTaskAttachment(savedTaskId, attId)),
          ...pendingNew.map((p) => createTaskAttachment(savedTaskId, { label: p.label, url: p.url })),
        ]);
        const failed = results.filter((r) => r.status === "rejected").length;
        if (failed > 0) {
          toast.error(`Task saved, but ${failed} attachment change${failed === 1 ? "" : "s"} failed.`);
        }
      }
      invalidateAll(savedTaskId, data.projectId);
      onOpenChange(false);
    })();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "New Task"}</DialogTitle>
        </DialogHeader>
        {readOnly && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            You have read-only access. You don't have permission to make changes.
          </div>
        )}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tactic</label>
              <Controller
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a tactic" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {projects?.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="font-mono text-muted-foreground mr-2">{p.id.split('-')[0]}</span>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {selectedProject && (
                <p className="text-xs text-muted-foreground mt-1">Strategic Pillar: {selectedProject.focusAreaName || 'Unknown'}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Assignee</label>
              <Controller
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {canAssignGroups && (groups ?? []).length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Groups (assigns each member a copy)</SelectLabel>
                          {(groups ?? []).map((g) => (
                            <SelectItem key={`group:${g.id}`} value={`group:${g.id}`}>
                              {g.name} ({g.memberCount} members)
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      <SelectGroup>
                        {canAssignGroups && (groups ?? []).length > 0 && (
                          <SelectLabel>Individuals</SelectLabel>
                        )}
                        {users?.map(u => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              {canAssignGroups && assigneeId?.startsWith("group:") && (
                <p className="text-xs text-muted-foreground">
                  A parent task is created for you to track rollup; each group member gets their own copy.
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea {...form.register("description")} rows={3} placeholder="Task description..." />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(TaskStatus)
                        .filter((s) => isManager || s !== TaskStatus.Complete)
                        .map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {!isManager && (
                <p className="text-xs text-muted-foreground">
                  Set "Pending Review" when you're done — a manager will confirm completion.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(TaskPriority).map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {isBlocked && (
              <div className="md:col-span-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-4">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertOctagon className="w-4 h-4" />
                  <span className="text-sm font-semibold uppercase tracking-wide">Blocker Details</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Blocked by (person)</label>
                    <Controller
                      control={form.control}
                      name="blockedById"
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <SelectTrigger>
                            <SelectValue placeholder="Who needs to unblock this?" />
                          </SelectTrigger>
                          <SelectContent>
                            {users
                              ?.filter((u) => u.id !== assigneeId)
                              .map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Roadblock summary</label>
                    <Input {...form.register("roadblock")} placeholder="What's the issue?" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Notes for the blocker</label>
                    <Textarea
                      {...form.register("blockNotes")}
                      rows={3}
                      placeholder="What specifically do you need from this person to unblock?"
                    />
                  </div>
                </div>
              </div>
            )}

            {isEscalated && (
              <div className="md:col-span-2 rounded-lg border border-amber-400/50 bg-amber-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-700">
                  <ShieldAlert className="w-4 h-4" />
                  <span className="text-sm font-semibold uppercase tracking-wide">
                    Roadblock escalated
                  </span>
                </div>
                <p className="text-sm text-amber-900">
                  Sent to <span className="font-semibold">{task?.escalatedToName || "your lead"}</span>
                  {task?.escalatedAt ? ` on ${format(new Date(task.escalatedAt), "MMM d, yyyy")}` : ""}.
                  They'll resolve it and return the task to you.
                </p>
                {task?.roadblock && (
                  <p className="text-sm text-amber-900/80 italic">"{task.roadblock}"</p>
                )}
              </div>
            )}

            {!isEscalated && wasResolved && (
              <div className="md:col-span-2 rounded-lg border border-emerald-300 bg-emerald-50 p-4 space-y-1">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-semibold uppercase tracking-wide">
                    Roadblock resolved
                  </span>
                </div>
                <p className="text-sm text-emerald-900">
                  Resolved by{" "}
                  <span className="font-semibold">{task?.escalationResolvedByName || "your lead"}</span>
                  {task?.escalationResolvedAt
                    ? ` on ${format(new Date(task.escalationResolvedAt), "MMM d, yyyy")}`
                    : ""}
                  .
                </p>
                {task?.escalationResolutionNote && (
                  <p className="text-sm text-emerald-900/80 italic">"{task.escalationResolutionNote}"</p>
                )}
              </div>
            )}

            {canEscalate && (
              <div className="md:col-span-2 rounded-lg border border-amber-300 bg-amber-50/40 p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-700">
                  <ArrowUpCircle className="w-4 h-4" />
                  <span className="text-sm font-semibold">Stuck on this? Escalate the roadblock</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  This sends the issue up to your initiative's lead. They'll unblock it and
                  return the task to you. You can't pick who it goes to — it routes automatically.
                </p>
                <Textarea
                  value={escalateNote}
                  onChange={(e) => setEscalateNote(e.target.value)}
                  rows={3}
                  placeholder="What's blocking you? Be specific about what you need to move forward."
                  data-testid="input-escalate-note"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-amber-400 text-amber-800 hover:bg-amber-100"
                    onClick={submitEscalation}
                    disabled={escalateMutation.isPending || readOnly}
                    data-testid="button-escalate-roadblock"
                  >
                    <ArrowUpCircle className="w-4 h-4 mr-1.5" />
                    {escalateMutation.isPending ? "Escalating…" : "Escalate roadblock"}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-4 md:col-span-2">
              <label className="text-sm font-medium flex justify-between">
                <span>Progress</span>
                <span className="font-mono">{form.watch("percentComplete")}%</span>
              </label>
              <Controller
                control={form.control}
                name="percentComplete"
                render={({ field }) => (
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[field.value]}
                    onValueChange={([val]) => field.onChange(val)}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input type="date" {...form.register("startDate")} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <Input type="date" {...form.register("dueDate")} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Dependencies</label>
              <Textarea {...form.register("dependency")} rows={2} placeholder="Any tasks blocking this one?" />
            </div>

            <div className="space-y-3 md:col-span-2 rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">
                  {isGroupAssignSelected ? "Shared Links for Every Member" : "Deliverables & Links"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {isGroupAssignSelected
                    ? "Template, brief, or shared folder — copied onto each member's task"
                    : "Drive, SharePoint, decks, signed contracts — anything that proves the work"}
                </span>
              </div>

              {(visibleExisting.length > 0 || pendingNew.length > 0) && (
                <ul className="space-y-1.5">
                  {visibleExisting.map((a) => (
                    <li key={`existing-${a.id}`} className="flex items-center gap-2 text-sm rounded-md bg-card border px-2.5 py-1.5">
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-primary hover:underline truncate"
                      >
                        {a.label}
                      </a>
                      <span className="text-xs text-muted-foreground truncate ml-auto max-w-[40%]">{a.url}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => setRemovedExistingIds((prev) => [...prev, a.id])}
                        data-testid={`button-remove-attachment-${a.id}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </li>
                  ))}
                  {pendingNew.map((p, idx) => (
                    <li key={`pending-${idx}`} className="flex items-center gap-2 text-sm rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1.5">
                      <Plus className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="font-medium truncate">{p.label}</span>
                      <span className="text-xs text-muted-foreground truncate ml-auto max-w-[40%]">{p.url}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => setPendingNew((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2">
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Label (e.g. Signed LOI)"
                  data-testid="input-attachment-label"
                />
                <Input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://… (Drive, SharePoint, etc.)"
                  data-testid="input-attachment-url"
                />
                <Button type="button" variant="outline" onClick={addPending} disabled={readOnly} data-testid="button-add-attachment">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isGroupAssignSelected
                  ? "These links are copied onto every group member's task when you create it."
                  : "Links are saved when you save the task. Completed tasks show their links on the PE Board drill-down."}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={readOnly || createMutation.isPending || updateMutation.isPending || bulkAssignMutation.isPending}>
              {task ? "Save Changes" : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
