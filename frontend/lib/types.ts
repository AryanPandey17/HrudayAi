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
  /** First ladder stage at which this feature is used. */
  stage: number;
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

/** Percentile interval of a probability over bootstrap refits of the stage model. */
export interface Interval {
  low: number;
  high: number;
  lower_percentile: number;
  upper_percentile: number;
  n_bootstrap: number;
}

export interface StageMetrics {
  cv_roc_auc: MeanStd;
  cv_f1: MeanStd;
  cv_brier: MeanStd;
  test_roc_auc: number;
  test_roc_auc_ci95: [number, number];
}

export interface TargetPrediction {
  probability: number;
  interval: Interval;
  stage_metrics: StageMetrics;
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
  stage: { id: number; key: string; label: string };
  stage_selection: "requested" | "highest_complete";
  ignored_features: string[];
  missing_for_next_stage: string[];
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

export interface StageGain {
  mean_cv_auc_gain: number;
  p_value: number;
  distinguishable_from_noise: boolean;
}

/** Saved validation report of one target at one ladder stage (reports/ladder_metrics.json). */
export interface StageReport {
  stage: number;
  label: string;
  n_features: number;
  threshold: number;
  cv: Record<keyof ThresholdMetrics, MeanStd>;
  test: {
    n: number;
    n_positive: number;
    roc_auc_ci95: [number, number];
    at_selected_threshold: ThresholdMetrics;
  };
  interval: { mean_width_test: number; median_width_test: number };
  gain_vs_previous_stage: StageGain | null;
}

export interface LadderStage {
  id: number;
  key: string;
  label: string;
  groups: string[];
  added_features: string[];
  required_features: string[];
  n_model_features: number;
}

export interface LadderResponse {
  stages: LadderStage[];
  meta: { cv: { splits: number; repeats: number }; model: string; calibration: string };
  metrics: Record<string, { stages: Record<string, StageReport> }>;
}

export interface MetricsResponse {
  metrics: { meta: { n_rows: number; n_train: number; n_test: number } };
}

export interface FieldError {
  field: string;
  message: string;
}
