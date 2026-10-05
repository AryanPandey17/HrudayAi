/** Types mirroring the backend API contract (see backend/api/schemas.py). */

export type Scalar = string | number;
export type FeatureKind = "numeric" | "binary" | "ordinal" | "categorical";

export interface FeatureOption {
  value: Scalar;
  label: string;
}

export interface Feature {
  name: string;
  label: string;
  group: string;
  type: FeatureKind;
  unit: string | null;
  min: number | null;
  max: number | null;
  step: number | null;
  options: FeatureOption[];
  description: string | null;
  derived: boolean;
  default: Scalar;
}

export interface FeatureGroup {
  id: string;
  label: string;
}

export interface Target {
  name: string;
  description: string;
  scope: "overall" | "vessel";
  positive_label: string;
  negative_label: string;
  model: string;
  threshold: number;
}

export interface RiskBand {
  id: string;
  label: string;
  min: number;
}

export interface SchemaResponse {
  groups: FeatureGroup[];
  features: Feature[];
  targets: Target[];
  risk_bands: RiskBand[];
  disclaimer: string;
}

export interface Contribution {
  feature: string;
  label: string;
  value: Scalar;
  display_value: string;
  shap_value: number;
  probability_impact: number;
}

export interface TargetPrediction {
  probability: number;
  positive: boolean;
  label: string;
  threshold: number;
  risk_band: string;
  base_probability: number;
  shap_space: string;
  contributions: Contribution[];
  top_positive: Contribution[];
  top_negative: Contribution[];
}

export interface PredictResponse {
  predictions: Record<string, TargetPrediction>;
  features: Record<string, Scalar>;
  disclaimer: string;
}

export interface ExamplePatient {
  id: string;
  label: string;
  dataset_row: number;
  features: Record<string, Scalar>;
  actual: Record<string, string>;
  predicted_cad_probability: number;
}

export interface ExamplesResponse {
  source: string;
  examples: ExamplePatient[];
}

export interface MeanStd {
  mean: number;
  std: number;
}

export interface ThresholdMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  specificity: number;
  f1: number;
  roc_auc: number;
  brier: number;
}

export interface TargetMetrics {
  description: string;
  prevalence: { train: number; test: number };
  calibration_cv: Record<string, Record<keyof ThresholdMetrics, MeanStd>>;
  final: { model: string; model_label: string; calibration: string; threshold: number };
  test: {
    n: number;
    n_positive: number;
    roc_auc_ci95: [number, number];
    at_selected_threshold: ThresholdMetrics;
  };
}

export interface MetricsResponse {
  metrics: {
    meta: { n_rows: number; n_train: number; n_test: number; cv: { splits: number; repeats: number } };
    targets: Record<string, TargetMetrics>;
  };
  global_importance: Record<string, { feature: string; label: string; mean_abs_shap: number }[]>;
}

export interface FieldError {
  field: string;
  message: string;
}
