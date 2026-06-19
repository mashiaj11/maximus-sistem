import type { ReactElement } from "react";
import type { FoodVariant } from "@/lib/types";
import { cn } from "@/lib/utils";

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
const dark = "#21120c";
const cream = "#fff2d2";
const orange = "#ff5a1f";
const orangeSoft = "#ff8a3d";
const gold = "#f7b731";
const goldSoft = "#ffd36a";
const red = "#b72a1b";
const redSoft = "#e95a35";
const brown = "#5a2417";
const brownSoft = "#9a4529";
const green = "#6d9f3c";

const ART: Record<FoodVariant, ReactElement> = {
  burger: (
    <g>
      <ellipse cx="60" cy="96" rx="38" ry="6" fill={shadow} />
      <path d="M25 47c2-18 17-29 35-29s33 11 35 29z" fill={goldSoft} />
      <path d="M31 43c5-11 16-17 29-17s24 6 29 17z" fill={orangeSoft} opacity="0.55" />
      <circle cx="45" cy="34" r="1.8" fill={cream} />
      <circle cx="60" cy="30" r="1.8" fill={cream} />
      <circle cx="75" cy="34" r="1.8" fill={cream} />
      <path d="M24 49h72c2 0 3 3 1 4l-6 4c-8 5-17-4-26 1-10 5-16 0-26-1l-15-2c-3 0-3-6 0-6z" fill={green} />
      <rect x="23" y="57" width="74" height="10" rx="5" fill={brown} />
      <path d="M27 68h66l-10 9H37z" fill={gold} />
      <path d="M27 76h66c-3 12-16 18-33 18s-30-6-33-18z" fill={orange} />
      <path d="M35 82h50" stroke={cream} strokeWidth="2" strokeLinecap="round" opacity="0.35" />
    </g>
  ),
  churrasco: (
    <g>
      <ellipse cx="60" cy="98" rx="38" ry="6" fill={shadow} />
      <path
        d="M25 69c5-22 27-38 52-34 21 3 35 18 39 35-7 21-28 32-53 29-23-3-37-15-38-30z"
        fill={red}
      />
      <path
        d="M36 68c8-13 24-22 42-19 14 2 24 10 29 21-9 12-25 18-43 16-13-2-23-8-28-18z"
        fill={redSoft}
      />
      <path d="M40 65c12-7 26-9 39-7 9 2 16 5 22 10-12 7-26 9-39 7-9-1-17-5-22-10z" fill={cream} opacity="0.25" />
      <path
        d="M39 77c18 6 38 8 59 1M44 58c20 4 36 5 54 1"
        stroke={dark}
        strokeLinecap="round"
        strokeWidth="4"
        opacity="0.75"
      />
    </g>
  ),
  petiscos: (
    <g>
      <ellipse cx="60" cy="98" rx="40" ry="7" fill={shadow} />
      <circle cx="42" cy="63" r="17" fill={gold} />
      <circle cx="42" cy="63" r="8" fill={dark} />
      <circle cx="70" cy="55" r="17" fill={goldSoft} />
      <circle cx="70" cy="55" r="8" fill={dark} />
      <circle cx="70" cy="80" r="15" fill={orangeSoft} />
      <circle cx="70" cy="80" r="7" fill={dark} />
      <path d="M31 79c12 10 42 17 64 6" stroke={cream} strokeWidth="5" strokeLinecap="round" opacity="0.22" />
      <path d="M35 58l7-4M64 51l7-4M65 78l6-4" stroke={cream} strokeWidth="3" strokeLinecap="round" opacity="0.75" />
    </g>
  ),
  bebidas: (
    <g>
      <ellipse cx="60" cy="100" rx="31" ry="5" fill={shadow} />
      <path d="M44 30h25l-3 61a6 6 0 0 1-6 6H48a6 6 0 0 1-6-6z" fill={dark} />
      <path d="M47 47h18l-2 43a4 4 0 0 1-4 4H50a4 4 0 0 1-4-4z" fill={orange} />
      <rect x="50" y="18" width="12" height="14" rx="3" fill={gold} />
      <path d="M76 36h15a4 4 0 0 1 4 4v51a6 6 0 0 1-6 6H78a6 6 0 0 1-6-6l-2-51a4 4 0 0 1 4-4z" fill={red} />
      <path d="M76 52h15" stroke={goldSoft} strokeWidth="5" strokeLinecap="round" />
      <path d="M53 54v28M83 61v22" stroke={cream} strokeWidth="2" strokeLinecap="round" opacity="0.35" />
    </g>
  ),
  chopp: (
    <g>
      <ellipse cx="58" cy="100" rx="28" ry="5" fill={shadow} />
      <rect x="34" y="34" width="42" height="62" rx="8" fill={cream} opacity="0.2" />
      <rect x="34" y="48" width="42" height="48" rx="8" fill={gold} />
      <path d="M34 48c6-12 36-12 42 0z" fill={cream} />
      <circle cx="42" cy="38" r="6" fill={cream} />
      <circle cx="56" cy="33" r="7" fill={cream} />
      <circle cx="70" cy="38" r="6" fill={cream} />
      <path
        d="M76 52h12a8 8 0 0 1 8 8v8a8 8 0 0 1-8 8H76z"
        fill="none"
        stroke={goldSoft}
        strokeWidth="6"
      />
      <path d="M47 57v29M61 57v29" stroke={cream} strokeWidth="3" strokeLinecap="round" opacity="0.3" />
    </g>
  ),
  plate: (
    <g>
      <ellipse cx="60" cy="98" rx="40" ry="7" fill={shadow} />
      <circle cx="60" cy="60" r="39" fill={cream} />
      <circle cx="60" cy="60" r="28" fill={dark} />
      <path d="M40 62c9-10 24-13 38-6 7 4 12 10 15 17-15 6-34 4-47-5-3-2-5-4-6-6z" fill={redSoft} />
      <path d="M39 46c9-9 26-10 38-2-6 9-19 14-34 12-4-1-6-5-4-10z" fill={green} />
      <path d="M59 70c4-8 15-13 28-13 2 11-6 21-19 24-7 2-12-5-9-11z" fill={gold} />
      <path d="M37 83h47" stroke={cream} strokeWidth="4" strokeLinecap="round" opacity="0.22" />
    </g>
  ),
  sobremesas: (
    <g>
      <ellipse cx="60" cy="98" rx="34" ry="6" fill={shadow} />
      <path d="M36 52h48l-6 34a9 9 0 0 1-9 8H51a9 9 0 0 1-9-8z" fill={goldSoft} />
      <path d="M40 52c3-12 15-21 20-21s17 9 20 21z" fill={cream} />
      <path d="M43 53h34c0 8-8 15-17 15s-17-7-17-15z" fill={orangeSoft} />
      <path d="M50 35c8 5 12 5 20 0" stroke={redSoft} strokeWidth="5" strokeLinecap="round" />
      <circle cx="61" cy="28" r="5" fill={red} />
      <path d="M48 78h24" stroke={brownSoft} strokeWidth="4" strokeLinecap="round" opacity="0.45" />
    </g>
  ),
  sucos: (
    <g>
      <ellipse cx="60" cy="99" rx="30" ry="5" fill={shadow} />
      <path d="M39 34h42l-5 57a7 7 0 0 1-7 6H51a7 7 0 0 1-7-6z" fill={cream} opacity="0.24" />
      <path d="M43 52h34l-3 38a5 5 0 0 1-5 5H51a5 5 0 0 1-5-5z" fill={orange} />
      <path d="M45 52c9-6 21-6 31 0" stroke={goldSoft} strokeWidth="5" strokeLinecap="round" />
      <path d="M70 20l-9 31" stroke={cream} strokeWidth="4" strokeLinecap="round" />
      <circle cx="84" cy="35" r="13" fill={gold} />
      <path d="M76 35h16M84 27v16" stroke={orangeSoft} strokeWidth="3" strokeLinecap="round" />
      <path d="M56 61v22" stroke={cream} strokeWidth="2" strokeLinecap="round" opacity="0.35" />
    </g>
  ),
  refrigerantes: (
    <g>
      <ellipse cx="60" cy="99" rx="27" ry="5" fill={shadow} />
      <path d="M44 29h32l-4 61a7 7 0 0 1-7 7H55a7 7 0 0 1-7-7z" fill={red} />
      <path d="M47 45h27l-2 28H48z" fill={orange} />
      <path d="M51 21h18l2 10H49z" fill={gold} />
      <rect x="50" y="55" width="20" height="12" rx="3" fill={cream} opacity="0.92" />
      <path d="M55 85h10M55 38h10" stroke={cream} strokeWidth="3" strokeLinecap="round" opacity="0.4" />
      <circle cx="80" cy="50" r="4" fill={goldSoft} opacity="0.9" />
    </g>
  ),
};
