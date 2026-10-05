import { NEUTRAL_COLOR, RISK_GRADIENT } from "@/lib/risk";
import type { RiskBand } from "@/lib/types";

/** Colour scale for vessel probabilities, with the display-only band boundaries marked. */
export function RiskLegend({ bands }: { bands: RiskBand[] }) {
  return (
    <div className="text-[11px] text-muted">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-semibold text-fg">Predicted stenosis probability</span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full" style={{ background: NEUTRAL_COLOR }} /> no prediction yet
        </span>
      </div>
      <div className="relative h-2.5 rounded-full" style={{ background: RISK_GRADIENT }}>
        {bands.slice(1).map((band) => (
          <span key={band.id} className="absolute -top-0.5 h-3.5 w-px bg-fg" style={{ left: `${band.min * 100}%` }} />
        ))}
      </div>
      <div className="mt-1 flex font-mono tabular-nums">
        {bands.map((band, index) => {
          const end = bands[index + 1]?.min ?? 1;
          return (
            <span key={band.id} className="text-center" style={{ width: `${(end - band.min) * 100}%` }}>
              <span className="font-sans font-medium text-fg">{band.label}</span> {Math.round(band.min * 100)}-{Math.round(end * 100)}%
            </span>
          );
        })}
      </div>
      <p className="mt-1.5 leading-snug">
        Low / Moderate / High are display bands for colouring only, not clinical risk categories. The predicted label
        (Stenotic / Normal) comes from each model&apos;s own tuned threshold, shown on its card.
      </p>
    </div>
  );
}
