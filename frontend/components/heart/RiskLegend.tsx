import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { riskGradient } from "@/lib/risk";
import type { RiskBand } from "@/lib/types";

interface RiskLegendProps {
  bands: RiskBand[];
  steps: string[];
  idleColor: string;
}

/** Colour scale for vessel probabilities, with the display-only band boundaries marked. */
export function RiskLegend({ bands, steps, idleColor }: RiskLegendProps) {
  return (
    <div className="text-xs text-muted-foreground">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
          Predicted stenosis probability
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label="About the colour scale" className="rounded-full text-muted-foreground">
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-72">
              One hue, ordered by lightness: the further a vessel&apos;s colour is from the heart&apos;s, the higher the
              estimate. Low, Moderate and High are display bands, not clinical categories. A vessel is drawn more
              translucent when its range is wide or its model is tagged lower reliability.
            </TooltipContent>
          </Tooltip>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: idleColor }} aria-hidden /> No estimate yet
        </span>
      </div>
      <div className="relative h-1.5 rounded-full" style={{ background: riskGradient(steps) }}>
        {bands.slice(1).map((band) => (
          <span key={band.id} className="absolute -top-1 h-3.5 w-px bg-foreground" style={{ left: `${band.min * 100}%` }} />
        ))}
      </div>
      <div className="mt-1.5 flex">
        {bands.map((band, index) => {
          const end = bands[index + 1]?.min ?? 1;
          return (
            <span key={band.id} className="text-center" style={{ width: `${(end - band.min) * 100}%` }}>
              <span className="font-medium text-foreground">{band.label}</span>{" "}
              <span className="font-mono tabular-nums">
                {Math.round(band.min * 100)}-{Math.round(end * 100)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
