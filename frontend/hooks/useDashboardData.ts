import { useCallback, useEffect, useState } from "react";

import { fetchExamples, fetchMetrics, fetchSchema } from "@/lib/api";
import type { ExamplesResponse, MetricsResponse, SchemaResponse } from "@/lib/types";

export interface DashboardData {
  schema: SchemaResponse;
  examples: ExamplesResponse;
  metrics: MetricsResponse;
}

export type DataState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DashboardData };

/** Loads the schema, example patients and saved metrics once; `retry` reloads after a failure. */
export function useDashboardData(): { state: DataState; retry: () => void } {
  const [state, setState] = useState<DataState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchSchema(), fetchExamples(), fetchMetrics()])
      .then(([schema, examples, metrics]) => {
        if (!cancelled) setState({ status: "ready", data: { schema, examples, metrics } });
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
