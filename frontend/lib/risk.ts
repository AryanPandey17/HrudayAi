import type { RiskBand } from "./types";

/** Colour used for vessels and swatches before any prediction exists. */
export const NEUTRAL_COLOR = "#aab3c0";

/** Hold-out ROC-AUC below this gets a "lower reliability" tag. */
export const RELIABILITY_AUC_FLOOR = 0.75;

type Rgb = [number, number, number];
const STOPS: [number, Rgb][] = [
  [0, [47, 163, 107]], // green
  [0.5, [227, 185, 58]], // yellow
  [1, [224, 69, 63]], // red
];

const toHex = (channel: number) => Math.round(channel).toString(16).padStart(2, "0");

/** Continuous green -> yellow -> red colour for a probability in [0, 1]. */
export function riskColor(probability: number): string {
  const p = Math.min(1, Math.max(0, probability));
  const upper = STOPS.findIndex(([position]) => position >= p);
  if (upper <= 0) return `#${STOPS[0][1].map(toHex).join("")}`;
  const [startAt, start] = STOPS[upper - 1];
  const [endAt, end] = STOPS[upper];
  const t = (p - startAt) / (endAt - startAt);
  return `#${start.map((channel, i) => toHex(channel + (end[i] - channel) * t)).join("")}`;
}

/** CSS gradient matching `riskColor`, for legends. */
export const RISK_GRADIENT = `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1]
  .map((p) => `${riskColor(p)} ${p * 100}%`)
  .join(", ")})`;

export function bandLabel(bandId: string, bands: RiskBand[]): string {
  return bands.find((band) => band.id === bandId)?.label ?? bandId;
}

export const formatPercent = (probability: number, digits = 0) =>
  `${(probability * 100).toFixed(digits)}%`;

/** Signed percentage-point change, e.g. "+8.4 pp". */
export const formatPoints = (delta: number) =>
  `${delta >= 0 ? "+" : "−"}${Math.abs(delta * 100).toFixed(1)} pp`;
