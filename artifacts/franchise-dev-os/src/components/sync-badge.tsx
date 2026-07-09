import { cn } from "@/lib/utils";
import { freshness, isStale } from "@/lib/crm";
import { RefreshCw } from "lucide-react";

export function SyncBadge({
  syncedAt,
  className,
  showIcon = true,
}: {
  syncedAt?: string | null;
  className?: string;
  showIcon?: boolean;
}) {
  const stale = isStale(syncedAt);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        stale ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
        className,
      )}
      title={syncedAt ? new Date(syncedAt).toLocaleString() : undefined}
    >
      {showIcon && <RefreshCw className="h-3 w-3" />}
      {freshness(syncedAt)}
    </span>
  );
}
