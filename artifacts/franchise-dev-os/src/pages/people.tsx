import {
  useListUsers,
  useUpdateUser,
  useGetDashboard,
  getListUsersQueryKey,
  getGetDashboardQueryKey,
  getGetMeQueryKey,
  useGetMe,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { getInitials } from "@/lib/utils";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@workspace/replit-auth-web";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Users,
  AlertCircle,
  CheckSquare,
  TrendingUp,
  X,
  Check,
  Pencil,
} from "lucide-react";
import { useMemo, useState } from "react";

type Role = "member" | "lead" | "admin" | "vp";

type FilterMode = "all" | "open" | "overdue" | "peopleOverdue";

export default function PeoplePage() {
  const { data: users, isLoading } = useListUsers();
  const { data: dashboard } = useGetDashboard();
  const { user } = useAuth();
  const { data: me } = useGetMe({ query: { enabled: !!user, queryKey: getGetMeQueryKey() } });
  const updateUserMutation = useUpdateUser();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterMode>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const statsById = useMemo(
    () => new Map((dashboard?.workload ?? []).map((w) => [w.userId, w])),
    [dashboard],
  );

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading team members...</div>;
  }

  const isAdmin = (me?.permissions ?? []).includes("manage_users" as never);

  const handleRoleChange = async (userId: string, newRole: Role) => {
    try {
      await updateUserMutation.mutateAsync({ id: userId, data: { role: newRole } });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      toast.success("Role updated");
    } catch {
      toast.error("Failed to update role");
    }
  };

  const handleNameSave = async (userId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("Name cannot be empty");
      return;
    }
    try {
      await updateUserMutation.mutateAsync({ id: userId, data: { name: trimmed } });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      setEditingId(null);
      toast.success("Name updated");
    } catch {
      toast.error("Failed to update name");
    }
  };

  const sortedAll = (users ?? []).slice().sort((a, b) => {
    const oa = statsById.get(a.id)?.openTasks ?? 0;
    const ob = statsById.get(b.id)?.openTasks ?? 0;
    if (ob !== oa) return ob - oa;
    return a.name.localeCompare(b.name);
  });

  const filtered = sortedAll.filter((m) => {
    const s = statsById.get(m.id);
    if (filter === "all") return true;
    if (filter === "open") return (s?.openTasks ?? 0) > 0;
    if (filter === "overdue" || filter === "peopleOverdue") return (s?.overdueCount ?? 0) > 0;
    return true;
  });

  const totalOpen = (dashboard?.workload ?? []).reduce((acc, w) => acc + w.openTasks, 0);
  const totalOverdue = (dashboard?.workload ?? []).reduce((acc, w) => acc + w.overdueCount, 0);
  const peopleWithOverdue = (dashboard?.workload ?? []).filter((w) => w.overdueCount > 0).length;

  const StatCard = ({
    mode,
    value,
    label,
    icon: Icon,
    tone,
  }: {
    mode: FilterMode;
    value: number;
    label: string;
    icon: typeof Users;
    tone?: "default" | "destructive" | "amber";
  }) => {
    const active = filter === mode;
    return (
      <button
        onClick={() => setFilter(active ? "all" : mode)}
        className={`text-left transition-all ${active ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
        data-testid={`button-filter-${mode}`}
      >
        <Card
          className={`hover:shadow-md transition ${
            tone === "destructive" ? "border-destructive/30" : ""
          } ${active ? "bg-primary/5" : ""}`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p
                className={`text-2xl font-serif font-bold ${
                  tone === "destructive" ? "text-destructive" : ""
                }`}
              >
                {value}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            </div>
            <Icon
              className={`w-8 h-8 ${
                tone === "destructive"
                  ? "text-destructive/30"
                  : tone === "amber"
                  ? "text-amber-500/30"
                  : "text-primary/30"
              }`}
            />
          </CardContent>
        </Card>
      </button>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-3">
          <Users className="w-8 h-8 text-primary" />
          Team Members
        </h1>
        {filter !== "all" && (
          <button
            onClick={() => setFilter("all")}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            data-testid="button-clear-filter"
          >
            <X className="w-3 h-3" /> Clear filter ({filtered.length}/{sortedAll.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard mode="all" value={users?.length ?? 0} label="People" icon={Users} />
        <StatCard mode="open" value={totalOpen} label="Open Tasks" icon={CheckSquare} />
        <StatCard mode="overdue" value={totalOverdue} label="Overdue" icon={AlertCircle} tone="destructive" />
        <StatCard
          mode="peopleOverdue"
          value={peopleWithOverdue}
          label="People w/ Overdue"
          icon={TrendingUp}
          tone="amber"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No people match this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((member) => {
            const stats = statsById.get(member.id);
            const open = stats?.openTasks ?? 0;
            const overdue = stats?.overdueCount ?? 0;
            const total = stats?.totalTasks ?? 0;
            const pct = stats?.percentComplete ?? 0;
            const complete = total - open;

            return (
              <Card
                key={member.id}
                className={`hover:shadow-md transition-shadow ${overdue > 0 ? "border-destructive/30" : ""}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="w-14 h-14 border-2 border-background shadow-sm shrink-0">
                      <AvatarFallback
                        style={{
                          backgroundColor: member.avatarColor || "#333",
                          color: "white",
                          fontSize: 18,
                        }}
                      >
                        {getInitials(member.name || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      {isAdmin && editingId === member.id ? (
                        <div className="flex items-center gap-1 mb-1">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleNameSave(member.id, editingName);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            autoFocus
                            className="h-7 text-sm"
                            data-testid={`input-edit-name-${member.id}`}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0"
                            onClick={() => handleNameSave(member.id, editingName)}
                            data-testid={`button-save-name-${member.id}`}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 group">
                          <h3 className="font-serif font-bold text-base truncate">{member.name}</h3>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(member.id);
                                setEditingName(member.name);
                              }}
                              className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              data-testid={`button-edit-name-${member.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!member.hasLogin && (
                            <Badge
                              variant="outline"
                              className="text-[8px] uppercase tracking-wider shrink-0"
                            >
                              No login
                            </Badge>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground truncate mb-2">{member.email}</p>
                      {isAdmin && member.id !== me?.id ? (
                        <Select
                          defaultValue={member.role}
                          onValueChange={(val) =>
                            handleRoleChange(member.id, val as "member" | "lead" | "admin" | "vp")
                          }
                        >
                          <SelectTrigger className="h-6 text-[10px] w-24 uppercase tracking-wider">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="lead">Lead</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="vp">VP</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary" className="uppercase text-[9px] tracking-wider">
                          {member.role}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
                    <div className="text-center">
                      <p className="text-lg font-serif font-bold">{open}</p>
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Open</p>
                    </div>
                    <div className="text-center">
                      <p
                        className={`text-lg font-serif font-bold ${
                          overdue > 0 ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        {overdue}
                      </p>
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Overdue</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-serif font-bold text-indigo-600">{complete}</p>
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Done</p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Avg completion</span>
                      <span className="font-bold">{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>

                  <Link href={`/people/${member.id}`}>
                    <div className="mt-4 w-full text-center text-xs font-medium text-primary hover:underline cursor-pointer py-2 border rounded-md hover:bg-primary/5 transition-colors">
                      View Tasks →
                    </div>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
