import { useState } from "react";
import { Redirect } from "wouter";
import {
  useListProjects,
  useListGroups,
  useGetGroup,
  useBulkAssignTasks,
  useCreateGroup,
  useSetGroupMembers,
  useListUsers,
  useCreateTask,
  createTaskAttachment,
  useGetMe,
  getGetMeQueryKey,
  getListTasksQueryKey,
  getGetDashboardQueryKey,
  getGetGroupQueryKey,
  getListGroupsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Users2, Plus, X, Paperclip, ExternalLink } from "lucide-react";

export default function TaskAssignmentPage() {
  const { data: projects } = useListProjects();
  const { data: groups } = useListGroups();
  const { data: users } = useListUsers();
  const { user } = useAuth();
  const { data: me } = useGetMe({ query: { enabled: !!user, queryKey: getGetMeQueryKey() } });
  const canManageGroups = (me?.permissions ?? []).includes("manage_groups");
  const [mode, setMode] = useState<"group" | "individual">("group");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMembers, setNewGroupMembers] = useState<Set<string>>(new Set());
  const [links, setLinks] = useState<{ label: string; url: string }[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const { data: group } = useGetGroup(groupId ?? 0, {
    query: { enabled: groupId !== null, queryKey: getGetGroupQueryKey(groupId ?? 0) },
  });
  const mut = useBulkAssignTasks();
  const createTaskMut = useCreateTask();
  const createGroupMut = useCreateGroup();
  const setMembersMut = useSetGroupMembers();
  const qc = useQueryClient();

  const isAllowed = (me?.permissions ?? []).includes("assign_tasks");

  const resetForm = () => {
    setGroupId(null);
    setAssigneeId("");
    setProjectId("");
    setDescription("");
    setDueDate("");
    setPriority("Medium");
    setCreatingGroup(false);
    setNewGroupName("");
    setNewGroupMembers(new Set());
    setLinks([]);
    setNewLinkLabel("");
    setNewLinkUrl("");
  };

  const addLink = () => {
    const label = newLinkLabel.trim();
    let url = newLinkUrl.trim();
    if (!label || !url) {
      toast.error("Both label and URL are required");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    setLinks((prev) => [...prev, { label, url }]);
    setNewLinkLabel("");
    setNewLinkUrl("");
  };

  const toggleMember = (id: string) => {
    setNewGroupMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveNewGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error("Group name is required");
      return;
    }
    let created;
    try {
      created = await createGroupMut.mutateAsync({
        data: { name: newGroupName.trim(), description: "" },
      });
    } catch {
      toast.error("Failed to create group");
      return;
    }

    const memberIds = Array.from(newGroupMembers);
    let membersFailed = false;
    if (memberIds.length > 0) {
      try {
        await setMembersMut.mutateAsync({ id: created.id, data: { userIds: memberIds } });
      } catch {
        membersFailed = true;
      }
    }

    qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetGroupQueryKey(created.id) });
    setGroupId(created.id);
    setCreatingGroup(false);
    setNewGroupName("");
    setNewGroupMembers(new Set());
    if (membersFailed) {
      toast.warning(`Group "${created.name}" created, but adding members failed — edit it from the Groups page.`);
    } else {
      toast.success(`Group "${created.name}" created`);
    }
  };

  const submitGroup = async () => {
    if (!groupId || !projectId || !description.trim()) {
      toast.error("Group, tactic, and description required");
      return;
    }
    try {
      const res = await mut.mutateAsync({
        data: {
          groupId,
          projectId,
          description: description.trim(),
          priority,
          status: "Not Started",
          percentComplete: 0,
          dueDate: dueDate || null,
          attachments: links,
        },
      });
      qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      toast.success(`Created parent + ${res.childTaskIds.length} child tasks`);
      resetForm();
    } catch {
      toast.error("Failed to assign tasks");
    }
  };

  const submitIndividual = async () => {
    if (!assigneeId || !projectId || !description.trim()) {
      toast.error("Team member, tactic, and description required");
      return;
    }
    let created;
    try {
      created = await createTaskMut.mutateAsync({
        data: {
          projectId,
          assigneeId,
          role: "Owner",
          description: description.trim(),
          priority,
          status: "Not Started",
          percentComplete: 0,
          dueDate: dueDate || null,
        },
      });
    } catch {
      toast.error("Failed to assign task");
      return;
    }

    let linksFailed = 0;
    if (links.length > 0) {
      const results = await Promise.allSettled(
        links.map((l) => createTaskAttachment(created.id, { label: l.label, url: l.url })),
      );
      linksFailed = results.filter((r) => r.status === "rejected").length;
    }

    qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    const assigneeName = (users ?? []).find((u) => u.id === assigneeId)?.name ?? "team member";
    if (linksFailed > 0) {
      toast.warning(`Task assigned to ${assigneeName}, but ${linksFailed} link${linksFailed === 1 ? "" : "s"} failed to attach.`);
    } else {
      toast.success(`Task assigned to ${assigneeName}`);
    }
    resetForm();
  };

  const submit = () => (mode === "group" ? submitGroup() : submitIndividual());

  if (me && !isAllowed) {
    return <Redirect to="/" />;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
          <Users2 className="w-7 h-7 text-primary" /> Task Assignment
        </h1>
        <p className="text-muted-foreground mt-1">
          {mode === "group"
            ? "Assign a task to an entire group. Each member gets their own copy, and a parent task tracks the rollup."
            : "Assign a task to a single team member."}
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium">Assign to</label>
          <div className="inline-flex rounded-lg border bg-muted/40 p-1">
            <Button
              type="button"
              variant={mode === "group" ? "default" : "ghost"}
              size="sm"
              className="rounded-md"
              onClick={() => {
                setMode("group");
                setAssigneeId("");
              }}
              data-testid="button-mode-group"
            >
              Group
            </Button>
            <Button
              type="button"
              variant={mode === "individual" ? "default" : "ghost"}
              size="sm"
              className="rounded-md"
              onClick={() => {
                setMode("individual");
                setGroupId(null);
                setCreatingGroup(false);
              }}
              data-testid="button-mode-individual"
            >
              Individual
            </Button>
          </div>
        </div>

        {mode === "individual" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">Team member</label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger data-testid="select-assign-individual">
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {(users ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <span className="flex items-center gap-2">
                      <Avatar className="w-5 h-5">
                        <AvatarFallback style={{ backgroundColor: u.avatarColor, color: "white", fontSize: 9 }}>
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{u.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{u.role}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Group</label>
            {canManageGroups && !creatingGroup && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreatingGroup(true)}
                data-testid="button-assign-new-group"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> New Group
              </Button>
            )}
          </div>

          {creatingGroup ? (
            <div className="border rounded-md p-3 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Create a new group</span>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCreatingGroup(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group name, e.g. East Region Devs"
                data-testid="input-assign-group-name"
              />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Select members ({newGroupMembers.size})</p>
                <div className="border rounded-md max-h-48 overflow-y-auto divide-y bg-background">
                  {(users ?? []).map((u) => (
                    <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-muted/40 cursor-pointer">
                      <Checkbox
                        checked={newGroupMembers.has(u.id)}
                        onCheckedChange={() => toggleMember(u.id)}
                      />
                      <Avatar className="w-6 h-6">
                        <AvatarFallback style={{ backgroundColor: u.avatarColor, color: "white", fontSize: 10 }}>
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm flex-1">{u.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{u.role}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setCreatingGroup(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={saveNewGroup}
                  disabled={createGroupMut.isPending || setMembersMut.isPending}
                  data-testid="button-assign-save-group"
                >
                  Create & Select
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Select value={groupId ? String(groupId) : ""} onValueChange={(v) => setGroupId(Number(v))}>
                <SelectTrigger data-testid="select-assign-group">
                  <SelectValue placeholder={(groups ?? []).length === 0 ? "No groups yet — create one" : "Select a group"} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {(groups ?? []).map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.name} ({g.memberCount} members)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {group && group.members.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {group.members.map((m) => (
                    <div key={m.userId} className="flex items-center gap-1.5 text-xs bg-muted rounded-full pl-0.5 pr-2 py-0.5">
                      <Avatar className="w-5 h-5">
                        <AvatarFallback style={{ backgroundColor: m.avatarColor, color: "white", fontSize: 9 }}>
                          {getInitials(m.name)}
                        </AvatarFallback>
                      </Avatar>
                      {m.name}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Tactic</label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger data-testid="select-assign-tactic">
              <SelectValue placeholder="Select a tactic" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {(projects ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="font-mono text-muted-foreground mr-2">{p.id.split("-")[0]}</span>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Task description</label>
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={mode === "group" ? "What every group member needs to do..." : "What this team member needs to do..."}
            data-testid="textarea-assign-description"
          />
        </div>

        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">
              {mode === "group" ? "Shared Links for Every Member" : "Deliverable Links"}
            </span>
            <span className="text-xs text-muted-foreground">
              {mode === "group"
                ? "Template, brief, or shared folder — copied onto each member's task"
                : "Template, brief, or shared folder — attached to this task"}
            </span>
          </div>

          {links.length > 0 && (
            <ul className="space-y-1.5">
              {links.map((l, idx) => (
                <li
                  key={`link-${idx}`}
                  className="flex items-center gap-2 text-sm rounded-md bg-card border px-2.5 py-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{l.label}</span>
                  <span className="text-xs text-muted-foreground truncate ml-auto max-w-[40%]">{l.url}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => setLinks((prev) => prev.filter((_, i) => i !== idx))}
                    data-testid={`button-remove-assign-link-${idx}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2">
            <Input
              value={newLinkLabel}
              onChange={(e) => setNewLinkLabel(e.target.value)}
              placeholder="Label (e.g. Brief)"
              data-testid="input-assign-link-label"
            />
            <Input
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
              placeholder="https://… (Drive, SharePoint, etc.)"
              data-testid="input-assign-link-url"
            />
            <Button type="button" variant="outline" onClick={addLink} data-testid="button-add-assign-link">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Priority</label>
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Low", "Medium", "High", "Critical"].map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Due date</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        {mode === "group" && (
          <p className="text-xs text-muted-foreground bg-muted/40 rounded p-3">
            A parent task assigned to you will track group rollup. Each member gets their own child task; closing all of them auto-completes the parent.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={resetForm}>Reset</Button>
          <Button
            onClick={submit}
            disabled={mut.isPending || createTaskMut.isPending}
            data-testid="button-assign-submit"
          >
            {mut.isPending || createTaskMut.isPending
              ? "Assigning..."
              : mode === "group"
                ? "Assign to Group"
                : "Assign to Member"}
          </Button>
        </div>
      </div>
    </div>
  );
}
