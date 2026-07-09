import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusChip } from "@/components/ui/status-chip";
import { PriorityChip } from "@/components/ui/priority-chip";
import { Progress } from "@/components/ui/progress";
import { formatDate, getTaskDateColor, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "wouter";
import { useState } from "react";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { ShieldAlert, Hand } from "lucide-react";
import { useReadOnly } from "@/lib/use-read-only";

export function TaskTable({ tasks, isLoading }: { tasks?: any[], isLoading?: boolean }) {
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const readOnly = useReadOnly();

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading tasks...</div>;
  }

  if (!tasks || tasks.length === 0) {
    return <div className="p-12 text-center border border-dashed rounded-lg bg-card text-muted-foreground">No tasks found.</div>;
  }

  return (
    <div className="border rounded-md bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Task</TableHead>
            <TableHead>Tactic</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow
              key={task.id}
              className={readOnly ? "" : "cursor-pointer hover:bg-muted/30"}
              onClick={readOnly ? undefined : () => setEditingTask(task)}
            >
              <TableCell className="font-medium max-w-[300px]" title={task.description}>
                <div className="flex items-center gap-1.5">
                  {task.isEscalated && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 shrink-0"
                      title={`Escalated to ${task.escalatedToName || "a lead"}`}
                      data-testid={`badge-escalated-${task.id}`}
                    >
                      <ShieldAlert className="w-3 h-3" />
                      Escalated
                    </span>
                  )}
                  {task.isBlockingViewer && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 shrink-0"
                      title={`${task.assigneeName || "Someone"} is blocked waiting on you to unblock this`}
                      data-testid={`badge-blocking-${task.id}`}
                    >
                      <Hand className="w-3 h-3" />
                      Blocking
                    </span>
                  )}
                  <span className="truncate">{task.description}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-xs font-mono text-muted-foreground">{task.projectCode}</span>
                  <Link
                    href={`/projects/${task.projectId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm hover:underline hover:text-primary truncate max-w-[200px] block"
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
                <div className="flex items-center gap-2">
                  <Progress value={task.percentComplete} className="w-16 h-2" />
                  <span className="text-xs text-muted-foreground w-8">{task.percentComplete}%</span>
                </div>
              </TableCell>
              <TableCell>
                <span className={`text-sm ${getTaskDateColor(task.dueDate)}`}>
                  {formatDate(task.dueDate)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TaskFormDialog
        open={!!editingTask}
        onOpenChange={(o) => { if (!o) setEditingTask(null); }}
        task={editingTask ?? undefined}
      />
    </div>
  );
}
