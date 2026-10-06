"use client";

import { ChartColumn, ChartNoAxesCombined, TrendingUp } from "lucide-react";
import { useState } from "react";

import { NoPredictionArt } from "@/components/shared/illustrations";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  ExamplePatient,
  Feature,
  FeatureGroup,
  LadderResponse,
  MetricsResponse,
  PredictResponse,
  RiskBand,
  Target,
} from "@/lib/types";

import { ExplanationView } from "./ExplanationView";
import { LadderTrajectory } from "./LadderTrajectory";
import { PerformanceView } from "./PerformanceView";
import { TargetTile } from "./TargetTile";

interface ResultsPanelProps {
  targets: Target[];
  bands: RiskBand[];
  ladder: LadderResponse;
  metrics: MetricsResponse;
  groups: FeatureGroup[];
  features: Feature[];
  byStage: Record<number, PredictResponse>;
  activeStage: number;
  /** What would take the ladder one step further, or null at the top. */
  nextStepHint: string | null;
  loading: boolean;
  error: string | null;
  placeholders: number;
  placeholderNames: ReadonlySet<string>;
  example: ExamplePatient | null;
  selected: string;
  colorOf: (target: string) => string;
  onSelect: (target: string) => void;
}

type DetailView = "explanation" | "trajectory" | "performance";

// Radix wraps scroll content in a table-display div that grows to its widest child; make it a
// block so wide tables scroll inside their own container instead of stretching the panel.
const BLOCK_VIEWPORT = "[&_[data-slot=scroll-area-viewport]>div]:!block";

const DETAILS: Record<DetailView, { title: string; description: string }> = {
  explanation: {
    title: "Why this estimate",
    description: "Which measurements moved the estimate, and by how much (SHAP).",
  },
  trajectory: {
    title: "Estimate by step",
    description: "How each estimate and its range changed as tests were added.",
  },
  performance: {
    title: "Model performance",
    description: "Saved validation results for every step and target.",
  },
};

/** Right zone: the four estimates at a glance; explanation, trajectory and metrics open as dialogs. */
export function ResultsPanel(props: ResultsPanelProps) {
  const { targets, ladder, byStage, activeStage, selected, onSelect } = props;
  const [detail, setDetail] = useState<DetailView | null>(null);
  const stages = ladder.stages;
  const current = byStage[activeStage];
  const used = stages.filter((stage) => stage.id <= activeStage).map((stage) => stage.label);
  const interval = current?.predictions[selected]?.interval;

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Results">
      <header className="shrink-0 border-b py-4 pl-5 pr-12 lg:pr-5">
        <h2 className="text-lg font-semibold tracking-tight">Results</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {current ? `Step ${activeStage} of ${stages.length}: ${used.join(" + ")}` : "Calibrated estimates appear here."}
        </p>
        {current && <Progress value={(activeStage / stages.length) * 100} className="mt-3 h-1" />}
      </header>

      <ScrollArea className={`min-h-0 flex-1 ${BLOCK_VIEWPORT}`}>
        <div className="space-y-2.5 p-4">
          {props.error && (
            <p role="alert" className="rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive">
              Prediction failed: {props.error}
            </p>
          )}
          {!current && (props.loading || activeStage > 0) && <Skeleton className="h-96 w-full" />}
          {!current && !props.loading && activeStage === 0 && (
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
          )}
          {current &&
            targets.map((target) => (
              <TargetTile
                key={target.name}
                target={target}
                prediction={current.predictions[target.name]}
                bands={props.bands}
                color={props.colorOf(target.name)}
                selected={selected === target.name}
                actual={props.example?.actual[target.name] ?? null}
                onSelect={() => onSelect(target.name)}
              />
            ))}
          {current && props.nextStepHint && <p className="text-xs text-muted-foreground">{props.nextStepHint}</p>}
          {current && props.placeholders > 0 && (
            <p className="rounded-md border border-notice-border bg-notice px-3 py-2 text-xs text-notice-foreground">
              {props.placeholders} input{props.placeholders > 1 ? "s are" : " is"} a typical placeholder value, not this patient&apos;s data.
            </p>
          )}
        </div>
      </ScrollArea>

      <footer className="grid shrink-0 grid-cols-3 gap-2 border-t p-4">
        <Button disabled={!current} onClick={() => setDetail("explanation")} aria-label="Why this estimate">
          <ChartColumn /> Explain
        </Button>
        <Button variant="outline" disabled={!current} onClick={() => setDetail("trajectory")} aria-label="Estimate by step">
          <TrendingUp /> By step
        </Button>
        <Button variant="outline" onClick={() => setDetail("performance")} aria-label="Model performance">
          <ChartNoAxesCombined /> Metrics
        </Button>
      </footer>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        {detail && (
          <DialogContent className="flex max-h-[88dvh] flex-col gap-0 bg-card p-0 sm:max-w-2xl">
            <DialogHeader className="border-b p-5">
              <DialogTitle className="text-lg">{DETAILS[detail].title}</DialogTitle>
              <DialogDescription>{DETAILS[detail].description}</DialogDescription>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={selected}
                onValueChange={(value: string) => value && onSelect(value)}
                aria-label="Target"
                className="mt-2"
              >
                {targets.map((target) => (
                  <ToggleGroupItem key={target.name} value={target.name}>
                    {target.name}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="p-5">
                {detail === "explanation" && (
                  <ExplanationView
                    selected={selected}
                    prediction={current?.predictions[selected] ?? null}
                    stageLabel={stages.find((stage) => stage.id === activeStage)?.label ?? ""}
                    groups={props.groups}
                    features={props.features}
                    placeholderNames={props.placeholderNames}
                  />
                )}
                {detail === "trajectory" && (
                  <div className="space-y-3">
                    <LadderTrajectory targets={targets} stages={stages} byStage={byStage} selected={selected} onSelect={onSelect} />
                    <p className="text-sm text-muted-foreground">
                      Line: estimate in percent. Band: {interval?.lower_percentile}th to {interval?.upper_percentile}th percentile
                      over {interval?.n_bootstrap} bootstrap refits of that step&apos;s model. Steps:{" "}
                      {stages.map((stage) => `${stage.id} ${stage.label}`).join(", ")}. The band shows how much the estimate
                      depends on the training sample. It is not a clinical confidence interval, and a narrow band does not
                      mean an accurate model.
                    </p>
                  </div>
                )}
                {detail === "performance" && (
                  <PerformanceView targets={targets} ladder={ladder} metrics={props.metrics} selected={selected} activeStage={activeStage} />
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
