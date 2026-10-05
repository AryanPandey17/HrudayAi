"use client";

import { useState } from "react";

import { Panel } from "@/components/ui/Panel";
import { formatPoints } from "@/lib/risk";
import type { Contribution, Feature, FeatureGroup, TargetPrediction } from "@/lib/types";

interface MeasurementsTableProps {
  groups: FeatureGroup[];
  features: Feature[];
  selected: string;
  prediction: TargetPrediction | null;
  /** Names of inputs currently holding a typical placeholder value. */
  placeholderNames: ReadonlySet<string>;
}

/** Diverging bar centred on zero, scaled to the largest contribution in view. */
function ImpactBar({ impact, scale }: { impact: number; scale: number }) {
  const width = scale > 0 ? (Math.abs(impact) / scale) * 50 : 0;
  const raises = impact >= 0;
  return (
    <span className="relative block h-2 w-full rounded-full bg-surface-2" aria-hidden>
      <span className="absolute left-1/2 top-0 h-full w-px bg-muted" />
      <span
        className={`absolute top-0 h-full rounded-full ${raises ? "bg-raise" : "bg-lower"}`}
        style={{ width: `${width}%`, left: raises ? "50%" : `${50 - width}%` }}
      />
    </span>
  );
}

/** Every physiological measurement with its contribution to the selected target. */
export function MeasurementsTable({ groups, features, selected, prediction, placeholderNames }: MeasurementsTableProps) {
  const [group, setGroup] = useState("all");
  const groupOf = new Map(features.map((feature) => [feature.name, feature.group]));
  const rows: Contribution[] = (prediction?.contributions ?? []).filter(
    (contribution) => group === "all" || groupOf.get(contribution.feature) === group,
  );
  const scale = Math.max(0, ...(prediction?.contributions ?? []).map((c) => Math.abs(c.probability_impact)));

  return (
    <Panel
      title="Patient measurements"
      subtitle={`All ${features.length} model inputs and their contribution to ${selected}, largest first.`}
      actions={
        <select
          aria-label="Filter by group"
          value={group}
          onChange={(event) => setGroup(event.target.value)}
          className="h-7 rounded-md border border-border bg-bg px-2 text-xs"
        >
          <option value="all">All groups</option>
          {groups.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      }
    >
      {!prediction ? (
        <p className="grid h-48 place-items-center text-sm text-muted">No patient loaded yet.</p>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="py-1.5 pr-2 font-semibold">Measurement</th>
                <th className="py-1.5 pr-2 font-semibold">Value</th>
                <th className="w-[24%] py-1.5 pr-2 font-semibold">Contribution</th>
                <th className="py-1.5 text-right font-semibold">pp</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.feature} className="border-t border-border">
                  <td className="py-1.5 pr-2 font-medium">{row.label}</td>
                  <td className="whitespace-nowrap py-1.5 pr-2 tabular-nums">
                    {row.display_value}
                    {placeholderNames.has(row.feature) && <span className="ml-1 text-[10px] font-semibold uppercase text-warn-fg">placeholder</span>}
                  </td>
                  <td className="py-1.5 pr-2">
                    <ImpactBar impact={row.probability_impact} scale={scale} />
                  </td>
                  <td className={`whitespace-nowrap py-1.5 text-right font-mono tabular-nums ${row.probability_impact >= 0 ? "text-raise" : "text-lower"}`}>
                    {formatPoints(row.probability_impact)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
