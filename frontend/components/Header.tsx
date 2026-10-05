"use client";

import { APP_NAME, APP_TAGLINE } from "@/lib/config";

type ApiStatus = "loading" | "ready" | "error";

const STATUS_TEXT: Record<ApiStatus, string> = {
  loading: "Connecting to API…",
  ready: "API connected",
  error: "API unreachable",
};
const STATUS_DOT: Record<ApiStatus, string> = {
  loading: "bg-muted animate-pulse",
  ready: "bg-emerald-500",
  error: "bg-red-500",
};

function toggleTheme() {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const current = root.dataset.theme ?? (systemDark ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try {
    localStorage.setItem("theme", next);
  } catch {
    // Storage may be unavailable (private mode); the theme still applies for this visit.
  }
}

export function Header({ status }: { status: ApiStatus }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 24 24" className="size-7 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
          <path d="M4.5 12.5h4l1.5-3 2.5 6 1.5-3h5.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <h1 className="text-base font-semibold leading-tight tracking-tight">{APP_NAME}</h1>
          <p className="text-xs text-muted">{APP_TAGLINE}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1.5" role="status">
          <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} />
          {STATUS_TEXT[status]}
        </span>
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-md border border-border bg-surface px-2.5 py-1.5 font-medium text-fg hover:bg-surface-2"
        >
          Light / dark
        </button>
      </div>
    </header>
  );
}
