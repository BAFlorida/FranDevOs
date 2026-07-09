import { useListTasks, useUpdateTask, useGetMe, getGetMeQueryKey, TaskStatus, getListTasksQueryKey, getListProjectsQueryKey, getGetDashboardQueryKey, getGetReportTreeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { StatusChip } from "@/components/ui/status-chip";
import { PriorityChip } from "@/components/ui/priority-chip";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, getTaskDateColor, getInitials } from "@/lib/utils";
import { Link } from "wouter";
import { CheckCircle2, Undo2, ClipboardCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function CompletionRequestsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: me } = useGetMe({ query: { enabled: !!user, queryKey: getGetMeQueryKey() } });
  const isManager = (me?.permissions ?? []).includes("approve_completion");
  const { data: tasks, isLoading } = useListTasks(
    { status: TaskStatus.Pending_Review },
    { query: { enabled: isManager } as any },
  );
  const updateMutation = useUpdateTask();

  const pending = tasks ?? [];

  if (me && !isManager) {
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetReportTreeQueryKey() });
  };

  const review = async (taskId: number, status: TaskStatus, successMsg: string) => {
    try {
      await updateMutation.mutateAsync({ id: taskId, data: { status } });
      toast.success(successMsg);
      invalidate();
    } catch {
      toast.error("Failed to update task");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Completion Requests</h1>
          <p className="text-sm text-muted-foreground">
            Tasks your team marked done. Confirm to complete, or send back if more work is needed.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Loading…</div>
      ) : pending.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
            No tasks are awaiting review right now.
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-md bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Task</TableHead>
                <TableHead>Tactic</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium max-w-[280px] truncate" title={task.description}>
                    {task.description}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-mono text-muted-foreground">{task.projectCode}</span>
                      <Link
                        href={`/projects/${task.projectId}`}
                        className="text-sm hover:underline hover:text-primary truncate max-w-[180px] block"
                      >
                        {task.projectName}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback style={{ backgroundColor: task.assigneeAvatarColor || '#333', color: 'white', fontSize: '10px' }}>
                          {getInitials(task.assigneeName || '?')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{task.assigneeName}</span>
                    </div>
                  </TableCell>
                  <TableCell><StatusChip status={task.status} /></TableCell>
                  <TableCell><PriorityChip priority={task.priority} /></TableCell>
                  <TableCell>
                    <span className={`text-sm ${getTaskDateColor(task.dueDate)}`}>
                      {formatDate(task.dueDate)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateMutation.isPending}
                        onClick={() => review(task.id, TaskStatus.In_Progress, "Sent back to In Progress")}
                        data-testid={`button-send-back-${task.id}`}
                      >
                        <Undo2 className="w-4 h-4 mr-1" />
                        Send Back
                      </Button>
                      <Button
                        size="sm"
                        disabled={updateMutation.isPending}
                        onClick={() => review(task.id, TaskStatus.Complete, "Task confirmed complete")}
                        data-testid={`button-confirm-${task.id}`}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Confirm
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
