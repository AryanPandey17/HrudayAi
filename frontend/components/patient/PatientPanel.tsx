"use client";

import { Check, Minus, RotateCcw, UserRound } from "lucide-react";

import { stageIcon } from "@/components/shared/stage-icons";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import type { FormState, LadderStatus, RungStatus } from "@/lib/form";
import { formatPercent } from "@/lib/risk";
import type { ExamplePatient, Feature, LadderResponse, LadderStage, Target } from "@/lib/types";

import { FeatureField } from "./FeatureField";

interface PatientPanelProps {
  inputs: Map<string, Feature>;
  targets: Target[];
  ladder: LadderResponse;
  examples: ExamplePatient[];
  exampleSource: string;
  activeExampleId: string | null;
  /** Target whose per-stage validated AUC is shown on each rung. */
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

function rungMessage(rung: RungStatus, earlierUsed: boolean): string {
  if (rung.notDone) return "Marked as not done";
  if (rung.invalid) return `${rung.invalid} value${rung.invalid > 1 ? "s" : ""} out of range`;
  if (!rung.complete) return `${rung.total - rung.filled} of ${rung.total} fields empty`;
  if (!earlierUsed) return "Complete, but an earlier step is missing";
  return "In use";
}

function RungMarker({ index, rung }: { index: number; rung: RungStatus }) {
  const tone = rung.used ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground";
  return (
    <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${tone}`} aria-hidden>
      {rung.used ? <Check className="size-3.5" /> : rung.notDone ? <Minus className="size-3.5" /> : index}
    </span>
  );
}

/** Left zone: example patients first, then the four-rung test ladder with its schema-driven fields. */
export function PatientPanel(props: PatientPanelProps) {
  const { inputs, ladder, form, status, selectedTarget } = props;

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Patient and test ladder">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b py-3 pl-4 pr-12 lg:pr-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Patient</h2>
          <p className="text-xs text-muted-foreground">Load an example, then adjust or add tests.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={props.onReset}>
          <RotateCcw /> Reset
        </Button>
      </header>
      <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="space-y-6 p-4">
          <div>
            <h3 className={SECTION_LABEL}>Example patients</h3>
            <div className="mt-2 grid gap-2">
              {props.examples.map((example) => (
                <Button
                  key={example.id}
                  variant={example.id === props.activeExampleId ? "secondary" : "outline"}
                  aria-pressed={example.id === props.activeExampleId}
                  onClick={() => props.onLoadExample(example)}
                  className="h-auto w-full items-start justify-between gap-3 px-3 py-2 text-left whitespace-normal"
                >
                  <span className="flex min-w-0 items-start gap-2">
                    <UserRound className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{example.label}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        Test patient {example.dataset_row} · angiography: {actualSummary(example, props.targets)}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    CAD {formatPercent(example.predicted_cad_probability)}
                  </span>
                </Button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{props.exampleSource}.</p>
          </div>

          <div>
            <h3 className={SECTION_LABEL}>Test ladder</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Steps are cumulative. The estimate uses every step up to the first one that is incomplete or not done.
            </p>
            <Accordion type="single" collapsible defaultValue={String(ladder.stages[0].id)} className="mt-2 rounded-lg border">
              {ladder.stages.map((stage, index) => {
                const rung = status.rungs[stage.id];
                const Icon = stageIcon(stage.key);
                const earlierUsed = index === 0 || status.rungs[ladder.stages[index - 1].id].used;
                const auc = ladder.metrics[selectedTarget]?.stages[String(stage.id)]?.cv.roc_auc;
                const fields = stage.added_features.map((name) => inputs.get(name)!);
                const switchId = `not-done-${stage.id}`;
                return (
                  <AccordionItem key={stage.id} value={String(stage.id)} className="px-3">
                    <AccordionTrigger className="items-center py-3 hover:no-underline">
                      <span className="flex min-w-0 flex-1 items-center gap-3">
                        <RungMarker index={index + 1} rung={rung} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            <Icon className="size-4 text-muted-foreground" aria-hidden />
                            {stage.label}
                          </span>
                          <span className="block text-xs font-normal text-muted-foreground">{rungMessage(rung, earlierUsed)}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {rung.filled}/{rung.total}
                          </span>
                          {auc && (
                            <Badge variant="outline" className="font-mono tabular-nums">
                              {selectedTarget} AUC {auc.mean.toFixed(2)}
                            </Badge>
                          )}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pb-4">
                      {index > 0 && (
                        <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2">
                          <Label htmlFor={switchId} className="text-[13px] font-normal">
                            Test not done. Stop the ladder before this step.
                          </Label>
                          <Switch
                            id={switchId}
                            checked={rung.notDone}
                            onCheckedChange={(checked) => props.onToggleNotDone(stage.id, checked)}
                          />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                        {fields.map((feature) => (
                          <FeatureField key={feature.name} feature={feature} field={form[feature.name]} onChange={props.onChange} />
                        ))}
                      </div>
                      {rung.filled < rung.total && (
                        <Button variant="ghost" size="sm" onClick={() => props.onFillPlaceholders(stage)}>
                          Fill {rung.total - rung.filled} empty with typical placeholder values
                        </Button>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
            <p className="mt-2 text-xs text-muted-foreground">
              AUC on each step is the cross-validated ROC-AUC of that step&apos;s {selectedTarget} model. BMI and obesity are
              computed from weight and height.
            </p>
          </div>
        </div>
      </ScrollArea>
    </section>
  );
}
