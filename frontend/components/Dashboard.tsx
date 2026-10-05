"use client";

import { ClipboardList, ServerCrash } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { type DashboardData, useDashboardData } from "@/hooks/useDashboardData";
import { type StageRequest, useLadderPredictions } from "@/hooks/useLadderPredictions";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { APP_NAME, FALLBACK_DISCLAIMER, HEART_MODEL_CREDIT } from "@/lib/config";
import { fillPlaceholders, formFromExample, type FormState, ladderStatus, stagePayload } from "@/lib/form";
import { formatPercent, riskColor } from "@/lib/risk";
import type { ExamplePatient, LadderStage, TargetPrediction } from "@/lib/types";

import { AppHeader } from "./app/AppHeader";
import { DisclaimerStrip } from "./app/DisclaimerStrip";
import type { VesselState } from "./heart/HeartScene";
import { HeartViewer } from "./heart/HeartViewer";
import { PatientPanel } from "./patient/PatientPanel";
import { ResultsPanel } from "./results/ResultsPanel";
import { isLowerReliability } from "./shared/badges";
import { Button } from "./ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "./ui/empty";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Skeleton } from "./ui/skeleton";

// Vessel opacity: solid up to a 15-point interval, fading to 55% at 50 points or wider.
const SOLID_WIDTH = 0.15;
const FADED_WIDTH = 0.5;
const MIN_OPACITY = 0.55;
const LOWER_RELIABILITY_OPACITY = 0.7;

function vesselOpacity(prediction: TargetPrediction): number {
  const width = prediction.interval.high - prediction.interval.low;
  const fade = Math.min(1, Math.max(0, (width - SOLID_WIDTH) / (FADED_WIDTH - SOLID_WIDTH)));
  const fromInterval = 1 - fade * (1 - MIN_OPACITY);
  return isLowerReliability(prediction.stage_metrics) ? Math.min(fromInterval, LOWER_RELIABILITY_OPACITY) : fromInterval;
}

function nextStepHint(stages: LadderStage[], status: ReturnType<typeof ladderStatus>): string | null {
  const next = stages.find((stage) => stage.id === status.activeStage + 1);
  if (!next) return null;
  const rung = status.rungs[next.id];
  if (rung.notDone) return `${next.label} is marked as not done, so the estimate stops here.`;
  if (rung.invalid) return `Fix ${rung.invalid} out-of-range ${next.label} value${rung.invalid > 1 ? "s" : ""} to reach step ${next.id}.`;
  const missing = rung.total - rung.filled;
  return `Add ${missing} ${next.label.toLowerCase()} value${missing > 1 ? "s" : ""} to reach step ${next.id}.`;
}

function Workspace({ data }: { data: DashboardData }) {
  const { schema, examples, metrics, ladder } = data;
  const tokens = useThemeTokens();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const inputs = useMemo(() => new Map(schema.features.filter((f) => !f.derived).map((f) => [f.name, f])), [schema]);
  const overall = schema.targets.find((target) => target.scope === "overall") ?? schema.targets[0];

  const [form, setForm] = useState<FormState>({});
  const [notDone, setNotDone] = useState<ReadonlySet<number>>(new Set());
  const [example, setExample] = useState<ExamplePatient | null>(null);
  const [selected, setSelected] = useState(overall.name);

  const status = useMemo(() => ladderStatus(form, inputs, ladder.stages, notDone), [form, inputs, ladder, notDone]);
  const requests: StageRequest[] = useMemo(
    () =>
      ladder.stages
        .filter((stage) => stage.id <= status.activeStage)
        .map((stage) => ({ stage: stage.id, payload: stagePayload(form, inputs, stage) })),
    [ladder, status.activeStage, form, inputs],
  );
  const predictions = useLadderPredictions(requests);
  const current = predictions.byStage[status.activeStage]?.predictions;

  const colorOf = (target: string) => (current?.[target] ? riskColor(current[target].probability, tokens.risk) : tokens.vesselIdle);
  const vessels: Record<string, VesselState> = Object.fromEntries(
    schema.targets
      .filter((target) => target.scope === "vessel")
      .map(({ name }) => [
        name,
        {
          color: colorOf(name),
          opacity: current?.[name] ? vesselOpacity(current[name]) : 1,
          valueLabel: current?.[name] ? formatPercent(current[name].probability) : null,
        },
      ]),
  );
  const placeholderNames = new Set([...inputs.keys()].filter((name) => form[name]?.source === "placeholder"));

  const loadExample = (next: ExamplePatient) => {
    setForm(formFromExample(next, [...inputs.values()]));
    setNotDone(new Set());
    setExample(next);
    toast(`Loaded example: ${next.label.toLowerCase()}`, { description: `Held-out test patient ${next.dataset_row}` });
  };
  const changeField = (name: string, text: string) => {
    setForm((previous) => ({ ...previous, [name]: { text, source: "patient" } }));
    setExample(null);
  };
  const toggleNotDone = (stage: number, value: boolean) =>
    setNotDone((previous) => {
      const next = new Set(previous);
      if (value) next.add(stage);
      else next.delete(stage);
      return next;
    });
  const fillStage = (stage: LadderStage) =>
    setForm((previous) => fillPlaceholders(previous, stage.added_features.map((name) => inputs.get(name)!)));
  const reset = () => {
    setForm({});
    setNotDone(new Set());
    setExample(null);
    setSelected(overall.name);
  };

  const patient = (
    <PatientPanel
      inputs={inputs}
      targets={schema.targets}
      ladder={ladder}
      examples={examples.examples}
      exampleSource={examples.source}
      activeExampleId={example?.id ?? null}
      selectedTarget={selected}
      form={form}
      status={status}
      onLoadExample={loadExample}
      onChange={changeField}
      onToggleNotDone={toggleNotDone}
      onFillPlaceholders={fillStage}
      onReset={reset}
    />
  );
  const viewer = (
    <HeartViewer
      vessels={vessels}
      tokens={tokens}
      bands={schema.risk_bands}
      selected={selected === overall.name ? null : selected}
      onSelectVessel={setSelected}
      onSelectHeart={() => setSelected(overall.name)}
    />
  );
  const results = (
    <ResultsPanel
      targets={schema.targets}
      bands={schema.risk_bands}
      stages={ladder.stages}
      ladder={ladder}
      metrics={metrics}
      groups={schema.groups}
      features={schema.features}
      byStage={predictions.byStage}
      activeStage={status.activeStage}
      nextStepHint={nextStepHint(ladder.stages, status)}
      loading={predictions.loading}
      error={predictions.error}
      placeholders={current ? status.placeholders : 0}
      placeholderNames={placeholderNames}
      example={example}
      selected={selected}
      colorOf={colorOf}
      onSelect={setSelected}
    />
  );

  if (isDesktop) {
    return (
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="27%" minSize="20%" collapsible>
          {patient}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="41%" minSize="26%">
          {viewer}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="32%" minSize="24%" collapsible>
          {results}
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }
  const overallEstimate = current?.[overall.name];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">{viewer}</div>
      <div className="grid shrink-0 grid-cols-2 gap-2 border-t p-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">
              <ClipboardList /> Patient
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-full gap-0 p-0 sm:max-w-md">
            <SheetHeader className="sr-only">
              <SheetTitle>Patient</SheetTitle>
              <SheetDescription>Example patients and the test ladder</SheetDescription>
            </SheetHeader>
            {patient}
          </SheetContent>
        </Sheet>
        <Sheet>
          <SheetTrigger asChild>
            <Button>Results{overallEstimate ? ` · CAD ${formatPercent(overallEstimate.probability)}` : ""}</Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
            <SheetHeader className="sr-only">
              <SheetTitle>Results</SheetTitle>
              <SheetDescription>Prediction, explanation and model performance</SheetDescription>
            </SheetHeader>
            {results}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="grid h-full gap-px lg:grid-cols-[27%_1fr_32%]" aria-busy="true" aria-label="Loading">
      <Skeleton className="hidden h-full rounded-none lg:block" />
      <Skeleton className="h-full rounded-none" />
      <Skeleton className="hidden h-full rounded-none lg:block" />
    </div>
  );
}

/** App shell: header, disclaimer strip, the three-zone workspace (or its loading / error state), footer. */
export function Dashboard() {
  const { state, retry } = useDashboardData();
  const disclaimer = state.status === "ready" ? state.data.schema.disclaimer : FALLBACK_DISCLAIMER;

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader status={state.status} />
      <DisclaimerStrip text={disclaimer} />
      <main className="min-h-0 flex-1">
        {state.status === "loading" && <LoadingShell />}
        {state.status === "error" && (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ServerCrash />
              </EmptyMedia>
              <EmptyTitle>The prediction API is not reachable</EmptyTitle>
              <EmptyDescription>
                {state.message} Start it with <code className="font-mono">make serve</code> in the repository root.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={retry}>Retry</Button>
            </EmptyContent>
          </Empty>
        )}
        {state.status === "ready" && <Workspace data={state.data} />}
      </main>
      <footer className="shrink-0 border-t px-4 py-1.5 text-xs text-muted-foreground lg:px-6">
        {APP_NAME} is a hackathon prototype for decision support and education. It is not a medical device and must not
        replace coronary angiography, CT or a clinician&apos;s judgement. Data: Z-Alizadeh Sani extension (303 patients).{" "}
        {HEART_MODEL_CREDIT}.
      </footer>
    </div>
  );
}
