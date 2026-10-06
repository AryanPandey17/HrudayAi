import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RELIABILITY_AUC_FLOOR } from "@/lib/config";
import type { StageMetrics, TargetPrediction } from "@/lib/types";

/** Predicted label from the stage model's tuned threshold. */
export function PredictedLabelBadge({ prediction }: { prediction: TargetPrediction }) {
  const Icon = prediction.positive ? CircleAlert : CircleCheck;
  return (
    <Badge variant={prediction.positive ? "default" : "secondary"}>
      <Icon aria-hidden /> Predicted: {prediction.label}
    </Badge>
  );
}

export const isLowerReliability = (metrics: StageMetrics) => metrics.test_roc_auc < RELIABILITY_AUC_FLOOR;

/** "Lower reliability" tag for stage models whose hold-out ROC-AUC is below the floor. */
export function ReliabilityBadge({ metrics }: { metrics: StageMetrics }) {
  if (!isLowerReliability(metrics)) return null;
  const [low, high] = metrics.test_roc_auc_ci95;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="border-notice-border bg-notice text-notice-foreground" tabIndex={0}>
          <TriangleAlert aria-hidden /> Lower reliability · AUC {metrics.test_roc_auc.toFixed(2)}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        Hold-out ROC-AUC {metrics.test_roc_auc.toFixed(2)} (95% CI {low.toFixed(2)} to {high.toFixed(2)}), below the{" "}
        {RELIABILITY_AUC_FLOOR} floor. Cross-validated {metrics.cv_roc_auc.mean.toFixed(2)} ± {metrics.cv_roc_auc.std.toFixed(2)}.
      </TooltipContent>
    </Tooltip>
  );
}
