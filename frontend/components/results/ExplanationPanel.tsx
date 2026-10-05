"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Panel } from "@/components/ui/Panel";
import { ReliabilityChip } from "@/components/ui/ReliabilityChip";
import type { Reliability } from "@/lib/reliability";
import { formatPercent, formatPoints } from "@/lib/risk";
import type { Contribution, Target, TargetPrediction } from "@/lib/types";

const MAX_BARS = 10;
const ROW_HEIGHT = 30;

interface ExplanationPanelProps {
  targets: Target[];
  selected: string;
  prediction: TargetPrediction | null;
  reliability: Reliability | null;
  onSelect: (target: string) => void;
}

interface Row {
  name: string;
  points: number;
  text: string;
  contribution: Contribution;
}

function toRows(prediction: TargetPrediction): Row[] {
  return prediction.contributions.slice(0, MAX_BARS).map((contribution) => ({
    name: `${contribution.label}: ${contribution.display_value}`,
    points: contribution.probability_impact * 100,
    text: formatPoints(contribution.probability_impact),
    contribution,
  }));
}

function ContributionTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const { contribution } = payload[0].payload;
  const raises = contribution.shap_value > 0;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{contribution.label}</p>
      <p className="text-muted">Value: {contribution.display_value}</p>
      <p>
        {raises ? "Raises" : "Lowers"} the probability by {formatPoints(Math.abs(contribution.probability_impact)).slice(1)}
      </p>
      <p className="text-muted">SHAP {contribution.shap_value.toFixed(3)} (log-odds)</p>
    </div>
  );
}

/** Why the selected target got its probability: top SHAP contributions as a diverging bar chart. */
export function ExplanationPanel({ targets, selected, prediction, reliability, onSelect }: ExplanationPanelProps) {
  const rows = prediction ? toRows(prediction) : [];
  const [topRaise] = prediction?.top_positive ?? [];
  const [topLower] = prediction?.top_negative ?? [];

  return (
    <Panel
      title="Why this prediction?"
      subtitle="Largest feature contributions (SHAP) for the selected target."
      actions={
        <div role="tablist" aria-label="Target to explain" className="flex overflow-hidden rounded-md border border-border text-xs font-semibold">
          {targets.map((target) => (
            <button
              key={target.name}
              type="button"
              role="tab"
              aria-selected={target.name === selected}
              onClick={() => onSelect(target.name)}
              className={`px-2.5 py-1 ${target.name === selected ? "bg-accent text-accent-fg" : "bg-surface text-muted hover:text-fg"}`}
            >
              {target.name}
            </button>
          ))}
        </div>
      }
    >
      {!prediction ? (
        <p className="grid h-48 place-items-center text-sm text-muted">Load an example patient to see the explanation.</p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span>
              <strong>{selected}</strong> probability{" "}
              <strong className="tabular-nums">{formatPercent(prediction.probability, 1)}</strong>
              <span className="text-muted"> vs {formatPercent(prediction.base_probability, 1)} for the average training patient</span>
            </span>
            <ReliabilityChip reliability={reliability} />
          </div>
          <div className="mb-1 flex gap-4 text-[11px] font-medium">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-raise" /> ▶ raises probability</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-lower" /> ◀ lowers probability</span>
          </div>
          <div style={{ height: rows.length * ROW_HEIGHT + 36 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 76, bottom: 0, left: 4 }} barCategoryGap={6}>
                <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted)" }} tickFormatter={(value: number) => `${value > 0 ? "+" : ""}${value}`} stroke="var(--border)" />
                <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 11, fill: "var(--fg)" }} stroke="var(--border)" interval={0} />
                <Tooltip content={<ContributionTooltip />} cursor={{ fill: "var(--surface-2)" }} />
                <ReferenceLine x={0} stroke="var(--fg)" />
                <Bar dataKey="points" isAnimationActive={false} radius={2}>
                  {rows.map((row) => (
                    <Cell key={row.name} fill={row.points >= 0 ? "var(--raise)" : "var(--lower)"} />
                  ))}
                  <LabelList dataKey="text" position="right" style={{ fontSize: 11, fill: "var(--fg)", fontFamily: "var(--font-mono)" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted">
            {topRaise && <>Biggest upward factor: <strong className="text-fg">{topRaise.label}</strong> ({formatPoints(topRaise.probability_impact)}). </>}
            {topLower && <>Biggest downward factor: <strong className="text-fg">{topLower.label}</strong> ({formatPoints(topLower.probability_impact)}). </>}
            Bars are in percentage points (pp): exact SHAP values in log-odds, rescaled so all contributions sum to the
            difference from the average patient. They describe the model, not cause and effect.
          </p>
        </>
      )}
    </Panel>
  );
}
