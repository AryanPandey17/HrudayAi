import { Activity, ClipboardList, FlaskConical, HeartPulse, type LucideIcon, Stethoscope } from "lucide-react";

/** Icon per ladder stage key from the backend; unknown stages fall back to a clipboard. */
const STAGE_ICONS: Record<string, LucideIcon> = {
  history_exam: Stethoscope,
  ecg: Activity,
  labs: FlaskConical,
  echo: HeartPulse,
};

export const stageIcon = (key: string): LucideIcon => STAGE_ICONS[key] ?? ClipboardList;
