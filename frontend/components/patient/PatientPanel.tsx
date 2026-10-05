import { Panel } from "@/components/ui/Panel";
import type { FormState, FormStatus } from "@/lib/form";
import type { ExamplePatient, Feature, FeatureGroup, FieldError, Target } from "@/lib/types";

import { ExamplePicker } from "./ExamplePicker";
import { FeatureField } from "./FeatureField";

interface PatientPanelProps {
  groups: FeatureGroup[];
  inputs: Feature[];
  targets: Target[];
  examples: ExamplePatient[];
  exampleSource: string;
  activeExampleId: string | null;
  form: FormState;
  status: FormStatus;
  serverErrors: FieldError[];
  onLoadExample: (example: ExamplePatient) => void;
  onChange: (name: string, text: string) => void;
  onFillPlaceholders: () => void;
  onReset: () => void;
}

function statusLine({ missing, invalid, placeholders }: FormStatus): string {
  if (invalid) return `${invalid} value${invalid > 1 ? "s" : ""} out of range`;
  if (missing) return `${missing} field${missing > 1 ? "s" : ""} still empty - predictions need all of them`;
  if (placeholders) return `Complete · ${placeholders} placeholder value${placeholders > 1 ? "s" : ""} (not patient data)`;
  return "Complete · predictions update as you edit";
}

/** Patient input: example patients first, then the schema-generated manual form. */
export function PatientPanel(props: PatientPanelProps) {
  const { groups, inputs, form, status, serverErrors } = props;
  const filled = (group: string) => inputs.filter((f) => f.group === group && form[f.name]?.text).length;
  const warn = status.missing > 0 || status.invalid > 0 || status.placeholders > 0;

  return (
    <Panel title="Patient" subtitle="Start from a real example patient, then adjust any value.">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">1 · Load an example patient</h3>
      <ExamplePicker examples={props.examples} targets={props.targets} activeId={props.activeExampleId} onLoad={props.onLoadExample} />
      <p className="mt-1.5 text-[11px] text-muted">{props.exampleSource}.</p>

      <div className="mb-2 mt-5 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">2 · Review or enter values</h3>
        <button type="button" onClick={props.onReset} className="text-xs font-medium text-muted underline-offset-2 hover:text-fg hover:underline">
          Reset
        </button>
      </div>
      <p role="status" className={`mb-2 rounded-md border px-2.5 py-1.5 text-xs ${warn ? "border-warn-border bg-warn-bg text-warn-fg" : "border-border bg-surface-2 text-muted"}`}>
        {statusLine(status)}
      </p>
      {status.missing > 0 && (
        <button
          type="button"
          onClick={props.onFillPlaceholders}
          className="mb-3 w-full rounded-md border border-dashed border-warn-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
        >
          Fill {status.missing} empty field{status.missing > 1 ? "s" : ""} with typical placeholder values
        </button>
      )}
      {serverErrors.length > 0 && (
        <ul className="mb-3 list-inside list-disc rounded-md border border-red-500/50 px-2.5 py-1.5 text-xs text-red-500">
          {serverErrors.map((error) => (
            <li key={error.field}>
              {error.field}: {error.message}
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2">
        {groups.map((group, index) => {
          const fields = inputs.filter((feature) => feature.group === group.id);
          return (
            <details key={group.id} open={index === 0} className="group rounded-lg border border-border">
              <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-medium">
                {group.label}
                <span className="font-mono text-xs tabular-nums text-muted">
                  {filled(group.id)}/{fields.length}
                </span>
              </summary>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-border p-3">
                {fields.map((feature) => (
                  <FeatureField key={feature.name} feature={feature} field={form[feature.name]} onChange={props.onChange} />
                ))}
              </div>
            </details>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-muted">BMI and obesity are computed from weight and height.</p>
    </Panel>
  );
}
