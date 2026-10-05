import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { ReliabilityChip } from "@/components/ui/ReliabilityChip";
import { reliabilityOf } from "@/lib/reliability";
import { RELIABILITY_AUC_FLOOR } from "@/lib/risk";
import type { MetricsResponse, ThresholdMetrics } from "@/lib/types";

const TEST_COLUMNS: [keyof ThresholdMetrics, string][] = [
  ["accuracy", "Accuracy"],
  ["precision", "Precision"],
  ["recall", "Recall"],
  ["f1", "F1"],
  ["brier", "Brier"],
];

const HEAD = "px-2 py-1.5 font-semibold";
const CELL = "px-2 py-1.5 font-mono tabular-nums";

/** Saved evaluation results (reports/metrics.json), shown exactly as produced by training. */
export function MetricsPanel({ metrics, selected }: { metrics: MetricsResponse; selected: string }) {
  const { meta, targets } = metrics.metrics;
  return (
    <Panel
      title="Model performance"
      subtitle={`Trained on ${meta.n_train} patients, evaluated on ${meta.n_test} held-out patients; cross-validation is ${meta.cv.splits}-fold × ${meta.cv.repeats} repeats on the training set.`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className={HEAD}>Target</th>
              <th className={HEAD}>Model</th>
              <th className={HEAD}>CV ROC-AUC</th>
              <th className={HEAD}>Hold-out ROC-AUC (95% CI)</th>
              {TEST_COLUMNS.map(([key, label]) => (
                <th key={key} className={HEAD}>{label}</th>
              ))}
              <th className={HEAD}>Reliability</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(targets).map(([name, target]) => {
              const cv = target.calibration_cv[target.final.calibration].roc_auc;
              const test = target.test.at_selected_threshold;
              const reliability = reliabilityOf(metrics, name);
              return (
                <tr key={name} className={`border-t border-border ${name === selected ? "bg-accent/10" : ""}`}>
                  <th scope="row" className="px-2 py-1.5 font-semibold">{name}</th>
                  <td className="px-2 py-1.5">
                    {target.final.model_label} <span className="text-muted">+ {target.final.calibration}</span>
                  </td>
                  <td className={CELL}>{cv.mean.toFixed(3)} ± {cv.std.toFixed(3)}</td>
                  <td className={CELL}>
                    {test.roc_auc.toFixed(3)} ({target.test.roc_auc_ci95.map((bound) => bound.toFixed(2)).join("-")})
                  </td>
                  {TEST_COLUMNS.map(([key]) => (
                    <td key={key} className={CELL}>{test[key].toFixed(3)}</td>
                  ))}
                  <td className="px-2 py-1.5">
                    {reliability?.lower ? <ReliabilityChip reliability={reliability} /> : <Chip>Acceptable</Chip>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        Accuracy, precision, recall, F1 and Brier are on the {meta.n_test} held-out patients at each model&apos;s tuned
        threshold. Targets with hold-out ROC-AUC below {RELIABILITY_AUC_FLOOR} are tagged &quot;lower reliability&quot;.
        The dataset has only {meta.n_rows} patients from one centre, so every figure carries wide uncertainty and none of
        this is clinically validated.
      </p>
    </Panel>
  );
}
