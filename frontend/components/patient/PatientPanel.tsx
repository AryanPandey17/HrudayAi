"use client";

import { Check, ChevronRight, RotateCcw } from "lucide-react";
import { useState } from "react";

import { StageIcon } from "@/components/shared/StageIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FormState, LadderStatus, RungStatus } from "@/lib/form";
import { formatPercent } from "@/lib/risk";
import type { ExamplePatient, Feature, LadderResponse, LadderStage, Target } from "@/lib/types";

import { StepDialog } from "./StepDialog";

interface PatientPanelProps {
  inputs: Map<string, Feature>;
  targets: Target[];
  ladder: LadderResponse;
  examples: ExamplePatient[];
  exampleSource: string;
  activeExampleId: string | null;
  /** Target whose per-step validated AUC is shown on each step. */
  selectedTarget: string;
  form: FormState;
  status: LadderStatus;
  onLoadExample: (example: ExamplePatient) => void;
  onChange: (name: string, text: string) => void;
  onToggleNotDone: (stage: number, notDone: boolean) => void;
  onFillPlaceholders: (stage: LadderStage) => void;
  onReset: () => void;
}

const SECTION_LABEL = "text-xs font-medium uppercase tracking-wide text-muted-foreground";

/** Summary of the dataset's angiography labels, e.g. "CAD, LAD and RCA stenotic". */
function actualSummary(example: ExamplePatient, targets: Target[]): string {
  const overall = targets.find((target) => target.scope === "overall");
  const stenotic = targets
    .filter((target) => target.scope === "vessel" && example.actual[target.name] === target.positive_label)
    .map((target) => target.name);
  const vessels = stenotic.length ? `${stenotic.join(", ")} stenotic` : "no stenotic vessel";
  return `${overall ? example.actual[overall.name] : ""}, ${vessels}`;
}

function rungState(rung: RungStatus, earlierUsed: boolean): { text: string; active: boolean } {
  if (rung.notDone) return { text: "Not done", active: false };
  if (rung.invalid) return { text: `${rung.invalid} out of range`, active: false };
  if (!rung.complete) return { text: `${rung.total - rung.filled} empty`, active: false };
  if (!earlierUsed) return { text: "Waiting for earlier step", active: false };
  return { text: "In use", active: true };
}

/** Left zone: example patients first, then the four ladder steps; each step opens its form in a dialog. */
export function PatientPanel(props: PatientPanelProps) {
  const { inputs, ladder, form, status, selectedTarget } = props;
  const [openStage, setOpenStage] = useState<number | null>(null);
  const opened = ladder.stages.find((stage) => stage.id === openStage) ?? null;

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Patient and test ladder">
      <header className="flex shrink-0 items-start justify-between gap-2 border-b py-4 pl-5 pr-12 lg:pr-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Patient</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Load an example or open a step.</p>
        </div>
        <Button variant="outline" size="sm" onClick={props.onReset}>
          <RotateCcw /> Reset
        </Button>
      </header>
      <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="space-y-5 p-4">
          <div>
            <h3 className={SECTION_LABEL}>Example patients</h3>
            <div className="mt-2 grid gap-2">
              {props.examples.map((example) => {
                const active = example.id === props.activeExampleId;
                return (
                  <button
                    key={example.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => props.onLoadExample(example)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border bg-muted/50 px-4 py-2.5 text-left transition-colors hover:bg-muted ${
                      active ? "border-foreground" : "border-transparent"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{example.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        Angiography: {actualSummary(example, props.targets)}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-sm font-medium tabular-nums">
                      {formatPercent(example.predicted_cad_probability)}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{props.exampleSource}. Percentages are predicted CAD.</p>
          </div>

          <div>
            <h3 className={SECTION_LABEL}>Test ladder</h3>
            <div className="mt-2 grid gap-2">
              {ladder.stages.map((stage, index) => {
                const rung = status.rungs[stage.id];
                const earlierUsed = index === 0 || status.rungs[ladder.stages[index - 1].id].used;
                const state = rungState(rung, earlierUsed);
                const auc = ladder.metrics[selectedTarget]?.stages[String(stage.id)]?.cv.roc_auc;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setOpenStage(stage.id)}
                    aria-label={`Edit step ${index + 1}: ${stage.label}`}
                    className="w-full rounded-lg bg-muted/50 px-4 py-2.5 text-left transition-colors hover:bg-muted"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                        <StageIcon stageKey={stage.key} className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">
                          {index + 1}. {stage.label}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <Badge variant={state.active ? "secondary" : "outline"} className={state.active ? "bg-background" : undefined}>
                          {state.active && <Check aria-hidden />}
                          {state.text}
                        </Badge>
                        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                      </span>
                    </span>
                    <Progress value={(rung.filled / rung.total) * 100} className="mt-2.5 h-1" />
                    <span className="mt-2 flex justify-between text-xs text-muted-foreground">
                      <span className="font-mono tabular-nums">
                        {rung.filled}/{rung.total} fields
                      </span>
                      {auc && (
                        <span className="font-mono tabular-nums">
                          {selectedTarget} AUC {auc.mean.toFixed(2)}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Steps are cumulative: the estimate uses every step up to the first one that is incomplete or not done. AUC is
              the cross-validated ROC-AUC of that step&apos;s {selectedTarget} model.
            </p>
          </div>
        </div>
      </ScrollArea>
      <StepDialog
        stage={opened}
        skippable={opened !== null && opened.id !== ladder.stages[0].id}
        rung={opened ? status.rungs[opened.id] : null}
        fields={opened ? opened.added_features.map((name) => inputs.get(name)!) : []}
        form={form}
        onClose={() => setOpenStage(null)}
        onChange={props.onChange}
        onToggleNotDone={props.onToggleNotDone}
        onFillPlaceholders={props.onFillPlaceholders}
      />
    </section>
  );
}
