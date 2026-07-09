import { cn } from "@/lib/utils";
import { sourceMeta } from "@/lib/crm";
import type { CrmSourceSystem } from "@workspace/api-client-react";

export function SourceBadge({
  source,
  className,
}: {
  source?: CrmSourceSystem | string | null;
  className?: string;
}) {
  const meta = sourceMeta(source);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold",
        meta.className,
        className,
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.dot }}
      />
      {meta.label}
    </span>
  );
}
