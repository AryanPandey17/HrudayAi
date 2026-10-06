import { Activity, ClipboardList, FlaskConical, HeartPulse, type LucideIcon, type LucideProps, Stethoscope } from "lucide-react";
import { createElement } from "react";

/** Icon per ladder stage key from the backend; unknown stages fall back to a clipboard. */
const STAGE_ICONS: Record<string, LucideIcon> = {
  history_exam: Stethoscope,
  ecg: Activity,
  labs: FlaskConical,
  echo: HeartPulse,
};

export function StageIcon({ stageKey, ...props }: LucideProps & { stageKey: string }) {
  return createElement(STAGE_ICONS[stageKey] ?? ClipboardList, { "aria-hidden": true, ...props });
}
