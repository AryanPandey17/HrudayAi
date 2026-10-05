import type { ExamplePatient, Feature, Scalar } from "./types";

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

export function formFromExample(example: ExamplePatient, inputs: Feature[]): FormState {
  return Object.fromEntries(
    inputs.map((feature) => [
      feature.name,
      { text: encode(feature, example.features[feature.name]), source: "example" as const },
    ]),
  );
}

/** Fill every empty field with the feature's typical (training median / mode) value. */
export function fillPlaceholders(form: FormState, inputs: Feature[]): FormState {
  const filled = { ...form };
  for (const feature of inputs) {
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
    return `Must be ${feature.min}-${feature.max}${feature.unit ? ` ${feature.unit}` : ""}`;
  }
  return null;
}

export interface FormStatus {
  /** API payload when every field is filled and valid, otherwise null. */
  payload: Record<string, Scalar> | null;
  missing: number;
  invalid: number;
  placeholders: number;
}

export function formStatus(form: FormState, inputs: Feature[]): FormStatus {
  const payload: Record<string, Scalar> = {};
  let missing = 0;
  let invalid = 0;
  let placeholders = 0;
  for (const feature of inputs) {
    const field = form[feature.name];
    if (!field?.text) missing += 1;
    else if (fieldError(feature, field.text)) invalid += 1;
    else {
      payload[feature.name] =
        feature.type === "numeric" ? Number(field.text) : feature.options[Number(field.text)].value;
      if (field.source === "placeholder") placeholders += 1;
    }
  }
  const complete = missing === 0 && invalid === 0;
  return { payload: complete ? payload : null, missing, invalid, placeholders };
}
