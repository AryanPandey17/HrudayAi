import { TrendingUp } from "lucide-react";

import { isLowerReliability, ReliabilityBadge } from "@/components/shared/badges";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RELIABILITY_AUC_FLOOR } from "@/lib/config";
import type { LadderResponse, MetricsResponse, StageReport, Target } from "@/lib/types";

interface PerformanceViewProps {
  targets: Target[];
  ladder: LadderResponse;
  metrics: MetricsResponse;
  selected: string;
  activeStage: number;
}

const NUMERIC = "font-mono tabular-nums";

function stageMetrics(report: StageReport) {
  return {
    cv_roc_auc: report.cv.roc_auc,
    cv_f1: report.cv.f1,
    cv_brier: report.cv.brier,
    test_roc_auc: report.test.at_selected_threshold.roc_auc,
    test_roc_auc_ci95: report.test.roc_auc_ci95,
  };
}

/** Mean CV AUC with a marker when the gain over the previous step is distinguishable from noise. */
function AucCell({ report }: { report: StageReport }) {
  const gain = report.gain_vs_previous_stage;
  return (
    <span className={`inline-flex items-center gap-1 ${NUMERIC}`}>
      {report.cv.roc_auc.mean.toFixed(3)}
      {gain?.distinguishable_from_noise && (
        <Tooltip>
          <TooltipTrigger asChild>
            <TrendingUp className="size-3.5 text-primary" tabIndex={0} aria-label="Gain over the previous step is distinguishable from noise" />
          </TooltipTrigger>
          <TooltipContent>
            +{gain.mean_cv_auc_gain.toFixed(3)} over the previous step, p = {gain.p_value.toFixed(2)}
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}

/** Saved validation results (reports/ladder_metrics.json), shown exactly as produced by training. */
export function PerformanceView({ targets, ladder, metrics, selected, activeStage }: PerformanceViewProps) {
  const { n_train, n_test, n_rows } = metrics.metrics.meta;
  const stageReports = (target: string) => ladder.stages.map((stage) => ladder.metrics[target].stages[String(stage.id)]);
  const anyGain = targets.some(({ name }) => stageReports(name).some((r) => r.gain_vs_previous_stage?.distinguishable_from_noise));

  return (
    <div className="space-y-4">
      <p className="text-base leading-relaxed">
        Every step has its own model for every target, trained on {n_train} patients and checked on {n_test} held-out
        patients. Adding tests does not reliably improve these models: most step-to-step changes are within noise.
      </p>

      <div>
        <p className="mb-2 text-[13px] font-medium">Cross-validated ROC-AUC by step</p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Target</TableHead>
                {ladder.stages.map((stage) => (
                  <TableHead key={stage.id} className={stage.id === activeStage ? "text-foreground" : undefined}>
                    Step {stage.id}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map(({ name }) => (
                <TableRow key={name} data-state={name === selected ? "selected" : undefined}>
                  <TableCell className="font-medium">{name}</TableCell>
                  {stageReports(name).map((report) => (
                    <TableCell key={report.stage}>
                      <AucCell report={report} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <TrendingUp className="mt-px size-3.5 shrink-0 text-primary" aria-hidden />
          <span>
            {anyGain ? "Marks the only gains" : "No gain is"} distinguishable from noise (corrected resampled t-test, p &lt; 0.05).
            Unmarked changes, up or down, should be read as no change. {ladder.meta.cv.splits}-fold × {ladder.meta.cv.repeats} repeats.
            Steps: {ladder.stages.map((stage) => `${stage.id} ${stage.label}`).join(", ")}.
          </span>
        </p>
      </div>

      <Separator />
      <div>
        <p className="mb-2 text-[13px] font-medium">{selected}: each step in detail</p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Step</TableHead>
                <TableHead>CV AUC ± std</TableHead>
                <TableHead>Hold-out AUC (95% CI)</TableHead>
                <TableHead>F1</TableHead>
                <TableHead>Brier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stageReports(selected).map((report) => {
                const test = report.test.at_selected_threshold;
                const [low, high] = report.test.roc_auc_ci95;
                return (
                  <TableRow key={report.stage} data-state={report.stage === activeStage ? "selected" : undefined}>
                    <TableCell className="font-medium">
                      {report.stage}
                    </TableCell>
                    <TableCell className={NUMERIC}>
                      {report.cv.roc_auc.mean.toFixed(3)} ± {report.cv.roc_auc.std.toFixed(3)}
                    </TableCell>
                    <TableCell className={NUMERIC}>
                      {test.roc_auc.toFixed(3)} ({low.toFixed(2)} to {high.toFixed(2)})
                      {isLowerReliability(stageMetrics(report)) && <span className="sr-only"> lower reliability</span>}
                    </TableCell>
                    <TableCell className={NUMERIC}>{test.f1.toFixed(3)}</TableCell>
                    <TableCell className={NUMERIC}>{test.brier.toFixed(3)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {ladder.stages.map((stage) => {
            const report = ladder.metrics[selected].stages[String(stage.id)];
            return isLowerReliability(stageMetrics(report)) ? (
              <span key={stage.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Step {stage.id}: <ReliabilityBadge metrics={stageMetrics(report)} />
              </span>
            ) : null;
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          F1 and Brier are on the {n_test} held-out patients at each model&apos;s tuned threshold. The highlighted row is the
          step in use. Models with hold-out ROC-AUC below {RELIABILITY_AUC_FLOOR} are tagged lower reliability. The dataset has
          {" "}{n_rows} patients from one centre, so every figure carries wide uncertainty and nothing here is clinically validated.
        </p>
      </div>
    </div>
  );
}
