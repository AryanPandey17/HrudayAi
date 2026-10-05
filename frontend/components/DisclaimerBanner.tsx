export const FALLBACK_DISCLAIMER =
  "For decision support and educational purposes only. Not a substitute for formal diagnostic imaging or clinical judgement.";

/** Always-visible clinical safety notice, pinned to the top of the viewport. */
export function DisclaimerBanner({ text }: { text: string }) {
  return (
    <div
      role="note"
      aria-label="Clinical safety disclaimer"
      className="sticky top-0 z-50 flex items-start justify-center gap-2 border-b border-warn-border bg-warn-bg px-4 py-2 text-xs font-medium text-warn-fg sm:text-[13px]"
    >
      <span aria-hidden className="mt-px">⚠</span>
      <p>
        <strong className="font-semibold">Not a diagnostic device.</strong> {text}
      </p>
    </div>
  );
}
