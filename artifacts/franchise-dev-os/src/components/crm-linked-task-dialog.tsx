import {
  useListProjects,
  useListUsers,
  useGetMe,
  getGetMeQueryKey,
  useCreateLinkedTask,
  getListTasksQueryKey,
  getGetDashboardQueryKey,
  TaskRole,
  TaskPriority,
  TaskStatus,
  type CrmSourceSystem,
  type LinkedTaskInputRecordType,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SourceBadge } from "@/components/source-badge";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { useReadOnly } from "@/lib/use-read-only";
import { useEffect } from "react";
import { Link2 } from "lucide-react";

const schema = z.object({
  projectId: z.string().min(1, "Tactic is required"),
  assigneeId: z.string().min(1, "Assignee is required"),
  description: z.string().min(1, "Description is required"),
  priority: z.nativeEnum(TaskPriority),
  dueDate: z.string().optional().nullable(),
  nextStep: z.string().optional().nullable(),
});

export type LinkedRecord = {
  sourceSystem: CrmSourceSystem;
  recordType: LinkedTaskInputRecordType;
  recordId: number;
  title: string;
};

export function CrmLinkedTaskDialog({
  open,
  onOpenChange,
  record,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: LinkedRecord | null;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: projects } = useListProjects();
  const { data: users } = useListUsers();
  const { data: me } = useGetMe({
    query: { enabled: !!user, queryKey: getGetMeQueryKey() },
  });
  const createMutation = useCreateLinkedTask();
  const readOnly = useReadOnly();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      projectId: "",
      assigneeId: "",
      description: "",
      priority: TaskPriority.Medium,
      dueDate: "",
      nextStep: "",
    },
  });

  useEffect(() => {
    if (open && record) {
      form.reset({
        projectId: "",
        assigneeId: me?.id || user?.id || "",
        description: `Follow up on ${record.title}`,
        priority: TaskPriority.Medium,
        dueDate: "",
        nextStep: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record, me, user]);

  const onSubmit = (data: any) => {
    if (!record) return;
    createMutation.mutate(
      {
        data: {
          sourceSystem: record.sourceSystem,
          recordType: record.recordType,
          recordId: record.recordId,
          projectId: data.projectId,
          assigneeId: data.assigneeId,
          role: TaskRole.Owner,
          description: data.description,
          priority: data.priority,
          status: TaskStatus.Not_Started,
          percentComplete: 0,
          dueDate: data.dueDate || null,
          nextStep: data.nextStep || null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          toast.success("Follow-up task created and linked");
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to create follow-up task"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Create Follow-up Task
          </DialogTitle>
          <DialogDescription>
            Creates a task in the project module, linked to this CRM record.
          </DialogDescription>
        </DialogHeader>

        {record && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <SourceBadge source={record.sourceSystem} />
            <span className="capitalize text-muted-foreground">
              {record.recordType}
            </span>
            <span className="font-medium truncate">{record.title}</span>
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    {projects?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="font-mono text-muted-foreground mr-2">
                          {p.id.split("-")[0]}
                        </span>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.projectId && (
              <p className="text-xs text-destructive">
                {form.formState.errors.projectId.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      {users?.map((u) => (
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
                      {Object.values(TaskPriority).map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea {...form.register("description")} rows={2} />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <Input type="date" {...form.register("dueDate")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Next Step</label>
              <Input {...form.register("nextStep")} placeholder="Optional" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={readOnly || createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
