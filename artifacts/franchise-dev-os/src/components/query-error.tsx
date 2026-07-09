import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function QueryError({
  message = "Failed to load data",
  onRetry,
  retrying = false,
}: {
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="p-8 flex flex-col items-center justify-center gap-3 text-center">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-destructive">{message}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        disabled={retrying}
      >
        {retrying ? (
          <Spinner className="size-4" />
        ) : (
          <RotateCw className="size-4" />
        )}
        Try again
      </Button>
    </div>
  );
}
