import { useListProjects, useListUsers, useListFocusAreas, useCreateProject, useUpdateProject, getListProjectsQueryKey, getGetProjectQueryKey, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const schema = z.object({
  id: z.string().min(1, "Code is required").max(10),
  name: z.string().min(1, "Name is required"),
  focusAreaId: z.coerce.number().min(1),
  executiveOwnerId: z.string().optional().nullable(),
  strategicGoal: z.string().optional().nullable(),
});

export function ProjectFormDialog({ 
  open, 
  onOpenChange, 
  project,
  defaultFocusAreaId,
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  project?: any;
  defaultFocusAreaId?: number;
}) {
  const queryClient = useQueryClient();
  const { data: users } = useListUsers();
  const { data: focusAreas } = useListFocusAreas();
  
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      id: project?.id || "",
      name: project?.name || "",
      focusAreaId: project?.focusAreaId || defaultFocusAreaId || 0,
      executiveOwnerId: project?.executiveOwnerId || "",
      strategicGoal: project?.strategicGoal || "",
    }
  });

  useEffect(() => {
    if (open) {
      form.reset({
        id: project?.id || "",
        name: project?.name || "",
        focusAreaId: project?.focusAreaId || defaultFocusAreaId || 0,
        executiveOwnerId: project?.executiveOwnerId || "",
        strategicGoal: project?.strategicGoal || "",
      });
    }
  }, [open, project, defaultFocusAreaId, form]);

  const onSubmit = (data: any) => {
    const payload = { ...data };
    if (!payload.executiveOwnerId) payload.executiveOwnerId = null;

    const promise = project
      ? updateMutation.mutateAsync({ id: project.id, data: payload })
      : createMutation.mutateAsync({ data: payload });

    toast.promise(promise, {
      loading: project ? "Updating tactic..." : "Creating tactic...",
      success: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        if (project) {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(project.id) });
        }
        onOpenChange(false);
        return project ? "Tactic updated" : "Tactic created";
      },
      error: "Failed to save tactic"
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{project ? "Edit Tactic" : "New Tactic"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tactic Code</label>
              <Input 
                {...form.register("id")} 
                placeholder="e.g. Q3-EXP" 
                className="font-mono"
                disabled={!!project} 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Tactic Name</label>
              <Input {...form.register("name")} placeholder="Tactic Title" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Strategic Pillar</label>
              <Controller
                control={form.control}
                name="focusAreaId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value?.toString() || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select strategic pillar" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {focusAreas?.sort((a, b) => a.sortOrder - b.sortOrder).map(f => (
                        <SelectItem key={f.id} value={f.id.toString()}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Executive Owner</label>
              <Controller
                control={form.control}
                name="executiveOwnerId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {users?.filter(u => u.role !== 'member').map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Strategic Goal</label>
              <Textarea {...form.register("strategicGoal")} rows={3} placeholder="What is the objective of this tactic?" />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {project ? "Save Changes" : "Create Tactic"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
