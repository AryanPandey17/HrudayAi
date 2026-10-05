import { useMemo, useSyncExternalStore } from "react";

export interface ThemeTokens {
  /** Sequential risk steps, lowest probability first. */
  risk: string[];
  vesselIdle: string;
  canvas: string;
  heartWall: string;
  heartArtery: string;
  heartVein: string;
  outline: string;
  raise: string;
  lower: string;
}

const RISK_VARIABLES = ["--risk-1", "--risk-2", "--risk-3", "--risk-4", "--risk-5"];

// Used during server rendering only; the client always reads the live CSS tokens.
const SERVER_TOKENS: ThemeTokens = {
  risk: ["#e0a068", "#d28540", "#bb6a27", "#96501a", "#6b370f"],
  vesselIdle: "#8d9299",
  canvas: "#f4f4f3",
  heartWall: "#ded8d3",
  heartArtery: "#d9cbc4",
  heartVein: "#cdd2d8",
  outline: "#171717",
  raise: "#b8601f",
  lower: "#2a6fc0",
};

function subscribeToThemeClass(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/**
 * Scene and chart colours read from the CSS tokens of the active theme, so globals.css stays
 * the single definition. Re-reads whenever the theme class on <html> changes.
 */
export function useThemeTokens(): ThemeTokens {
  const themeClass = useSyncExternalStore(
    subscribeToThemeClass,
    () => document.documentElement.className,
    () => null,
  );
  return useMemo(() => {
    if (themeClass === null) return SERVER_TOKENS;
    const styles = getComputedStyle(document.documentElement);
    const read = (name: string) => styles.getPropertyValue(name).trim();
    return {
      risk: RISK_VARIABLES.map(read),
      vesselIdle: read("--vessel-idle"),
      canvas: read("--canvas"),
      heartWall: read("--heart-wall"),
      heartArtery: read("--heart-artery"),
      heartVein: read("--heart-vein"),
      outline: read("--scene-outline"),
      raise: read("--raise"),
      lower: read("--lower"),
    };
  }, [themeClass]);
}
