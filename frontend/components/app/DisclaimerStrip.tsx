import { ShieldAlert } from "lucide-react";

/** Always-visible clinical safety notice: a slim strip directly under the header. */
export function DisclaimerStrip({ text }: { text: string }) {
  return (
    <div
      role="note"
      aria-label="Clinical safety disclaimer"
      className="flex shrink-0 items-start gap-2 border-b border-notice-border bg-notice px-4 py-1.5 text-xs text-notice-foreground lg:px-6"
    >
      <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      <p>
        <span className="font-semibold">Not a diagnostic device.</span> {text}
      </p>
    </div>
  );
}
