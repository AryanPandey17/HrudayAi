"use client";

import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { LadderStage, PredictResponse, Target } from "@/lib/types";

interface LadderTrajectoryProps {
  targets: Target[];
  stages: LadderStage[];
  byStage: Record<number, PredictResponse>;
  selected: string;
  onSelect: (target: string) => void;
}

interface Point {
  stage: number;
  label: string;
  estimate?: number;
  range?: [number, number];
}

const CONFIG = {
  estimate: { label: "Estimate", color: "var(--foreground)" },
  range: { label: "Interval", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

function TrajectoryTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  const point = payload?.[0]?.payload;
  if (!active || !point?.range || point.estimate === undefined) return null;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-sm">
      <p className="font-medium">
        Step {point.stage}: {point.label}
      </p>
      <p className="font-mono tabular-nums">
        {point.estimate.toFixed(0)}% ({point.range[0].toFixed(0)} to {point.range[1].toFixed(0)})
      </p>
    </div>
  );
}

/** Small multiples: each target's estimate and interval at every step used so far. */
export function LadderTrajectory({ targets, stages, byStage, selected, onSelect }: LadderTrajectoryProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {targets.map((target) => {
        const data: Point[] = stages.map((stage) => {
          const prediction = byStage[stage.id]?.predictions[target.name];
          return {
            stage: stage.id,
            label: stage.label,
            estimate: prediction && prediction.probability * 100,
            range: prediction && [prediction.interval.low * 100, prediction.interval.high * 100],
          };
        });
        return (
          <button
            key={target.name}
            type="button"
            aria-pressed={target.name === selected}
            aria-label={`${target.name} estimate by step`}
            onClick={() => onSelect(target.name)}
            className={`rounded-lg border p-2 text-left ${target.name === selected ? "border-foreground" : "border-border"}`}
          >
            <span className="px-1 text-[13px] font-medium">{target.name}</span>
            <ChartContainer config={CONFIG} className="aspect-auto h-24 w-full">
              <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="stage" type="number" domain={[1, stages.length]} ticks={stages.map((s) => s.id)} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis domain={[0, 100]} ticks={[0, 50, 100]} width={30} tickLine={false} axisLine={false} fontSize={12} />
                <ChartTooltip content={<TrajectoryTooltip />} />
                <Area dataKey="range" type="linear" stroke="none" fill="var(--color-range)" fillOpacity={0.22} isAnimationActive={false} />
                <Line dataKey="estimate" type="linear" stroke="var(--color-estimate)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-estimate)" }} isAnimationActive={false} />
              </ComposedChart>
            </ChartContainer>
          </button>
        );
      })}
    </div>
  );
}
