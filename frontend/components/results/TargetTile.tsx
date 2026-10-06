import { PredictedLabelBadge, ReliabilityBadge } from "@/components/shared/badges";
import { bandLabel, formatPercent } from "@/lib/risk";
import type { RiskBand, Target, TargetPrediction } from "@/lib/types";

interface TargetTileProps {
  target: Target;
  prediction: TargetPrediction;
  bands: RiskBand[];
  color: string;
  selected: boolean;
  /** Dataset angiography label, when an unmodified example patient is loaded. */
  actual: string | null;
  onSelect: () => void;
}

const percent = (value: number) => `${(value * 100).toFixed(0)}%`;

/** Probability bar with the bootstrap interval drawn under it and the decision threshold marked. */
function ProbabilityBar({ prediction, color }: { prediction: TargetPrediction; color: string }) {
  const { probability, interval, threshold } = prediction;
  return (
    <span className="mt-2.5 block" aria-hidden>
      <span className="relative block h-1.5 rounded-full bg-foreground/10">
        <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: percent(probability), background: color }} />
        <span className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-foreground" style={{ left: percent(threshold) }} />
      </span>
      <span className="relative mt-1 block h-0.5">
        <span
          className="absolute h-0.5 rounded-full bg-foreground/50"
          style={{ left: percent(interval.low), width: percent(interval.high - interval.low) }}
        />
      </span>
    </span>
  );
}

/** One target as a tile: uppercase label, large probability, interval, label and reliability. */
export function TargetTile({ target, prediction, bands, color, selected, actual, onSelect }: TargetTileProps) {
  const overall = target.scope === "overall";
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded-lg border bg-muted/50 px-4 py-3 text-left transition-colors hover:bg-muted ${
        selected ? "border-foreground" : "border-transparent"
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {overall ? "Overall CAD" : `${target.name} · ${target.description.replace(" stenosis", "")}`}
        </span>
        <ReliabilityBadge metrics={prediction.stage_metrics} />
      </span>
      <span className="mt-1.5 flex items-end justify-between gap-3">
        <span className={`font-semibold leading-none tracking-tight tabular-nums ${overall ? "text-[40px]" : "text-[32px]"}`}>
          {formatPercent(prediction.probability)}
        </span>
        <PredictedLabelBadge prediction={prediction} />
      </span>
      <ProbabilityBar prediction={prediction} color={color} />
      <span className="mt-1.5 block text-xs text-muted-foreground">
        Range{" "}
        <span className="font-mono tabular-nums">
          {formatPercent(prediction.interval.low)} to {formatPercent(prediction.interval.high)}
        </span>
        {" · "}
        {bandLabel(prediction.risk_band, bands)} band · threshold {formatPercent(prediction.threshold)}
        {actual && (
          <>
            {" · "}angiography: <span className="font-medium text-foreground">{actual}</span>{" "}
            {actual === prediction.label ? "(matches)" : "(differs)"}
          </>
        )}
      </span>
    </button>
  );
}
