import { useState } from "react";
import {
  useListGroups,
  useGetGroup,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useSetGroupMembers,
  useListUsers,
  useGetMe,
  getListGroupsQueryKey,
  getGetGroupQueryKey,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Plus, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getInitials } from "@/lib/utils";

export default function GroupsPage() {
  const { user } = useAuth();
  const { data: me } = useGetMe({ query: { enabled: !!user, queryKey: getGetMeQueryKey() } });
  const { data: groups, isLoading } = useListGroups();
  const { data: users } = useListUsers();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const canManage = (me?.permissions ?? []).includes("manage_groups");

  if (!canManage) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <Card className="border-destructive/30">
          <CardContent className="p-8 text-center space-y-2">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <h2 className="text-xl font-serif font-bold">Restricted</h2>
            <p className="text-muted-foreground text-sm">
              Groups can be managed by Admins and VP only.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading groups...</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-3">
          <Users className="w-8 h-8 text-primary" />
          Groups
        </h1>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-new-group">
          <Plus className="w-4 h-4 mr-2" /> New Group
        </Button>
      </div>

      {(groups ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No groups yet. Create one to bulk-assign tasks across the team.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups!.map((g) => (
            <Card key={g.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedId(g.id)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-serif font-bold text-base">{g.name}</h3>
                    {g.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{g.description}</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">{g.memberCount} members</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: getListGroupsQueryKey() })}
      />
      {selectedId !== null && (
        <GroupDetailDialog
          groupId={selectedId}
          open={selectedId !== null}
          onOpenChange={(o) => !o && setSelectedId(null)}
          allUsers={users ?? []}
        />
      )}
    </div>
  );
}

function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const mut = useCreateGroup();
  const submit = async () => {
    if (!name.trim()) return;
    try {
      await mut.mutateAsync({ data: { name: name.trim(), description } });
      toast.success("Group created");
      setName("");
      setDescription("");
      onCreated();
      onOpenChange(false);
    } catch {
      toast.error("Failed to create group");
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. East Region Devs" data-testid="input-group-name" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={mut.isPending} data-testid="button-create-group">Create</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GroupDetailDialog({
  groupId,
  open,
  onOpenChange,
  allUsers,
}: {
  groupId: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  allUsers: { id: string; name: string; avatarColor: string; role: string }[];
}) {
  const { data: group } = useGetGroup(groupId);
  const qc = useQueryClient();
  const updateMut = useUpdateGroup();
  const deleteMut = useDeleteGroup();
  const setMembersMut = useSetGroupMembers();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState<number | null>(null);

  if (group && hydrated !== group.id) {
    setName(group.name);
    setDescription(group.description ?? "");
    setSelected(new Set(group.members.map((m) => m.userId)));
    setHydrated(group.id);
  }

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const save = async () => {
    try {
      await updateMut.mutateAsync({ id: groupId, data: { name, description } });
      await setMembersMut.mutateAsync({ id: groupId, data: { userIds: Array.from(selected) } });
      qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetGroupQueryKey(groupId) });
      toast.success("Group saved");
      onOpenChange(false);
    } catch {
      toast.error("Failed to save group");
    }
  };

  const remove = async () => {
    if (!confirm(`Delete group "${group?.name}"? Tasks assigned to its members remain intact.`)) return;
    try {
      await deleteMut.mutateAsync({ id: groupId });
      qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
      toast.success("Group deleted");
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete group");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Group</DialogTitle>
        </DialogHeader>
        {!group ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Description</label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Members ({selected.size})</label>
              <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
                {allUsers.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 p-2 hover:bg-muted/40 cursor-pointer"
                  >
                    <Checkbox checked={selected.has(u.id)} onCheckedChange={() => toggle(u.id)} />
                    <Avatar className="w-7 h-7">
                      <AvatarFallback
                        style={{ backgroundColor: u.avatarColor, color: "white", fontSize: 11 }}
                      >
                        {getInitials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm flex-1">{u.name}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{u.role}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-between gap-2 pt-2 border-t">
              <Button variant="ghost" className="text-destructive" onClick={remove}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={save} disabled={updateMut.isPending || setMembersMut.isPending}>
                  Save Group
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
