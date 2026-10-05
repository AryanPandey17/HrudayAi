import { useEffect, useState } from "react";

import { predictAtStage } from "@/lib/api";
import type { PredictResponse, Scalar } from "@/lib/types";

const DEBOUNCE_MS = 300;

export interface StageRequest {
  stage: number;
  payload: Record<string, Scalar>;
}

export interface LadderPredictions {
  /** Result per stage id, for every stage up to the active one. Kept while a refresh is in flight. */
  byStage: Record<number, PredictResponse>;
  loading: boolean;
  error: string | null;
}

const EMPTY: LadderPredictions = { byStage: {}, loading: false, error: null };

/**
 * Predicts at every usable stage (debounced) whenever the inputs change, so the interface can
 * show both the current estimate and how it moved as tests were added.
 */
export function useLadderPredictions(requests: StageRequest[]): LadderPredictions {
  const [state, setState] = useState<LadderPredictions>(EMPTY);
  const body = JSON.stringify(requests);

  useEffect(() => {
    const controller = new AbortController();
    const pending: StageRequest[] = JSON.parse(body);
    const timer = setTimeout(() => {
      if (pending.length === 0) return setState(EMPTY);
      setState((previous) => ({ ...previous, loading: true }));
      Promise.all(pending.map(({ stage, payload }) => predictAtStage(payload, stage, controller.signal)))
        .then((results) => {
          const byStage = Object.fromEntries(results.map((result) => [result.stage.id, result]));
          setState({ byStage, loading: false, error: null });
        })
        .catch((error: Error) => {
          if (error.name !== "AbortError") setState({ byStage: {}, loading: false, error: error.message });
        });
    }, pending.length ? DEBOUNCE_MS : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [body]);

  return state;
}
