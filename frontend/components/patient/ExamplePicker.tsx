import { formatPercent } from "@/lib/risk";
import type { ExamplePatient, Target } from "@/lib/types";

interface ExamplePickerProps {
  examples: ExamplePatient[];
  targets: Target[];
  activeId: string | null;
  onLoad: (example: ExamplePatient) => void;
}

/** Summary of the dataset's angiography labels, e.g. "CAD · LAD, RCA stenotic". */
function actualSummary(example: ExamplePatient, targets: Target[]): string {
  const overall = targets.find((target) => target.scope === "overall");
  const stenotic = targets
    .filter((target) => target.scope === "vessel" && example.actual[target.name] === target.positive_label)
    .map((target) => target.name);
  const vessels = stenotic.length ? `${stenotic.join(", ")} stenotic` : "no stenotic vessel";
  return `${overall ? example.actual[overall.name] : ""} · ${vessels}`;
}

/** Primary entry path: load one of the real held-out patients. */
export function ExamplePicker({ examples, targets, activeId, onLoad }: ExamplePickerProps) {
  return (
    <div className="grid gap-2">
      {examples.map((example) => {
        const active = example.id === activeId;
        return (
          <button
            key={example.id}
            type="button"
            aria-pressed={active}
            onClick={() => onLoad(example)}
            className={`rounded-lg border px-3 py-2 text-left transition-colors ${
              active ? "border-accent bg-accent/10" : "border-border bg-surface-2 hover:border-accent/60"
            }`}
          >
            <span className="flex items-center justify-between gap-2 text-sm font-semibold">
              {example.label}
              <span className="font-mono text-xs tabular-nums text-muted">CAD {formatPercent(example.predicted_cad_probability)}</span>
            </span>
            <span className="mt-0.5 block text-[11px] text-muted">
              Test patient #{example.dataset_row} · angiography: {actualSummary(example, targets)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
