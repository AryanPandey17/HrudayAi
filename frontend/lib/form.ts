import type { ExamplePatient, Feature, LadderStage, Scalar } from "./types";

/** Where a field's current value came from; placeholders are typical values, not patient data. */
export type FieldSource = "patient" | "example" | "placeholder";

export interface FieldState {
  /** Raw numeric text, or the index of the chosen option as a string. */
  text: string;
  source: FieldSource;
}

export type FormState = Record<string, FieldState>;

const optionIndex = (feature: Feature, value: Scalar) =>
  String(feature.options.findIndex((option) => option.value === value));

const encode = (feature: Feature, value: Scalar) =>
  feature.type === "numeric" ? String(value) : optionIndex(feature, value);

const decode = (feature: Feature, text: string): Scalar =>
  feature.type === "numeric" ? Number(text) : feature.options[Number(text)].value;

export function formFromExample(example: ExamplePatient, inputs: Feature[]): FormState {
  return Object.fromEntries(
    inputs.map((feature) => [
      feature.name,
      { text: encode(feature, example.features[feature.name]), source: "example" as const },
    ]),
  );
}

/** Fill the empty fields among `features` with their typical (training median / mode) value. */
export function fillPlaceholders(form: FormState, features: Feature[]): FormState {
  const filled = { ...form };
  for (const feature of features) {
    if (!filled[feature.name]?.text) {
      filled[feature.name] = { text: encode(feature, feature.default), source: "placeholder" };
    }
  }
  return filled;
}

/** Validation message for a non-empty field, or null when valid. */
export function fieldError(feature: Feature, text: string): string | null {
  if (feature.type !== "numeric") return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return "Enter a number";
  if (feature.min !== null && feature.max !== null && (value < feature.min || value > feature.max)) {
    return `Must be ${feature.min} to ${feature.max}${feature.unit ? ` ${feature.unit}` : ""}`;
  }
  return null;
}

export interface RungStatus {
  filled: number;
  total: number;
  invalid: number;
  placeholders: number;
  /** The user marked this test as not done. */
  notDone: boolean;
  /** All of this rung's own inputs are present and valid. */
  complete: boolean;
  /** Complete, not skipped, and every earlier rung is used too: its model can run. */
  used: boolean;
}

export interface LadderStatus {
  rungs: Record<number, RungStatus>;
  /** Highest stage whose model can run; 0 when even the first stage is incomplete. */
  activeStage: number;
  /** Placeholder values among the inputs of the stages in use. */
  placeholders: number;
}

/**
 * Per-rung completion and the highest usable stage. Stages are cumulative: a rung that is
 * incomplete or marked "not done" stops the ladder, and later rungs are not used.
 */
export function ladderStatus(
  form: FormState,
  inputs: Map<string, Feature>,
  stages: LadderStage[],
  notDone: ReadonlySet<number>,
): LadderStatus {
  const rungs: Record<number, RungStatus> = {};
  let activeStage = 0;
  let placeholders = 0;
  let chainIntact = true;
  for (const stage of stages) {
    const fields = stage.added_features.map((name) => ({ feature: inputs.get(name)!, state: form[name] }));
    const filled = fields.filter(({ state }) => state?.text).length;
    const invalid = fields.filter(({ feature, state }) => state?.text && fieldError(feature, state.text)).length;
    const rungPlaceholders = fields.filter(({ state }) => state?.source === "placeholder").length;
    const complete = filled === fields.length && invalid === 0;
    const used: boolean = chainIntact && complete && !notDone.has(stage.id);
    chainIntact = used;
    if (used) {
      activeStage = stage.id;
      placeholders += rungPlaceholders;
    }
    rungs[stage.id] = {
      filled,
      total: fields.length,
      invalid,
      placeholders: rungPlaceholders,
      notDone: notDone.has(stage.id),
      complete,
      used,
    };
  }
  return { rungs, activeStage, placeholders };
}

/** API payload holding exactly the inputs a stage requires. */
export function stagePayload(form: FormState, inputs: Map<string, Feature>, stage: LadderStage): Record<string, Scalar> {
  return Object.fromEntries(
    stage.required_features.map((name) => [name, decode(inputs.get(name)!, form[name].text)]),
  );
}
