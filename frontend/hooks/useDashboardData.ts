import { useCallback, useEffect, useState } from "react";

import { fetchExamples, fetchLadder, fetchMetrics, fetchSchema } from "@/lib/api";
import type { ExamplesResponse, LadderResponse, MetricsResponse, SchemaResponse } from "@/lib/types";

export interface DashboardData {
  schema: SchemaResponse;
  examples: ExamplesResponse;
  metrics: MetricsResponse;
  ladder: LadderResponse;
}

export type DataState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DashboardData };

/** Loads schema, examples, metrics and ladder definitions once; `retry` reloads after a failure. */
export function useDashboardData(): { state: DataState; retry: () => void } {
  const [state, setState] = useState<DataState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchSchema(), fetchExamples(), fetchMetrics(), fetchLadder()])
      .then(([schema, examples, metrics, ladder]) => {
        if (!cancelled) setState({ status: "ready", data: { schema, examples, metrics, ladder } });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ status: "error", message: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((count) => count + 1);
  }, []);
  return { state, retry };
}
