import type { RiskBand } from "./types";

type Rgb = [number, number, number];

const toRgb = (hex: string): Rgb => {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};
const toHex = (rgb: Rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

/**
 * Colour for a probability in [0, 1], interpolated across the theme's sequential risk steps
 * (`--risk-1` .. `--risk-5`). The steps are passed in so the same function serves both themes.
 */
export function riskColor(probability: number, steps: string[]): string {
  const position = Math.min(1, Math.max(0, probability)) * (steps.length - 1);
  const lower = Math.min(Math.floor(position), steps.length - 2);
  const [from, to] = [toRgb(steps[lower]), toRgb(steps[lower + 1])];
  const t = position - lower;
  return toHex(from.map((channel, i) => channel + (to[i] - channel) * t) as Rgb);
}

export const riskGradient = (steps: string[]) => `linear-gradient(90deg, ${steps.join(", ")})`;

export function bandLabel(bandId: string, bands: RiskBand[]): string {
  return bands.find((band) => band.id === bandId)?.label ?? bandId;
}

export const formatPercent = (probability: number, digits = 0) => `${(probability * 100).toFixed(digits)}%`;

/** Signed percentage-point change, e.g. "+8.4 pp". */
export const formatPoints = (delta: number) => `${delta >= 0 ? "+" : "−"}${Math.abs(delta * 100).toFixed(1)} pp`;
