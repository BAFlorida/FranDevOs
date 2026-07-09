import { useListTasks } from "@workspace/api-client-react";
import { TaskTable } from "@/components/task-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { useReadOnly } from "@/lib/use-read-only";

export default function MyTasksPage() {
  const { data: tasks, isLoading } = useListTasks({ mine: true });
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const readOnly = useReadOnly();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-3xl font-serif font-bold text-foreground">My Tasks</h1>
        {!readOnly && (
          <div className="flex gap-2">
            <Button className="font-medium shadow-sm" onClick={() => setTaskModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Button>
          </div>
        )}
      </div>

      <TaskTable tasks={tasks} isLoading={isLoading} />

      <TaskFormDialog open={taskModalOpen} onOpenChange={setTaskModalOpen} />
    </div>
  );
}
