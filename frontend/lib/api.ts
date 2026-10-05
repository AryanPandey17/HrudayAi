import type {
  ExamplesResponse,
  FieldError,
  MetricsResponse,
  PredictResponse,
  Scalar,
  SchemaResponse,
} from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** An API failure with a user-presentable message and optional per-field errors. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: FieldError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(`Cannot reach the prediction API at ${API_URL}. Is the backend running?`);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.detail ?? `Request failed (${response.status})`, body?.errors ?? []);
  }
  return response.json() as Promise<T>;
}

export const fetchSchema = () => request<SchemaResponse>("/schema");
export const fetchExamples = () => request<ExamplesResponse>("/examples");
export const fetchMetrics = () => request<MetricsResponse>("/metrics");

export function predict(
  features: Record<string, Scalar>,
  signal?: AbortSignal,
): Promise<PredictResponse> {
  return request<PredictResponse>("/predict?top_n=6", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(features),
    signal,
  });
}
