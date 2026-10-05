import { RELIABILITY_AUC_FLOOR } from "./risk";
import type { MetricsResponse } from "./types";

export interface Reliability {
  lower: boolean;
  auc: number;
  interval: [number, number];
  summary: string;
}

/** Hold-out discrimination of a target's model, flagged when below the reliability floor. */
export function reliabilityOf(metrics: MetricsResponse | null, target: string): Reliability | null {
  const test = metrics?.metrics.targets[target]?.test;
  if (!test) return null;
  const auc = test.at_selected_threshold.roc_auc;
  const [low, high] = test.roc_auc_ci95;
  return {
    lower: auc < RELIABILITY_AUC_FLOOR,
    auc,
    interval: [low, high],
    summary: `Hold-out ROC-AUC ${auc.toFixed(2)} (95% CI ${low.toFixed(2)}-${high.toFixed(2)}, n=${test.n})`,
  };
}
