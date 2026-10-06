import { StageIcon } from "@/components/shared/StageIcon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { FormState, RungStatus } from "@/lib/form";
import type { Feature, LadderStage } from "@/lib/types";

import { FeatureField } from "./FeatureField";

interface StepDialogProps {
  stage: LadderStage | null;
  /** False for the first step, which cannot be skipped. */
  skippable: boolean;
  rung: RungStatus | null;
  fields: Feature[];
  form: FormState;
  onClose: () => void;
  onChange: (name: string, text: string) => void;
  onToggleNotDone: (stage: number, notDone: boolean) => void;
  onFillPlaceholders: (stage: LadderStage) => void;
}

/** Modal form for one ladder step: its fields, the "test not done" switch and placeholder fill. */
export function StepDialog({ stage, skippable, rung, fields, form, onClose, ...actions }: StepDialogProps) {
  return (
    <Dialog open={stage !== null} onOpenChange={(open) => !open && onClose()}>
      {stage && rung && (
        <DialogContent className="flex max-h-[88dvh] flex-col gap-0 bg-card p-0 sm:max-w-2xl">
          <DialogHeader className="border-b p-5">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <StageIcon stageKey={stage.key} className="size-5 text-muted-foreground" /> {stage.label}
            </DialogTitle>
            <DialogDescription>
              {rung.filled} of {rung.total} fields filled. Values are checked against the allowed range as you type.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-4 p-5">
              {skippable && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-4 py-3">
                  <Label htmlFor="step-not-done" className="text-sm font-normal">
                    This test was not done. Stop the ladder before this step.
                  </Label>
                  <Switch
                    id="step-not-done"
                    checked={rung.notDone}
                    onCheckedChange={(checked) => actions.onToggleNotDone(stage.id, checked)}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
                {fields.map((feature) => (
                  <FeatureField key={feature.name} feature={feature} field={form[feature.name]} onChange={actions.onChange} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="border-t p-5 sm:justify-between">
            <Button variant="outline" disabled={rung.filled === rung.total} onClick={() => actions.onFillPlaceholders(stage)}>
              Fill {rung.total - rung.filled} empty with typical values
            </Button>
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
