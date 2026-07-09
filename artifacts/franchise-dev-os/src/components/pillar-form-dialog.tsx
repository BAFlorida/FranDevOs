import { useState, useEffect } from "react";
import {
  useCreateFocusArea,
  createProject,
  useListUsers,
  getListProjectsQueryKey,
  getListFocusAreasQueryKey,
  getGetDashboardQueryKey,
  getGetReportTreeQueryKey,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Layers } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type DraftTactic = { code: string; name: string; ownerId: string };

export function PillarFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: users } = useListUsers();
  const createPillar = useCreateFocusArea();
  const [name, setName] = useState("");
  const [tactics, setTactics] = useState<DraftTactic[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setTactics([]);
      setSubmitting(false);
    }
  }, [open]);

  const addTacticRow = () => setTactics((t) => [...t, { code: "", name: "", ownerId: "" }]);
  const removeTacticRow = (i: number) => setTactics((t) => t.filter((_, idx) => idx !== i));
  const updateTactic = (i: number, patch: Partial<DraftTactic>) =>
    setTactics((t) => t.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Pillar name is required");
      return;
    }
    const filled = tactics.filter((t) => t.code.trim() || t.name.trim());
    for (const t of filled) {
      if (!t.code.trim() || !t.name.trim()) {
        toast.error("Each tactic needs both a code and a name");
        return;
      }
    }
    setSubmitting(true);
    try {
      const pillar = await createPillar.mutateAsync({ data: { name: name.trim() } });
      let tacticFailures = 0;
      for (const t of filled) {
        try {
          await createProject({
            id: t.code.trim(),
            name: t.name.trim(),
            focusAreaId: pillar.id,
            executiveOwnerId: t.ownerId || null,
            strategicGoal: "",
          });
        } catch {
          tacticFailures++;
        }
      }
      queryClient.invalidateQueries({ queryKey: getListFocusAreasQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetReportTreeQueryKey() });
      if (tacticFailures > 0) {
        toast.error(
          `Pillar created, but ${tacticFailures} tactic${tacticFailures === 1 ? "" : "s"} failed (codes may be duplicates).`,
        );
      } else {
        toast.success(
          filled.length > 0
            ? `Pillar created with ${filled.length} tactic${filled.length === 1 ? "" : "s"}`
            : "Pillar created",
        );
      }
      onOpenChange(false);
    } catch {
      toast.error("Failed to create pillar");
    } finally {
      setSubmitting(false);
    }
  };

  const owners = (users ?? []).filter((u) => u.role !== "member");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" /> New Strategic Pillar
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Pillar Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Brand Expansion"
              data-testid="input-pillar-name"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Tactics (optional)</label>
              <Button type="button" variant="outline" size="sm" onClick={addTacticRow} data-testid="button-add-tactic-row">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Tactic
              </Button>
            </div>
            {tactics.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add tactics now, or create them later from the pillar.
              </p>
            ) : (
              <div className="space-y-2">
                {tactics.map((t, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Input
                      value={t.code}
                      onChange={(e) => updateTactic(i, { code: e.target.value })}
                      placeholder="Code"
                      className="font-mono w-28 shrink-0"
                    />
                    <Input
                      value={t.name}
                      onChange={(e) => updateTactic(i, { name: e.target.value })}
                      placeholder="Tactic name"
                      className="flex-1"
                    />
                    <Select value={t.ownerId || "none"} onValueChange={(v) => updateTactic(i, { ownerId: v === "none" ? "" : v })}>
                      <SelectTrigger className="w-40 shrink-0">
                        <SelectValue placeholder="Owner" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        <SelectItem value="none">No owner</SelectItem>
                        {owners.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => removeTacticRow(i)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting} data-testid="button-create-pillar">
              {submitting ? "Creating..." : "Create Pillar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
