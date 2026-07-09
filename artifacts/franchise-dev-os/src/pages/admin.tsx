import {
  useListUsers,
  useGetMe,
  useCreateUser,
  useUpdateUser,
  useDeactivateUser,
  useActivateUser,
  useGetPermissionMatrix,
  useUpdateRolePermissions,
  useListAuditLog,
  useListAccessRequests,
  useApproveAccessRequest,
  useDenyAccessRequest,
  useListInvitations,
  useCreateInvitation,
  useRevokeInvitation,
  useRegenerateInvitation,
  useResetUserPassword,
  useMergeUser,
  useStartImpersonation,
  getGetMeQueryKey,
  getListUsersQueryKey,
  getGetPermissionMatrixQueryKey,
  getListAuditLogQueryKey,
  getListAccessRequestsQueryKey,
  getListInvitationsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { useAuth } from "@workspace/replit-auth-web";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  UserPlus,
  UserX,
  UserCheck,
  Link2,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  ScrollText,
  Inbox,
  KeyRound,
  Pencil,
  History,
  Users as UsersIcon,
  UserCog,
  GitMerge,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useMemo, useState } from "react";

type Role = "member" | "lead" | "admin" | "vp" | "super_admin" | "observer";
const ROLES: Role[] = ["member", "lead", "admin", "vp", "observer"];
const ROLE_LABEL: Record<Role, string> = {
  member: "Member",
  lead: "Lead",
  admin: "Admin",
  vp: "VP",
  super_admin: "Super Admin",
  observer: "Observer (Read-only)",
};

export default function AdminPage() {
  const { user } = useAuth();
  const { data: me } = useGetMe({
    query: { enabled: !!user, queryKey: getGetMeQueryKey() },
  });
  const perms = me?.permissions ?? [];
  const canUsers = perms.includes("manage_users");
  const canPerms = perms.includes("manage_permissions");
  const canAudit = perms.includes("view_audit_log");
  const canRequests = perms.includes("manage_access_requests");
  const canInvites = perms.includes("manage_invitations");
  const canImpersonate = perms.includes("impersonate_users");
  const isSuper = me?.role === "super_admin";

  const anyAccess = canUsers || canPerms || canAudit || canRequests || canInvites;

  const defaultTab = canUsers
    ? "users"
    : canPerms
      ? "permissions"
      : canRequests
        ? "requests"
        : canAudit
          ? "audit"
          : "users";

  if (me && !anyAccess) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-3">
        <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto" />
        <h1 className="text-2xl font-serif font-bold">No access</h1>
        <p className="text-muted-foreground">
          You don't have permission to view the admin console.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            Users &amp; Access
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage members, role permissions, requests, and the audit trail.
          </p>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          {(canUsers || canInvites) && (
            <TabsTrigger value="users" data-testid="tab-users">
              <UsersIcon className="w-4 h-4 mr-1.5" /> Users
            </TabsTrigger>
          )}
          {canPerms && (
            <TabsTrigger value="permissions" data-testid="tab-permissions">
              <KeyRound className="w-4 h-4 mr-1.5" /> Permissions
            </TabsTrigger>
          )}
          {canRequests && (
            <TabsTrigger value="requests" data-testid="tab-requests">
              <Inbox className="w-4 h-4 mr-1.5" /> Requests
            </TabsTrigger>
          )}
          {canAudit && (
            <TabsTrigger value="audit" data-testid="tab-audit">
              <ScrollText className="w-4 h-4 mr-1.5" /> Audit Log
            </TabsTrigger>
          )}
        </TabsList>

        {(canUsers || canInvites) && (
          <TabsContent value="users">
            <UsersTab
              canUsers={canUsers}
              canInvites={canInvites}
              canAudit={canAudit}
              canImpersonate={canImpersonate}
              isSuper={isSuper}
              meId={me?.id}
            />
          </TabsContent>
        )}
        {canPerms && (
          <TabsContent value="permissions">
            <PermissionsTab />
          </TabsContent>
        )}
        {canRequests && (
          <TabsContent value="requests">
            <RequestsTab />
          </TabsContent>
        )}
        {canAudit && (
          <TabsContent value="audit">
            <AuditTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// --- Users + Invitations ---------------------------------------------------

function UsersTab({
  canUsers,
  canInvites,
  canAudit,
  canImpersonate,
  isSuper,
  meId,
}: {
  canUsers: boolean;
  canInvites: boolean;
  canAudit: boolean;
  canImpersonate: boolean;
  isSuper: boolean;
  meId?: string;
}) {
  const queryClient = useQueryClient();
  const { data: users } = useListUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();
  const activateUser = useActivateUser();
  const createInvite = useCreateInvitation();
  const resetPassword = useResetUserPassword();
  const startImpersonation = useStartImpersonation();
  const { data: invitations } = useListInvitations({
    query: { enabled: canInvites, queryKey: getListInvitationsQueryKey() },
  });

  // Super admins may also assign the super_admin role; everyone else is capped
  // at the four base roles.
  const assignableRoles: Role[] = isSuper ? [...ROLES, "super_admin"] : ROLES;

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("member");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [activityUser, setActivityUser] = useState<{ id: string; name: string } | null>(null);
  const [resetUser, setResetUser] = useState<{ id: string; name: string } | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const mergeUser = useMergeUser();
  const [mergeSource, setMergeSource] = useState<{ id: string; name: string } | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");

  const appBase = () => import.meta.env.BASE_URL?.replace(/\/+$/, "") || "/";

  const handleResetPassword = async () => {
    if (!resetUser) return;
    if (resetPwd.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    try {
      await resetPassword.mutateAsync({ id: resetUser.id, data: { newPassword: resetPwd } });
      invalidateUsers();
      setResetUser(null);
      setResetPwd("");
      toast.success("Password reset");
    } catch {
      toast.error("Failed to reset password");
    }
  };

  const handleActAs = async (u: { id: string; name: string }) => {
    setImpersonatingId(u.id);
    try {
      await startImpersonation.mutateAsync({ data: { userId: u.id } });
      window.location.href = appBase();
    } catch {
      toast.error("Could not start acting as this user");
      setImpersonatingId(null);
    }
  };

  const invalidateUsers = () =>
    queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const handleMerge = async () => {
    if (!mergeSource || !mergeTargetId) return;
    try {
      await mergeUser.mutateAsync({
        id: mergeTargetId,
        data: { sourceUserId: mergeSource.id },
      });
      invalidateUsers();
      setMergeSource(null);
      setMergeTargetId("");
      toast.success("Members merged");
    } catch {
      toast.error("Failed to merge members");
    }
  };

  const openEdit = (u: { id: string; name: string; email: string | null }) => {
    setEditId(u.id);
    setEditName(u.name ?? "");
    setEditEmail(u.email ?? "");
  };

  const handleSaveDetails = async () => {
    if (!editId) return;
    if (!editName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    try {
      await updateUser.mutateAsync({
        id: editId,
        data: { name: editName.trim(), email: editEmail.trim() || null },
      });
      invalidateUsers();
      setEditId(null);
      toast.success("Details updated");
    } catch {
      toast.error("Failed to update details");
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Enter a name");
      return;
    }
    try {
      await createUser.mutateAsync({
        data: {
          name: newName.trim(),
          email: newEmail.trim() || null,
          role: newRole,
        },
      });
      invalidateUsers();
      setNewName("");
      setNewEmail("");
      setNewRole("member");
      toast.success("Member created");
    } catch {
      toast.error("Failed to create member");
    }
  };

  const handleInvite = async (u: { id: string; role: string }) => {
    setInvitingId(u.id);
    try {
      const existing = (invitations ?? []).find(
        (inv) => inv.targetUserId === u.id && inv.status === "pending",
      );
      let url: string;
      if (existing) {
        url = existing.inviteUrl;
      } else {
        const created = await createInvite.mutateAsync({
          data: { role: u.role as Role, targetUserId: u.id },
        });
        queryClient.invalidateQueries({ queryKey: getListInvitationsQueryKey() });
        url = created.inviteUrl;
      }
      const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
      await navigator.clipboard.writeText(`${window.location.origin}${base}${url}`);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not create invite link");
    } finally {
      setInvitingId(null);
    }
  };

  const handleRole = async (id: string, role: Role) => {
    try {
      await updateUser.mutateAsync({ id, data: { role } });
      invalidateUsers();
      toast.success("Role updated");
    } catch {
      toast.error("Failed to update role");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      if (isActive) {
        await deactivateUser.mutateAsync({ id });
        toast.success("Member deactivated");
      } else {
        await activateUser.mutateAsync({ id });
        toast.success("Member reactivated");
      }
      invalidateUsers();
    } catch {
      toast.error("Action failed");
    }
  };

  const sorted = (users ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      {canUsers && (
        <Card className="border-primary/20">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              <h2 className="font-serif font-bold text-lg">Add member</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1.5 md:col-span-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Jane Smith"
                  data-testid="input-new-user-name"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Email (optional)</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="jane@example.com"
                  data-testid="input-new-user-email"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
                  <SelectTrigger data-testid="select-new-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleCreate}
              disabled={createUser.isPending}
              data-testid="button-create-user"
            >
              <UserPlus className="w-4 h-4 mr-2" /> Create member
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5 space-y-3">
          <h2 className="font-serif font-bold text-lg">Members</h2>
          <div className="space-y-2">
            {sorted.map((u) => (
              <div
                key={u.id}
                className={`flex items-center gap-3 p-3 rounded-md border border-border bg-card ${
                  u.isActive === false ? "opacity-60" : ""
                }`}
                data-testid={`row-user-${u.id}`}
              >
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarFallback
                    style={{ backgroundColor: u.avatarColor || "#333", color: "white", fontSize: 13 }}
                  >
                    {getInitials(u.name || "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    {!u.hasLogin && (
                      <Badge variant="outline" className="text-[8px] uppercase tracking-wider">
                        No login
                      </Badge>
                    )}
                    {u.isActive === false && (
                      <Badge variant="destructive" className="text-[8px] uppercase tracking-wider">
                        Deactivated
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{u.email || "—"}</p>
                </div>
                {canUsers && u.id !== meId && (u.role !== "super_admin" || isSuper) ? (
                  <Select
                    defaultValue={u.role}
                    onValueChange={(v) => handleRole(u.id, v as Role)}
                  >
                    <SelectTrigger
                      className="h-7 w-28 text-[10px] uppercase tracking-wider"
                      data-testid={`select-role-${u.id}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary" className="uppercase text-[9px] tracking-wider">
                    {ROLE_LABEL[u.role as Role] ?? u.role}
                  </Badge>
                )}
                {canImpersonate && u.id !== meId && u.hasLogin && u.isActive !== false && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-amber-600 hover:text-amber-600"
                    onClick={() => handleActAs({ id: u.id, name: u.name })}
                    disabled={impersonatingId === u.id}
                    data-testid={`button-act-as-${u.id}`}
                  >
                    {impersonatingId === u.id ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    ) : (
                      <UserCog className="w-3.5 h-3.5 mr-1" />
                    )}
                    Act as
                  </Button>
                )}
                {canInvites && !u.hasLogin && u.isActive !== false && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-primary hover:text-primary"
                    onClick={() => handleInvite(u)}
                    disabled={invitingId === u.id}
                    data-testid={`button-invite-user-${u.id}`}
                  >
                    <Link2 className="w-3.5 h-3.5 mr-1" /> Invite
                  </Button>
                )}
                {canUsers && u.hasLogin && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setResetUser({ id: u.id, name: u.name });
                      setResetPwd("");
                    }}
                    data-testid={`button-reset-password-${u.id}`}
                  >
                    <KeyRound className="w-3.5 h-3.5 mr-1" /> Reset
                  </Button>
                )}
                {canUsers && u.id !== meId && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setMergeSource({ id: u.id, name: u.name });
                      setMergeTargetId("");
                    }}
                    data-testid={`button-merge-user-${u.id}`}
                  >
                    <GitMerge className="w-3.5 h-3.5 mr-1" /> Merge
                  </Button>
                )}
                {canUsers && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => openEdit(u)}
                    data-testid={`button-edit-user-${u.id}`}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                )}
                {canAudit && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setActivityUser({ id: u.id, name: u.name })}
                    data-testid={`button-activity-user-${u.id}`}
                  >
                    <History className="w-3.5 h-3.5 mr-1" /> Activity
                  </Button>
                )}
                {canUsers && u.id !== meId && (
                  <Button
                    type="button"
                    size="sm"
                    variant={u.isActive === false ? "outline" : "ghost"}
                    className={u.isActive === false ? "" : "text-destructive hover:text-destructive"}
                    onClick={() => handleToggleActive(u.id, u.isActive !== false)}
                    data-testid={`button-toggle-active-${u.id}`}
                  >
                    {u.isActive === false ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5 mr-1" /> Activate
                      </>
                    ) : (
                      <>
                        <UserX className="w-3.5 h-3.5 mr-1" /> Deactivate
                      </>
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {canInvites && <InvitationsPanel users={users ?? []} />}

      <Dialog open={editId !== null} onOpenChange={(open) => !open && setEditId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Jane Smith"
                data-testid="input-edit-user-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="jane@example.com"
                data-testid="input-edit-user-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              onClick={handleSaveDetails}
              disabled={updateUser.isPending}
              data-testid="button-save-edit"
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activityUser && (
        <UserActivityDialog
          userId={activityUser.id}
          userName={activityUser.name}
          open={activityUser !== null}
          onClose={() => setActivityUser(null)}
        />
      )}

      <Dialog
        open={mergeSource !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMergeSource(null);
            setMergeTargetId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge member — {mergeSource?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Move all of <strong>{mergeSource?.name}</strong>'s tasks, history,
              and references onto the account you choose below, then retire this
              duplicate. This cannot be undone.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Keep this account (survivor)</Label>
              <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                <SelectTrigger data-testid="select-merge-target">
                  <SelectValue placeholder="Choose the surviving member" />
                </SelectTrigger>
                <SelectContent>
                  {sorted
                    .filter((u) => u.id !== mergeSource?.id)
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                        {u.email ? ` — ${u.email}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMergeSource(null);
                setMergeTargetId("");
              }}
              data-testid="button-cancel-merge"
            >
              Cancel
            </Button>
            <Button
              onClick={handleMerge}
              disabled={!mergeTargetId || mergeUser.isPending}
              data-testid="button-confirm-merge"
            >
              {mergeUser.isPending && (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              )}
              Merge members
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetUser !== null} onOpenChange={(open) => !open && setResetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password — {resetUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Set a new password for this member. Share it with them securely; they
              can change it after signing in.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">New password</Label>
              <Input
                type="password"
                value={resetPwd}
                onChange={(e) => setResetPwd(e.target.value)}
                placeholder="At least 8 characters"
                data-testid="input-reset-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)} data-testid="button-cancel-reset">
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={resetPassword.isPending}
              data-testid="button-confirm-reset"
            >
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserActivityDialog({
  userId,
  userName,
  open,
  onClose,
}: {
  userId: string;
  userName: string;
  open: boolean;
  onClose: () => void;
}) {
  const params = { actorId: userId, limit: 100 };
  const { data: entries, isLoading } = useListAuditLog(params, {
    query: { enabled: open, queryKey: getListAuditLogQueryKey(params) },
  });
  const rows = entries ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4" /> Activity — {userName}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-1.5 py-1">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading activity...</div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No recorded activity yet.
            </p>
          ) : (
            rows.map((e) => (
              <div
                key={e.id}
                className="flex items-start gap-3 p-2.5 rounded-md border border-border/60 bg-card text-sm"
                data-testid={`row-activity-${e.id}`}
              >
                <Badge
                  variant="outline"
                  className="text-[9px] uppercase tracking-wider shrink-0 mt-0.5"
                >
                  {e.action}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-muted-foreground">
                    {e.targetLabel || (e.targetType ? `${e.targetType}` : "—")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InvitationsPanel({
  users,
}: {
  users: { id: string; name: string; hasLogin?: boolean }[];
}) {
  const queryClient = useQueryClient();
  const { data: invitations } = useListInvitations({
    query: { queryKey: getListInvitationsQueryKey() },
  });
  const createInvite = useCreateInvitation();
  const revokeInvite = useRevokeInvitation();
  const regenInvite = useRegenerateInvitation();

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [role, setRole] = useState<Role>("member");
  const [targetId, setTargetId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListInvitationsQueryKey() });

  const noLogin = users.filter((u) => !u.hasLogin);

  const copy = async (url: string, id: number) => {
    try {
      const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
      await navigator.clipboard.writeText(`${window.location.origin}${base}${url}`);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleCreate = async () => {
    try {
      if (mode === "existing" && !targetId) {
        toast.error("Pick a member");
        return;
      }
      if (mode === "new" && !name.trim()) {
        toast.error("Enter a name");
        return;
      }
      const payload =
        mode === "existing"
          ? { role, targetUserId: targetId }
          : { role, newMemberName: name.trim(), newMemberEmail: email.trim() || undefined };
      await createInvite.mutateAsync({ data: payload });
      invalidate();
      setTargetId("");
      setName("");
      setEmail("");
      toast.success("Invite link created");
    } catch {
      toast.error("Failed to create invite");
    }
  };

  return (
    <Card className="border-primary/20">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" />
          <h2 className="font-serif font-bold text-lg">Login invitations</h2>
        </div>

        <div className="rounded-lg border border-border p-4 space-y-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "existing" ? "default" : "outline"}
              onClick={() => setMode("existing")}
              data-testid="button-invite-mode-existing"
            >
              Invite existing member
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "new" ? "default" : "outline"}
              onClick={() => setMode("new")}
              data-testid="button-invite-mode-new"
            >
              Create new member
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {mode === "existing" ? (
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Member (no login yet)</Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger data-testid="select-invite-target">
                    <SelectValue placeholder="Select a member" />
                  </SelectTrigger>
                  <SelectContent>
                    {noLogin.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {noLogin.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Everyone already has a login.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">New member name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Smith"
                    data-testid="input-invite-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email (optional)</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@example.com"
                    data-testid="input-invite-email"
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger data-testid="select-invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleCreate}
            disabled={createInvite.isPending}
            data-testid="button-create-invite"
          >
            <Link2 className="w-4 h-4 mr-2" /> Create invite link
          </Button>
        </div>

        {(invitations ?? []).length > 0 && (
          <div className="space-y-2">
            {(invitations ?? []).map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 p-3 rounded-md border border-border bg-card"
                data-testid={`row-invite-${inv.id}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {inv.targetName || inv.newMemberEmail || "New member"}
                  </p>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    {inv.role}
                  </p>
                </div>
                <Badge
                  variant={
                    inv.status === "pending"
                      ? "secondary"
                      : inv.status === "accepted"
                        ? "default"
                        : "outline"
                  }
                  className="uppercase text-[9px] tracking-wider"
                >
                  {inv.status}
                </Badge>
                {inv.status === "pending" && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => copy(inv.inviteUrl, inv.id)}
                      data-testid={`button-copy-invite-${inv.id}`}
                    >
                      {copiedId === inv.id ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const updated = await regenInvite.mutateAsync({ id: inv.id });
                          invalidate();
                          await copy(updated.inviteUrl, inv.id);
                        } catch {
                          toast.error("Failed to regenerate");
                        }
                      }}
                      disabled={regenInvite.isPending}
                      title="Regenerate link"
                      data-testid={`button-regenerate-invite-${inv.id}`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={async () => {
                        try {
                          await revokeInvite.mutateAsync({ id: inv.id });
                          invalidate();
                          toast.success("Invite revoked");
                        } catch {
                          toast.error("Failed to revoke");
                        }
                      }}
                      data-testid={`button-revoke-invite-${inv.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Permissions matrix ----------------------------------------------------

function PermissionsTab() {
  const queryClient = useQueryClient();
  const { data: matrix, isLoading } = useGetPermissionMatrix({
    query: { queryKey: getGetPermissionMatrixQueryKey() },
  });
  const updateRole = useUpdateRolePermissions();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const isSuper = me?.role === "super_admin";

  // All tiers are shown so the matrix reflects the full role hierarchy; only a
  // super admin may edit the super_admin mapping (server-enforced too).
  const displayRoles: Role[] = [...ROLES, "super_admin"];
  const canEditRole = (r: Role) => r !== "super_admin" || isSuper;

  // Local working copy of role -> permission set.
  const [draft, setDraft] = useState<Record<string, Set<string>> | null>(null);

  const serverMap = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const r of matrix?.roles ?? []) m[r.role] = new Set(r.permissions);
    return m;
  }, [matrix]);

  const working = draft ?? serverMap;

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading permissions...</div>;
  }

  const catalog = (matrix?.catalog ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const categories = Array.from(new Set(catalog.map((c) => c.category)));

  const toggle = (role: Role, key: string) => {
    setDraft((prev) => {
      const base = prev ?? {
        ...Object.fromEntries(
          Object.entries(serverMap).map(([r, s]) => [r, new Set(s)]),
        ),
      };
      const next: Record<string, Set<string>> = {};
      for (const [r, s] of Object.entries(base)) next[r] = new Set(s);
      if (!next[role]) next[role] = new Set();
      if (next[role].has(key)) next[role].delete(key);
      else next[role].add(key);
      return next;
    });
  };

  const dirty = (role: Role) => {
    const a = working[role] ?? new Set<string>();
    const b = serverMap[role] ?? new Set<string>();
    if (a.size !== b.size) return true;
    for (const k of a) if (!b.has(k)) return true;
    return false;
  };

  const save = async (role: Role) => {
    try {
      await updateRole.mutateAsync({
        role,
        data: { permissions: Array.from(working[role] ?? new Set<string>()) as never },
      });
      await queryClient.invalidateQueries({ queryKey: getGetPermissionMatrixQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setDraft(null);
      toast.success(`${ROLE_LABEL[role]} permissions saved`);
    } catch {
      toast.error("Failed to save permissions");
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4 overflow-x-auto">
        <p className="text-sm text-muted-foreground">
          Toggle which permissions each role is granted. Changes take effect on save.
        </p>
        <table className="w-full text-sm border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-semibold py-2 pr-4">Permission</th>
              {displayRoles.map((r) => (
                <th key={r} className="text-center font-semibold py-2 px-2 w-20">
                  {ROLE_LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <CategoryRows
                key={cat}
                category={cat}
                items={catalog.filter((c) => c.category === cat)}
                working={working}
                onToggle={toggle}
                roles={displayRoles}
                canEditRole={canEditRole}
              />
            ))}
          </tbody>
        </table>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          {displayRoles.filter(canEditRole).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={dirty(r) ? "default" : "outline"}
              disabled={!dirty(r) || updateRole.isPending}
              onClick={() => save(r)}
              data-testid={`button-save-role-${r}`}
            >
              Save {ROLE_LABEL[r]}
            </Button>
          ))}
          {draft && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDraft(null)}
              data-testid="button-reset-permissions"
            >
              Reset
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryRows({
  category,
  items,
  working,
  onToggle,
  roles,
  canEditRole,
}: {
  category: string;
  items: { key: string; label: string; description: string }[];
  working: Record<string, Set<string>>;
  onToggle: (role: Role, key: string) => void;
  roles: Role[];
  canEditRole: (role: Role) => boolean;
}) {
  return (
    <>
      <tr className="bg-muted/40">
        <td colSpan={1 + roles.length} className="py-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {category}
        </td>
      </tr>
      {items.map((perm) => (
        <tr key={perm.key} className="border-b border-border/60">
          <td className="py-2 pr-4">
            <p className="font-medium">{perm.label}</p>
            <p className="text-[11px] text-muted-foreground">{perm.description}</p>
          </td>
          {roles.map((r) => {
            const editable = canEditRole(r);
            return (
              <td key={r} className="text-center py-2 px-2">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  checked={(working[r] ?? new Set()).has(perm.key)}
                  onChange={() => onToggle(r, perm.key)}
                  disabled={!editable}
                  data-testid={`checkbox-${r}-${perm.key}`}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

// --- Access requests -------------------------------------------------------

function RequestsTab() {
  const queryClient = useQueryClient();
  const { data: requests, isLoading } = useListAccessRequests(undefined, {
    query: { queryKey: getListAccessRequestsQueryKey() },
  });
  const approve = useApproveAccessRequest();
  const deny = useDenyAccessRequest();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListAccessRequestsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListInvitationsQueryKey() });
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading requests...</div>;
  }

  const rows = requests ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  const Row = ({ r }: { r: (typeof rows)[number] }) => (
    <div
      className="flex items-center gap-3 p-3 rounded-md border border-border bg-card"
      data-testid={`row-request-${r.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{r.requesterName || "Unknown"}</p>
          <Badge variant="outline" className="text-[8px] uppercase tracking-wider">
            {r.kind === "account" ? "New account" : "Access"}
          </Badge>
          <Badge variant="secondary" className="text-[8px] uppercase tracking-wider">
            {ROLE_LABEL[r.requestedRole as Role] ?? r.requestedRole}
          </Badge>
        </div>
        {r.requesterEmail && (
          <p className="text-[11px] text-muted-foreground truncate">{r.requesterEmail}</p>
        )}
        {r.reason && <p className="text-xs text-muted-foreground mt-1">{r.reason}</p>}
        {r.status !== "pending" && (
          <p className="text-[11px] text-muted-foreground mt-1">
            {r.status} {r.decidedByName ? `by ${r.decidedByName}` : ""}
          </p>
        )}
      </div>
      {r.status === "pending" ? (
        <>
          <Button
            type="button"
            size="sm"
            onClick={async () => {
              try {
                await approve.mutateAsync({ id: r.id });
                invalidate();
                toast.success("Request approved");
              } catch {
                toast.error("Failed to approve");
              }
            }}
            data-testid={`button-approve-${r.id}`}
          >
            <Check className="w-3.5 h-3.5 mr-1" /> Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={async () => {
              try {
                await deny.mutateAsync({ id: r.id });
                invalidate();
                toast.success("Request denied");
              } catch {
                toast.error("Failed to deny");
              }
            }}
            data-testid={`button-deny-${r.id}`}
          >
            Deny
          </Button>
        </>
      ) : (
        <Badge
          variant={r.status === "approved" ? "default" : "outline"}
          className="uppercase text-[9px] tracking-wider"
        >
          {r.status}
        </Badge>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5 space-y-3">
          <h2 className="font-serif font-bold text-lg">Pending requests</h2>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          ) : (
            <div className="space-y-2">
              {pending.map((r) => (
                <Row key={r.id} r={r} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {decided.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="font-serif font-bold text-lg">History</h2>
            <div className="space-y-2">
              {decided.map((r) => (
                <Row key={r.id} r={r} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- Audit log -------------------------------------------------------------

const AUDIT_TARGET_TYPES = [
  "user",
  "role",
  "permission",
  "access_request",
  "invitation",
] as const;

function AuditTab() {
  const [actionFilter, setActionFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [targetType, setTargetType] = useState<string>("all");
  const [limit, setLimit] = useState<string>("100");

  const params = {
    ...(actionFilter.trim() ? { action: actionFilter.trim() } : {}),
    ...(actorFilter.trim() ? { actorId: actorFilter.trim() } : {}),
    ...(targetType !== "all" ? { targetType } : {}),
    ...(limit ? { limit: Number(limit) } : {}),
  };

  const { data: entries, isLoading } = useListAuditLog(params, {
    query: { queryKey: getListAuditLogQueryKey(params) },
  });

  const { data: users } = useListUsers();
  const actorOptions = users ?? [];

  const rows = entries ?? [];

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <h2 className="font-serif font-bold text-lg">Audit trail</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Action</Label>
            <Input
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="e.g. user.role_changed"
              data-testid="input-audit-action"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Actor</Label>
            <Select value={actorFilter || "all"} onValueChange={(v) => setActorFilter(v === "all" ? "" : v)}>
              <SelectTrigger data-testid="select-audit-actor">
                <SelectValue placeholder="Anyone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anyone</SelectItem>
                {actorOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Target type</Label>
            <Select value={targetType} onValueChange={setTargetType}>
              <SelectTrigger data-testid="select-audit-target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {AUDIT_TARGET_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Limit</Label>
            <Select value={limit} onValueChange={setLimit}>
              <SelectTrigger data-testid="select-audit-limit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["50", "100", "250", "500"].map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(actionFilter || actorFilter || targetType !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActionFilter("");
              setActorFilter("");
              setTargetType("all");
            }}
            data-testid="button-audit-clear"
          >
            Clear filters
          </Button>
        )}

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading audit log...</div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit entries yet.</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((e) => (
              <div
                key={e.id}
                className="flex items-start gap-3 p-2.5 rounded-md border border-border/60 bg-card text-sm"
                data-testid={`row-audit-${e.id}`}
              >
                <Badge variant="outline" className="text-[9px] uppercase tracking-wider shrink-0 mt-0.5">
                  {e.action}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <span className="font-medium">{e.actorName || "System"}</span>
                    {e.targetLabel ? (
                      <>
                        {" "}
                        → <span className="text-muted-foreground">{e.targetLabel}</span>
                      </>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
