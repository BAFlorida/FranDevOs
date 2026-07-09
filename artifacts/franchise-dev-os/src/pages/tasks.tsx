import { useListTasks, TaskStatus, TaskPriority } from "@workspace/api-client-react";
import { TaskTable } from "@/components/task-table";
import { Button } from "@/components/ui/button";
import { CheckSquare, X } from "lucide-react";
import { Link, useSearch } from "wouter";

const STATUS_VALUES = new Set<string>(Object.values(TaskStatus));
const PRIORITY_VALUES = new Set<string>(Object.values(TaskPriority));

const PRIORITY_CHIP_COLORS: Record<string, string> = {
  Critical: "text-destructive bg-destructive/5 border-destructive/30",
  High: "text-amber-700 bg-amber-50 border-amber-200",
  Medium: "text-blue-700 bg-blue-50 border-blue-200",
  Low: "text-gray-700 bg-gray-50 border-gray-200",
};

const STATUS_CHIP_COLORS: Record<string, string> = {
  "Not Started": "text-gray-700 bg-gray-50 border-gray-200",
  "In Progress": "text-blue-700 bg-blue-50 border-blue-200",
  "Waiting on Someone": "text-violet-700 bg-violet-50 border-violet-200",
  Blocked: "text-destructive bg-destructive/5 border-destructive/30",
  "Pending Review": "text-purple-700 bg-purple-50 border-purple-200",
  Complete: "text-green-700 bg-green-50 border-green-200",
};

export default function TasksPage() {
  const { data: tasks, isLoading } = useListTasks();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const statusParam = params.get("status");
  const priorityParam = params.get("priority");

  const statusFilter = statusParam && STATUS_VALUES.has(statusParam) ? statusParam : null;
  const priorityFilter =
    priorityParam && PRIORITY_VALUES.has(priorityParam) ? priorityParam : null;

  const all = tasks ?? [];
  const filtered = all.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  });

  const hasFilter = !!statusFilter || !!priorityFilter;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-3">
          <CheckSquare className="w-8 h-8 text-primary" />
          Tasks
        </h1>
        {hasFilter && (
          <Link href="/tasks">
            <Button variant="outline" size="sm">
              <X className="w-3.5 h-3.5 mr-1" /> Clear filter
            </Button>
          </Link>
        )}
      </div>

      {hasFilter && (
        <div className="flex items-center gap-2 flex-wrap">
          {statusFilter && (
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${
                STATUS_CHIP_COLORS[statusFilter] ?? "text-foreground bg-muted border-border"
              }`}
            >
              <span>Status: {statusFilter}</span>
            </div>
          )}
          {priorityFilter && (
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${
                PRIORITY_CHIP_COLORS[priorityFilter] ?? "text-foreground bg-muted border-border"
              }`}
            >
              <span>Priority: {priorityFilter}</span>
            </div>
          )}
          <span className="text-sm text-muted-foreground font-medium">
            {filtered.length} {filtered.length === 1 ? "task" : "tasks"}
          </span>
        </div>
      )}

      <TaskTable tasks={filtered} isLoading={isLoading} />
    </div>
  );
}
