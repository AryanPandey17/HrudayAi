import { Info } from "lucide-react";

import { NoPredictionArt } from "@/components/shared/illustrations";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExamplePatient, LadderStage, PredictResponse, RiskBand, Target } from "@/lib/types";

import { LadderTrajectory } from "./LadderTrajectory";
import { TargetRow } from "./TargetRow";

export interface PredictionTabProps {
  targets: Target[];
  bands: RiskBand[];
  stages: LadderStage[];
  byStage: Record<number, PredictResponse>;
  activeStage: number;
  /** What would take the ladder one step further, or null at the top. */
  nextStepHint: string | null;
  loading: boolean;
  placeholders: number;
  example: ExamplePatient | null;
  selected: string;
  colorOf: (target: string) => string;
  onSelect: (target: string) => void;
}

const SECTION_TITLE = "text-[13px] font-medium";

/** Current stage, the four estimates with their intervals, and how they moved up the ladder. */
export function PredictionTab(props: PredictionTabProps) {
  const { targets, stages, byStage, activeStage } = props;
  const current = byStage[activeStage];

  if (!current) {
    if (props.loading || activeStage > 0) return <Skeleton className="h-96 w-full" />;
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <NoPredictionArt className="h-20 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>No estimate yet</EmptyTitle>
          <EmptyDescription>
            Load an example patient, or complete the {stages[0].label.toLowerCase()} step. Later tests are optional.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const used = stages.filter((stage) => stage.id <= activeStage).map((stage) => stage.label);
  const interval = current.predictions[targets[0].name].interval;
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <p className={SECTION_TITLE}>
            Step {activeStage} of {stages.length} in use
          </p>
          <p className="text-xs text-muted-foreground">{props.loading ? "Updating" : used.join(" + ")}</p>
        </div>
        <Progress value={(activeStage / stages.length) * 100} className="mt-2 h-1.5" />
        {props.nextStepHint && <p className="mt-2 text-xs text-muted-foreground">{props.nextStepHint}</p>}
      </div>

      <div className="grid gap-2">
        {targets.map((target) => (
          <TargetRow
            key={target.name}
            target={target}
            prediction={current.predictions[target.name]}
            bands={props.bands}
            color={props.colorOf(target.name)}
            selected={props.selected === target.name}
            actual={props.example?.actual[target.name] ?? null}
            onSelect={() => props.onSelect(target.name)}
          />
        ))}
      </div>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>
          The range under each number is the {interval.lower_percentile}th to {interval.upper_percentile}th percentile over{" "}
          {interval.n_bootstrap} bootstrap refits of that step&apos;s model. It shows how much the estimate depends on the
          training sample. It is not a clinical confidence interval, and a narrow range does not mean an accurate model.
        </span>
      </p>
      {props.placeholders > 0 && (
        <p className="rounded-md border border-notice-border bg-notice px-3 py-2 text-xs text-notice-foreground">
          {props.placeholders} input{props.placeholders > 1 ? "s are" : " is"} a typical placeholder value, not this patient&apos;s data.
        </p>
      )}

      <Separator />
      <div>
        <p className={SECTION_TITLE}>How each estimate moved as tests were added</p>
        <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
          Estimate (line) and interval (band), in percent, at each step used so far. Steps: {stages.map((s) => `${s.id} ${s.label}`).join(", ")}.
        </p>
        <LadderTrajectory targets={targets} stages={stages} byStage={byStage} selected={props.selected} onSelect={props.onSelect} />
      </div>
    </div>
  );
}
