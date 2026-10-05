import { useEffect, useState } from "react";

import { ApiError, predict } from "@/lib/api";
import type { FieldError, PredictResponse, Scalar } from "@/lib/types";

const DEBOUNCE_MS = 300;

export interface PredictionState {
  /** Latest successful result; kept while a newer request is in flight to avoid flicker. */
  result: PredictResponse | null;
  loading: boolean;
  error: string | null;
  fieldErrors: FieldError[];
}

const IDLE: PredictionState = { result: null, loading: false, error: null, fieldErrors: [] };

/** Re-predicts (debounced) whenever the payload changes; a null payload clears the result. */
export function usePrediction(payload: Record<string, Scalar> | null): PredictionState {
  const [state, setState] = useState<PredictionState>(IDLE);
  const body = payload ? JSON.stringify(payload) : null;

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (!body) return setState(IDLE);
      setState((previous) => ({ ...previous, loading: true }));
      predict(JSON.parse(body), controller.signal)
        .then((result) => setState({ result, loading: false, error: null, fieldErrors: [] }))
        .catch((error: Error) => {
          if (error.name === "AbortError") return;
          const fieldErrors = error instanceof ApiError ? error.fieldErrors : [];
          setState({ result: null, loading: false, error: error.message, fieldErrors });
        });
    }, body ? DEBOUNCE_MS : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [body]);

  return state;
}
