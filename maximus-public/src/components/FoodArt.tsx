import type { ReactElement } from "react";
import type { FoodVariant } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * PLACEHOLDER SVG ARTWORK.
 * Easy to swap for real photos later: replace the matching <svg> block,
 * or render an <img> with the same className in the parent component.
 */
export function FoodArt({ variant, className }: { variant: FoodVariant; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label={`Imagem ilustrativa: ${variant}`}
      className={cn("h-full w-full", className)}
    >
      {ART[variant] ?? ART.plate}
    </svg>
  );
}

const shadow = "oklch(0 0 0 / 0.35)";
const dark = "#1f120d";
const cream = "#fff2d2";
const bun = "#c8752a";
const bunLight = "#f4b45f";
const cheese = "#f6b22a";
const meat = "#5b2315";
const meatLight = "#b94e2f";
const lettuce = "#5f9f35";
const steak = "#8f241d";
const steakLight = "#d96546";
const onionRing = "#d99a32";
const onionRingLight = "#f4c66a";
const beer = "#f0a90a";
const beerLight = "#ffc94a";
const soda = "#b81914";
const sodaLight = "#f04a25";

const ART: Record<FoodVariant, ReactElement> = {
  burger: (
    <g>
      <ellipse cx="60" cy="96" rx="40" ry="7" fill={shadow} />
      <path d="M22 44c0-18 16-28 38-28s38 10 38 28z" fill={bunLight} />
      <circle cx="42" cy="33" r="1.8" fill={cream} />
      <circle cx="60" cy="29" r="1.8" fill={cream} />
      <circle cx="78" cy="33" r="1.8" fill={cream} />
      <rect x="22" y="44" width="76" height="8" rx="4" fill={lettuce} />
      <rect x="20" y="52" width="80" height="10" rx="4" fill={meat} />
      <rect x="22" y="62" width="76" height="9" rx="4" fill={cheese} />
      <path d="M24 71h72c-2 12-16 18-36 18s-34-6-36-18z" fill={bun} />
    </g>
  ),
  churrasco: (
    <g>
      <ellipse cx="60" cy="98" rx="38" ry="6" fill={shadow} />
      <path
        d="M24 70c5-24 28-42 55-37 21 4 36 19 40 37-8 22-30 34-56 30-23-4-38-16-39-30z"
        fill={steak}
      />
      <path
        d="M34 68c8-14 25-24 45-20 14 3 25 11 31 22-10 13-27 19-46 16-14-2-24-9-30-18z"
        fill={steakLight}
        opacity="0.85"
      />
      <path
        d="M38 67c13-8 28-11 42-8 9 2 17 6 23 11-13 8-28 10-42 7-10-2-18-5-23-10z"
        fill={cream}
        opacity="0.28"
      />
      <path
        d="M37 76c18 7 40 10 63 1M43 58c21 5 38 7 58 2"
        stroke={dark}
        strokeLinecap="round"
        strokeWidth="5"
        opacity="0.75"
      />
    </g>
  ),
  petiscos: (
    <g>
      <ellipse cx="60" cy="98" rx="40" ry="7" fill={shadow} />
      <circle cx="44" cy="64" r="18" fill={onionRing} />
      <circle cx="44" cy="64" r="8" fill={dark} />
      <circle cx="72" cy="58" r="17" fill={onionRingLight} />
      <circle cx="72" cy="58" r="7" fill={dark} />
      <circle cx="68" cy="80" r="15" fill={onionRing} />
      <circle cx="68" cy="80" r="6" fill={dark} />
      <circle cx="42" cy="60" r="3" fill={cream} opacity="0.8" />
      <circle cx="76" cy="54" r="3" fill={cream} opacity="0.8" />
      <circle cx="65" cy="77" r="2.5" fill={cream} opacity="0.8" />
    </g>
  ),
  bebidas: (
    <g>
      <ellipse cx="60" cy="100" rx="26" ry="5" fill={shadow} />
      <path d="M44 26h32l-4 66a6 6 0 0 1-6 5H54a6 6 0 0 1-6-5z" fill={dark} />
      <path d="M46 46h28l-3 46a5 5 0 0 1-5 4H54a5 5 0 0 1-5-4z" fill={soda} opacity="0.9" />
      <rect x="54" y="14" width="12" height="14" rx="3" fill={sodaLight} />
    </g>
  ),
  chopp: (
    <g>
      <ellipse cx="58" cy="100" rx="28" ry="5" fill={shadow} />
      <rect x="34" y="34" width="42" height="62" rx="8" fill="oklch(0.85 0.05 90)" opacity="0.25" />
      <rect x="34" y="48" width="42" height="48" rx="8" fill={beer} />
      <path d="M34 48c6-12 36-12 42 0z" fill={cream} />
      <circle cx="42" cy="38" r="6" fill={cream} />
      <circle cx="56" cy="33" r="7" fill={cream} />
      <circle cx="70" cy="38" r="6" fill={cream} />
      <path
        d="M76 52h12a8 8 0 0 1 8 8v8a8 8 0 0 1-8 8H76z"
        fill="none"
        stroke={beerLight}
        strokeWidth="6"
      />
    </g>
  ),
  plate: (
    <g>
      <ellipse cx="60" cy="98" rx="40" ry="7" fill={shadow} />
      <circle cx="60" cy="60" r="40" fill={dark} />
      <circle cx="60" cy="60" r="26" fill={meatLight} />
    </g>
  ),
};
