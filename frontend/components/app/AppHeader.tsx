import { HeartPulse } from "lucide-react";

import { APP_NAME, APP_TAGLINE } from "@/lib/config";

import { ThemeToggle } from "./ThemeToggle";

export type ApiStatus = "loading" | "ready" | "error";

const STATUS: Record<ApiStatus, { text: string; dot: string }> = {
  loading: { text: "Connecting", dot: "bg-muted-foreground" },
  ready: { text: "API connected", dot: "bg-primary" },
  error: { text: "API unreachable", dot: "bg-destructive" },
};

/** Slim top bar: product name, API status and theme switch. */
export function AppHeader({ status }: { status: ApiStatus }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <HeartPulse className="size-6 shrink-0 text-primary" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
        <span className="hidden truncate text-sm text-muted-foreground sm:inline">{APP_TAGLINE}</span>
      </div>
      <div className="flex items-center gap-3">
        <span role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`size-2 rounded-full ${STATUS[status].dot}`} aria-hidden />
          {STATUS[status].text}
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
