import type { ReactNode } from "react";

type Tone = "neutral" | "warn" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "border-border bg-surface-2 text-muted",
  warn: "border-warn-border bg-warn-bg text-warn-fg",
  accent: "border-accent/40 bg-accent/10 text-accent",
};

interface ChipProps {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}

export function Chip({ tone = "neutral", title, children }: ChipProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
