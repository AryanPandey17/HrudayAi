import type { Reliability } from "@/lib/reliability";

import { Chip } from "./Chip";

/** "Lower reliability" tag for targets whose hold-out ROC-AUC is below the floor. */
export function ReliabilityChip({ reliability }: { reliability: Reliability | null }) {
  if (!reliability?.lower) return null;
  return (
    <Chip tone="warn" title={reliability.summary}>
      <span aria-hidden>⚠</span> Lower reliability · AUC {reliability.auc.toFixed(2)}
    </Chip>
  );
}
