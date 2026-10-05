import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Titled surface used for every dashboard section. */
export function Panel({ title, subtitle, actions, className = "", children }: PanelProps) {
  return (
    <section className={`flex flex-col rounded-xl border border-border bg-surface ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className="min-h-0 flex-1 p-4">{children}</div>
    </section>
  );
}
