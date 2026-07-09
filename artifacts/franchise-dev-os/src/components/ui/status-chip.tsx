import { Badge } from "@/components/ui/badge";
import { TaskStatus } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export function StatusChip({ status }: { status?: TaskStatus | string }) {
  if (!status) return null;

  let bg = "bg-muted text-muted-foreground";
  
  switch (status) {
    case TaskStatus.Complete:
      bg = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      break;
    case TaskStatus.In_Progress:
      bg = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      break;
    case TaskStatus.Blocked:
      bg = "bg-destructive/10 text-destructive dark:bg-destructive/20";
      break;
    case TaskStatus.Waiting_on_Someone:
      bg = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      break;
    case TaskStatus.Pending_Review:
      bg = "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      break;
    case TaskStatus.Not_Started:
    default:
      bg = "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      break;
  }

  return (
    <Badge variant="outline" className={cn("font-medium border-transparent", bg)}>
      {status}
    </Badge>
  );
}
