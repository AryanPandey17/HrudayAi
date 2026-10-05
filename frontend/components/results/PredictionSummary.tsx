import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { ReliabilityChip } from "@/components/ui/ReliabilityChip";
import type { Reliability } from "@/lib/reliability";
import { bandLabel, formatPercent, NEUTRAL_COLOR, riskColor } from "@/lib/risk";
import type { RiskBand, Target, TargetPrediction } from "@/lib/types";

export interface TargetView {
  target: Target;
  prediction: TargetPrediction | null;
  reliability: Reliability | null;
  /** Dataset angiography label, when an unmodified example patient is loaded. */
  actual: string | null;
}

interface PredictionSummaryProps {
  views: TargetView[];
  bands: RiskBand[];
  selected: string;
  loading: boolean;
  placeholders: number;
  onSelect: (target: string) => void;
}

/** Probability bar with the model's decision threshold marked. */
function ProbabilityBar({ probability, threshold, color }: { probability: number | null; threshold: number; color: string }) {
  return (
    <div className="relative mt-2 h-2 rounded-full bg-surface-2" aria-hidden>
      <div className="h-full rounded-full transition-[width,background-color] duration-500" style={{ width: `${(probability ?? 0) * 100}%`, background: color }} />
      <span className="absolute -top-1 h-4 w-0.5 bg-fg" style={{ left: `${threshold * 100}%` }} title={`Decision threshold ${formatPercent(threshold)}`} />
    </div>
  );
}

function TargetCard({ view, bands, selected, onSelect }: { view: TargetView; bands: RiskBand[]; selected: boolean; onSelect: () => void }) {
  const { target, prediction, reliability, actual } = view;
  const overall = target.scope === "overall";
  const color = prediction ? riskColor(prediction.probability) : NEUTRAL_COLOR;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded-lg border bg-surface-2 p-3 text-left transition-colors ${
        selected ? "border-accent ring-1 ring-accent" : "border-border hover:border-accent/60"
      }`}
      style={{ borderLeftColor: color, borderLeftWidth: 5 }}
    >
      <span className="flex items-start justify-between gap-2">
        <span>
          <span className={`font-semibold ${overall ? "text-base" : "text-sm"}`}>{overall ? "Overall CAD" : target.name}</span>
          <span className="block text-[11px] text-muted">{target.description}</span>
        </span>
        <span className={`font-mono font-semibold tabular-nums ${overall ? "text-3xl" : "text-2xl"}`}>
          {prediction ? formatPercent(prediction.probability) : "-"}
        </span>
      </span>
      <ProbabilityBar probability={prediction?.probability ?? null} threshold={target.threshold} color={color} />
      <span className="mt-2 flex flex-wrap items-center gap-1.5">
        {prediction ? (
          <>
            <Chip tone={prediction.positive ? "accent" : "neutral"}>
              <span aria-hidden>{prediction.positive ? "▲" : "○"}</span> Predicted: {prediction.label}
            </Chip>
            <Chip>
              <span className="size-2 rounded-full" style={{ background: color }} /> {bandLabel(prediction.risk_band, bands)} band
            </Chip>
          </>
        ) : (
          <Chip>No prediction yet</Chip>
        )}
        <ReliabilityChip reliability={reliability} />
      </span>
      <span className="mt-1.5 block text-[11px] text-muted">
        Label threshold {formatPercent(target.threshold)}
        {actual && prediction && (
          <>
            {" · "}angiography in dataset: <strong className="text-fg">{actual}</strong> {actual === prediction.label ? "(matches)" : "(differs)"}
          </>
        )}
      </span>
    </button>
  );
}

/** Overall CAD status plus one card per vessel; clicking a card selects that target everywhere. */
export function PredictionSummary({ views, bands, selected, loading, placeholders, onSelect }: PredictionSummaryProps) {
  return (
    <Panel
      title="Predictions"
      subtitle="Calibrated probabilities. Click a card to explain it and focus the 3D view."
      actions={loading ? <Chip>Updating…</Chip> : undefined}
    >
      <div className="grid gap-2.5">
        {views.map((view) => (
          <TargetCard key={view.target.name} view={view} bands={bands} selected={selected === view.target.name} onSelect={() => onSelect(view.target.name)} />
        ))}
      </div>
      {placeholders > 0 && (
        <p className="mt-3 rounded-md border border-warn-border bg-warn-bg px-2.5 py-1.5 text-xs text-warn-fg">
          {placeholders} input{placeholders > 1 ? "s are" : " is"} a typical placeholder value, not this patient&apos;s data.
        </p>
      )}
    </Panel>
  );
}
