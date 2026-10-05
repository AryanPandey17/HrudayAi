import type { SVGProps } from "react";

const BASE: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 120 80",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

/** Empty-state line art: a clipboard with unfilled rows and a heart trace. */
export function NoPredictionArt(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} {...props}>
      <rect x="34" y="12" width="52" height="60" rx="6" />
      <path d="M50 12v-3a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v3" />
      <path d="M44 28h32M44 38h20" opacity="0.5" />
      <path d="M44 54h8l4-8 6 14 4-6h10" />
    </svg>
  );
}

/** Empty-state line art: a bar chart outline waiting for data. */
export function NoExplanationArt(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} {...props}>
      <path d="M60 10v60" opacity="0.5" />
      <rect x="60" y="16" width="30" height="8" rx="2" />
      <rect x="38" y="30" width="22" height="8" rx="2" />
      <rect x="60" y="44" width="18" height="8" rx="2" />
      <rect x="46" y="58" width="14" height="8" rx="2" />
    </svg>
  );
}
