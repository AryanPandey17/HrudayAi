"use client";

import { useMemo, useState } from "react";

import { type DashboardData, useDashboardData } from "@/hooks/useDashboardData";
import { usePrediction } from "@/hooks/usePrediction";
import { fillPlaceholders, formFromExample, type FormState, formStatus } from "@/lib/form";
import { reliabilityOf } from "@/lib/reliability";
import { formatPercent, NEUTRAL_COLOR, riskColor } from "@/lib/risk";
import type { ExamplePatient } from "@/lib/types";

import { DisclaimerBanner, FALLBACK_DISCLAIMER } from "./DisclaimerBanner";
import { Header } from "./Header";
import { HeartViewer } from "./heart/HeartViewer";
import type { VesselState } from "./heart/HeartScene";
import { PatientPanel } from "./patient/PatientPanel";
import { ExplanationPanel } from "./results/ExplanationPanel";
import { MeasurementsTable } from "./results/MeasurementsTable";
import { MetricsPanel } from "./results/MetricsPanel";
import { PredictionSummary, type TargetView } from "./results/PredictionSummary";

function Workspace({ data }: { data: DashboardData }) {
  const { schema, examples, metrics } = data;
  const inputs = useMemo(() => schema.features.filter((feature) => !feature.derived), [schema]);
  const overall = schema.targets.find((target) => target.scope === "overall") ?? schema.targets[0];
  const highBand = schema.risk_bands[schema.risk_bands.length - 1].id;

  const [form, setForm] = useState<FormState>({});
  const [example, setExample] = useState<ExamplePatient | null>(null);
  const [selected, setSelected] = useState(overall.name);

  const status = useMemo(() => formStatus(form, inputs), [form, inputs]);
  const prediction = usePrediction(status.payload);
  const results = prediction.result?.predictions ?? null;

  const loadExample = (next: ExamplePatient) => {
    setForm(formFromExample(next, inputs));
    setExample(next);
  };
  const changeField = (name: string, text: string) => {
    setForm((current) => ({ ...current, [name]: { text, source: "patient" } }));
    setExample(null);
  };
  const reset = () => {
    setForm({});
    setExample(null);
    setSelected(overall.name);
  };

  const views: TargetView[] = schema.targets.map((target) => ({
    target,
    prediction: results?.[target.name] ?? null,
    reliability: reliabilityOf(metrics, target.name),
    actual: example?.actual[target.name] ?? null,
  }));
  const vessels: Record<string, VesselState> = Object.fromEntries(
    views
      .filter(({ target }) => target.scope === "vessel")
      .map(({ target, prediction: p }) => [
        target.name,
        {
          color: p ? riskColor(p.probability) : NEUTRAL_COLOR,
          valueLabel: p ? formatPercent(p.probability) : null,
          pulsing: p?.risk_band === highBand,
        },
      ]),
  );
  const placeholderNames = new Set(inputs.filter((f) => form[f.name]?.source === "placeholder").map((f) => f.name));
  const selectedView = views.find(({ target }) => target.name === selected) ?? views[0];

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[340px_minmax(0,1fr)_350px]">
        <div className="order-2 xl:order-1">
          <PatientPanel
            groups={schema.groups}
            inputs={inputs}
            targets={schema.targets}
            examples={examples.examples}
            exampleSource={examples.source}
            activeExampleId={example?.id ?? null}
            form={form}
            status={status}
            serverErrors={prediction.fieldErrors}
            onLoadExample={loadExample}
            onChange={changeField}
            onFillPlaceholders={() => setForm((current) => fillPlaceholders(current, inputs))}
            onReset={reset}
          />
        </div>
        <div className="order-1 flex flex-col gap-4 xl:order-2">
          <HeartViewer
            vessels={vessels}
            bands={schema.risk_bands}
            selected={selected === overall.name ? null : selected}
            onSelectVessel={setSelected}
            onSelectHeart={() => setSelected(overall.name)}
          />
          {prediction.error && (
            <p role="alert" className="rounded-lg border border-red-500/50 px-3 py-2 text-sm text-red-500">
              Prediction failed: {prediction.error}
            </p>
          )}
          <ExplanationPanel
            targets={schema.targets}
            selected={selected}
            prediction={selectedView.prediction}
            reliability={selectedView.reliability}
            onSelect={setSelected}
          />
        </div>
        <div className="order-3 flex flex-col gap-4">
          <PredictionSummary
            views={views}
            bands={schema.risk_bands}
            selected={selected}
            loading={prediction.loading}
            placeholders={results ? status.placeholders : 0}
            onSelect={setSelected}
          />
          <MeasurementsTable
            groups={schema.groups}
            features={schema.features}
            selected={selected}
            prediction={selectedView.prediction}
            placeholderNames={placeholderNames}
          />
        </div>
      </div>
      <div className="mt-4">
        <MetricsPanel metrics={metrics} selected={selected} />
      </div>
    </>
  );
}

/** Page shell: disclaimer, header, data loading / error states, and the workspace. */
export function Dashboard() {
  const { state, retry } = useDashboardData();
  const disclaimer = state.status === "ready" ? state.data.schema.disclaimer : FALLBACK_DISCLAIMER;

  return (
    <div className="flex min-h-screen flex-col">
      <DisclaimerBanner text={disclaimer} />
      <Header status={state.status} />
      <main className="mx-auto w-full max-w-[1680px] flex-1 px-4 pb-6 sm:px-6">
        {state.status === "loading" && <p className="grid h-64 place-items-center text-sm text-muted">Loading schema, examples and metrics…</p>}
        {state.status === "error" && (
          <div role="alert" className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-surface p-6 text-center">
            <h2 className="font-semibold">The prediction API is not reachable</h2>
            <p className="mt-2 text-sm text-muted">{state.message}</p>
            <p className="mt-2 text-xs text-muted">Start it with <code className="font-mono">make serve</code> in the repo root.</p>
            <button type="button" onClick={retry} className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
              Retry
            </button>
          </div>
        )}
        {state.status === "ready" && <Workspace data={state.data} />}
      </main>
      <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted sm:px-6">
        CardioVis 3D is a hackathon prototype for decision support and education. It is not a medical device, has not been
        clinically validated, and must not replace coronary angiography, CT or a clinician&apos;s judgement. Data:
        Z-Alizadeh Sani extension dataset (303 patients). Heart model: procedural, stylised geometry.
      </footer>
    </div>
  );
}
