import { fieldError, type FieldState } from "@/lib/form";
import type { Feature } from "@/lib/types";

interface FeatureFieldProps {
  feature: Feature;
  field: FieldState | undefined;
  onChange: (name: string, text: string) => void;
}

const INPUT =
  "h-8 w-full rounded-md border bg-bg px-2 text-sm tabular-nums placeholder:text-muted/70 focus-visible:outline-2";

/** One schema-driven input: number box, yes/no segmented control, or select. */
export function FeatureField({ feature, field, onChange }: FeatureFieldProps) {
  const text = field?.text ?? "";
  const error = text ? fieldError(feature, text) : null;
  const isPlaceholder = field?.source === "placeholder";
  const border = error ? "border-red-500" : isPlaceholder ? "border-dashed border-warn-border" : "border-border";
  const id = `feature-${feature.name}`;
  const typical =
    feature.type === "numeric" ? String(feature.default) : feature.options.find((o) => o.value === feature.default)?.label;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="truncate text-xs font-medium" title={feature.description ?? feature.label}>
          {feature.label}
          {feature.unit && <span className="ml-1 font-normal text-muted">({feature.unit})</span>}
        </label>
        {isPlaceholder && <span className="shrink-0 text-[10px] font-semibold uppercase text-warn-fg">placeholder</span>}
      </div>
      {feature.type === "numeric" ? (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={feature.min ?? undefined}
          max={feature.max ?? undefined}
          step={feature.step ?? "any"}
          value={text}
          placeholder={`typical ${typical}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(feature.name, event.target.value)}
          className={`${INPUT} ${border}`}
        />
      ) : feature.type === "binary" ? (
        <div id={id} role="radiogroup" aria-label={feature.label} className={`grid h-8 grid-cols-2 overflow-hidden rounded-md border ${border}`}>
          {feature.options.map((option, index) => {
            const active = text === String(index);
            return (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(feature.name, String(index))}
                className={`text-xs font-medium ${active ? "bg-accent text-accent-fg" : "bg-bg text-muted hover:text-fg"}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : (
        <select id={id} value={text} onChange={(event) => onChange(feature.name, event.target.value)} className={`${INPUT} ${border}`}>
          <option value="">typical {typical}</option>
          {feature.options.map((option, index) => (
            <option key={option.label} value={index}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-[11px] text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
