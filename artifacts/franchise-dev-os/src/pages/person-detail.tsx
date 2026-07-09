import { useListTasks, useListUsers, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { TaskTable } from "@/components/task-table";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useReadOnly } from "@/lib/use-read-only";

export default function PersonDetailPage({ params }: { params: { id: string } }) {
  const { data: users, isLoading: usersLoading } = useListUsers();
  const { data: tasks, isLoading: tasksLoading } = useListTasks({ assigneeId: params.id });
  const { user } = useAuth();
  const { data: me } = useGetMe({ query: { enabled: !!user, queryKey: getGetMeQueryKey() } });
  const readOnly = useReadOnly();
  const [taskOpen, setTaskOpen] = useState(false);

  const person = users?.find((u) => u.id === params.id);

  if (usersLoading || tasksLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading person details...</div>;
  }

  if (!person) {
    return <div className="p-8 text-center text-destructive">Person not found</div>;
  }

  const canAdd =
    !readOnly &&
    ((me?.permissions ?? []).includes("assign_tasks") || me?.id === person.id);
  const openCount = (tasks ?? []).filter((t) => t.status !== "Complete").length;
  const overdueCount = (tasks ?? []).filter((t) => t.isOverdue).length;
  const blockedCount = (tasks ?? []).filter((t) => t.status === "Blocked").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex items-center gap-6">
        <Avatar className="w-20 h-20 border-4 border-background shadow-sm">
          <AvatarFallback style={{ backgroundColor: person.avatarColor || '#333', color: 'white', fontSize: '24px' }}>
            {getInitials(person.name || '?')}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-2 flex-1 min-w-0">
          <h1 className="text-3xl font-serif font-bold text-foreground truncate">{person.name}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-muted-foreground">{person.email}</span>
            <Badge variant="secondary" className="uppercase text-[10px] tracking-wider">
              {person.role}
            </Badge>
          </div>
          <div className="flex gap-6 pt-2 text-sm">
            <span><b>{openCount}</b> <span className="text-muted-foreground text-xs uppercase tracking-wide ml-1">open</span></span>
            <span className={overdueCount > 0 ? "text-destructive" : ""}><b>{overdueCount}</b> <span className="text-muted-foreground text-xs uppercase tracking-wide ml-1">overdue</span></span>
            <span className={blockedCount > 0 ? "text-amber-600" : ""}><b>{blockedCount}</b> <span className="text-muted-foreground text-xs uppercase tracking-wide ml-1">blocked</span></span>
          </div>
        </div>
        {canAdd && (
          <Button onClick={() => setTaskOpen(true)} data-testid="button-new-task-for-person">
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-serif font-bold text-foreground">Assigned Tasks</h2>
        <TaskTable tasks={tasks} />
      </div>

      <TaskFormDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        defaultAssigneeId={person.id}
      />
    </div>
  );
}
