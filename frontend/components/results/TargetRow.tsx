import { BandBadge, PredictedLabelBadge, ReliabilityBadge } from "@/components/shared/badges";
import { Badge } from "@/components/ui/badge";
import { formatPercent } from "@/lib/risk";
import type { RiskBand, Target, TargetPrediction } from "@/lib/types";

interface TargetRowProps {
  target: Target;
  prediction: TargetPrediction | null;
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
    <div className="mt-3" aria-hidden>
      <div className="relative h-2 rounded-full bg-muted">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: percent(probability), background: color }} />
        <span className="absolute -top-1 h-4 w-0.5 rounded-full bg-foreground" style={{ left: percent(threshold) }} />
      </div>
      <div className="relative mt-1 h-1">
        <span
          className="absolute h-0.5 rounded-full bg-foreground/60"
          style={{ left: percent(interval.low), width: percent(interval.high - interval.low) }}
        />
      </div>
    </div>
  );
}

/** One target: probability, interval, predicted label, band and reliability, all as text. */
export function TargetRow({ target, prediction, bands, color, selected, actual, onSelect }: TargetRowProps) {
  const overall = target.scope === "overall";
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 ${
        selected ? "border-foreground" : "border-border"
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-start gap-2.5">
          <span className="mt-1 h-9 w-1 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{overall ? "Overall CAD" : target.name}</span>
            <span className="block text-xs text-muted-foreground">{target.description}</span>
          </span>
        </span>
        <span className="text-right">
          <span className={`block font-mono font-semibold leading-none tabular-nums ${overall ? "text-[40px]" : "text-[32px]"}`}>
            {prediction ? formatPercent(prediction.probability) : "–"}
          </span>
          {prediction && (
            <span className="mt-1 block font-mono text-xs tabular-nums text-muted-foreground">
              {formatPercent(prediction.interval.low)} to {formatPercent(prediction.interval.high)}
            </span>
          )}
        </span>
      </span>
      {prediction ? (
        <>
          <ProbabilityBar prediction={prediction} color={color} />
          <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <PredictedLabelBadge prediction={prediction} />
            <BandBadge bandId={prediction.risk_band} bands={bands} />
            <ReliabilityBadge metrics={prediction.stage_metrics} />
          </span>
          <span className="mt-2 block text-xs text-muted-foreground">
            Label threshold {formatPercent(prediction.threshold)}
            {actual && (
              <>
                {" "}
                · angiography in dataset: <span className="font-medium text-foreground">{actual}</span>{" "}
                {actual === prediction.label ? "(matches)" : "(differs)"}
              </>
            )}
          </span>
        </>
      ) : (
        <Badge variant="outline" className="mt-3">
          No estimate yet
        </Badge>
      )}
    </button>
  );
}
