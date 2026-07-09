import { useGetProject, HealthColor } from "@workspace/api-client-react";
import { TaskTable } from "@/components/task-table";
import { Button } from "@/components/ui/button";
import { Plus, Edit, FolderKanban } from "lucide-react";
import { useState } from "react";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { ProjectFormDialog } from "@/components/project-form-dialog";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useReadOnly } from "@/lib/use-read-only";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { data: projectDetail, isLoading } = useGetProject(params.id);
  const { user } = useAuth();
  const { data: me } = useGetMe({ query: { enabled: !!user, queryKey: getGetMeQueryKey() } });
  
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading tactic details...</div>;
  }

  if (!projectDetail) {
    return <div className="p-8 text-center text-destructive">Tactic not found</div>;
  }

  const readOnly = useReadOnly();
  const canEditProject = (me?.permissions ?? []).includes("edit_initiatives");
  
  const healthMap = {
    [HealthColor.green]: "text-green-600",
    [HealthColor.amber]: "text-amber-600",
    [HealthColor.red]: "text-destructive",
    [HealthColor.gray]: "text-muted-foreground",
  };
  const healthColor = healthMap[projectDetail.rollup.healthColor] || healthMap[HealthColor.gray];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="bg-card border border-border p-6 rounded-xl shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold px-2 py-1 bg-muted rounded border border-border">
                {projectDetail.id}
              </span>
              <Badge variant="outline" className="uppercase text-[10px] tracking-wider">
                {projectDetail.focusAreaName}
              </Badge>
            </div>
            <h1 className="text-3xl font-serif font-bold text-foreground">{projectDetail.name}</h1>
            <p className="text-muted-foreground max-w-2xl">{projectDetail.strategicGoal}</p>
          </div>
          
          <div className="flex items-center gap-2">
            {canEditProject && (
              <Button variant="outline" onClick={() => setProjectModalOpen(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Tactic
              </Button>
            )}
            {!readOnly && (
              <Button onClick={() => setTaskModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </Button>
            )}
          </div>
        </div>

        {/* Rollup Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-6 border-t border-border/50">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
            <p className={`font-bold ${healthColor}`}>{projectDetail.rollup.status}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Progress</p>
            <div className="flex items-center gap-2">
              <p className="font-bold">{Math.round(projectDetail.rollup.percentComplete)}%</p>
              <Progress value={projectDetail.rollup.percentComplete} className="w-16 h-2" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Tasks</p>
            <p className="font-bold">{projectDetail.rollup.taskCount}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Overdue</p>
            <p className={`font-bold ${projectDetail.rollup.overdueCount > 0 ? 'text-destructive' : ''}`}>
              {projectDetail.rollup.overdueCount}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Exec Owner</p>
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarFallback style={{ fontSize: '10px' }} className="bg-primary text-primary-foreground">
                  {getInitials(projectDetail.executiveOwnerName || '?')}
                </AvatarFallback>
              </Avatar>
              <p className="text-sm font-medium">{projectDetail.executiveOwnerName || 'None'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-serif font-bold text-foreground">Tasks</h2>
        <TaskTable tasks={projectDetail.tasks} />
      </div>

      <TaskFormDialog 
        open={taskModalOpen} 
        onOpenChange={setTaskModalOpen} 
        defaultProjectId={projectDetail.id} 
      />
      {canEditProject && (
        <ProjectFormDialog 
          open={projectModalOpen} 
          onOpenChange={setProjectModalOpen} 
          project={projectDetail} 
        />
      )}
    </div>
  );
}
