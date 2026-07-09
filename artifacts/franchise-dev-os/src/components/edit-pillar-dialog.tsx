import { useState, useEffect } from "react";
import {
  useUpdateFocusArea,
  useDeleteFocusArea,
  getListProjectsQueryKey,
  getListFocusAreasQueryKey,
  getGetDashboardQueryKey,
  getGetReportTreeQueryKey,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layers, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function EditPillarDialog({
  open,
  onOpenChange,
  pillar,
  canDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pillar: { id: number; name: string } | null;
  canDelete: boolean;
}) {
  const queryClient = useQueryClient();
  const updatePillar = useUpdateFocusArea();
  const deletePillar = useDeleteFocusArea();
  const [name, setName] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (open && pillar) {
      setName(pillar.name);
      setConfirmingDelete(false);
    }
  }, [open, pillar]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListFocusAreasQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetReportTreeQueryKey() });
  };

  const save = async () => {
    if (!pillar) return;
    if (!name.trim()) {
      toast.error("Pillar name is required");
      return;
    }
    try {
      await updatePillar.mutateAsync({ id: pillar.id, data: { name: name.trim() } });
      invalidate();
      toast.success("Pillar renamed");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as { data?: { error?: string } })?.data?.error ?? "Failed to rename pillar");
    }
  };

  const remove = async () => {
    if (!pillar) return;
    try {
      await deletePillar.mutateAsync({ id: pillar.id });
      invalidate();
      toast.success("Pillar deleted");
      onOpenChange(false);
    } catch (e) {
      // Server returns a friendly message when the pillar still has tactics.
      toast.error((e as { data?: { error?: string } })?.data?.error ?? "Failed to delete pillar");
      setConfirmingDelete(false);
    }
  };

  const busy = updatePillar.isPending || deletePillar.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" /> Edit Pillar
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Pillar Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Brand Expansion"
              data-testid="input-edit-pillar-name"
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            {canDelete ? (
              confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Delete this pillar?</span>
                  <Button variant="destructive" size="sm" onClick={remove} disabled={busy} data-testid="button-confirm-delete-pillar">
                    Yes, delete
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)} disabled={busy}>
                    No
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={busy}
                  data-testid="button-delete-pillar"
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                </Button>
              )
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={save} disabled={busy} data-testid="button-save-pillar">
                {updatePillar.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
