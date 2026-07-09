import { Badge } from "@/components/ui/badge";
import { TaskPriority } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { AlertCircle, ArrowUp, ArrowRight, ArrowDown } from "lucide-react";

export function PriorityChip({ priority }: { priority?: TaskPriority | string }) {
  if (!priority) return null;

  let icon = <ArrowRight className="w-3 h-3 mr-1" />;
  let color = "text-muted-foreground";

  switch (priority) {
    case TaskPriority.Critical:
      icon = <AlertCircle className="w-3 h-3 mr-1" />;
      color = "text-destructive";
      break;
    case TaskPriority.High:
      icon = <ArrowUp className="w-3 h-3 mr-1" />;
      color = "text-amber-600 dark:text-amber-500";
      break;
    case TaskPriority.Medium:
      icon = <ArrowRight className="w-3 h-3 mr-1" />;
      color = "text-blue-600 dark:text-blue-500";
      break;
    case TaskPriority.Low:
      icon = <ArrowDown className="w-3 h-3 mr-1" />;
      color = "text-gray-500";
      break;
  }

  return (
    <div className={cn("flex items-center text-xs font-medium", color)}>
      {icon}
      {priority}
    </div>
  );
}
