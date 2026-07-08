import type { PaymentStatus } from "./data/types";

export type FinancialTone = "positive" | "negative" | "neutral" | "brand";

export interface ToneClasses {
  text: string;
  bg: string;
  border: string;
  chip: string;
}

const FINANCIAL_TONES: Record<FinancialTone, ToneClasses> = {
  positive: {
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    chip: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
  },
  negative: {
    text: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    chip: "border-red-500/30 bg-red-500/15 text-red-400",
  },
  neutral: {
    text: "text-muted-foreground",
    bg: "bg-secondary",
    border: "border-border",
    chip: "border-border bg-secondary text-muted-foreground",
  },
  brand: {
    text: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
    chip: "border-primary/30 bg-primary/15 text-primary",
  },
};

export function getFinancialTone(valueOrStatus?: number | string | PaymentStatus | null) {
  if (typeof valueOrStatus === "number") {
    if (valueOrStatus > 0) return FINANCIAL_TONES.positive;
    if (valueOrStatus < 0) return FINANCIAL_TONES.negative;
    return FINANCIAL_TONES.neutral;
  }

  if (valueOrStatus === "confirmed" || valueOrStatus === "paid") return FINANCIAL_TONES.positive;
  if (
    valueOrStatus === "rejected" ||
    valueOrStatus === "cancelled" ||
    valueOrStatus === "canceled" ||
    valueOrStatus === "refund" ||
    valueOrStatus === "loss"
  ) {
    return FINANCIAL_TONES.negative;
  }
  if (valueOrStatus === "pending" || valueOrStatus === "customer_reported_paid") {
    return valueOrStatus === "pending" ? FINANCIAL_TONES.negative : FINANCIAL_TONES.brand;
  }
  return FINANCIAL_TONES.neutral;
}

export interface DriverColor {
  dot: string;
  text: string;
  bg: string;
  border: string;
  chip: string;
  hex: string;
}

const DRIVER_COLORS: DriverColor[] = [
  {
    dot: "bg-blue-500",
    text: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    chip: "border-blue-500/30 bg-blue-500/15 text-blue-300",
    hex: "#3b82f6",
  },
  {
    dot: "bg-violet-500",
    text: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    chip: "border-violet-500/30 bg-violet-500/15 text-violet-300",
    hex: "#8b5cf6",
  },
  {
    dot: "bg-cyan-500",
    text: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    chip: "border-cyan-500/30 bg-cyan-500/15 text-cyan-300",
    hex: "#06b6d4",
  },
  {
    dot: "bg-pink-500",
    text: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/30",
    chip: "border-pink-500/30 bg-pink-500/15 text-pink-300",
    hex: "#ec4899",
  },
  {
    dot: "bg-amber-500",
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    chip: "border-amber-500/30 bg-amber-500/15 text-amber-300",
    hex: "#f59e0b",
  },
  {
    dot: "bg-lime-500",
    text: "text-lime-400",
    bg: "bg-lime-500/10",
    border: "border-lime-500/30",
    chip: "border-lime-500/30 bg-lime-500/15 text-lime-300",
    hex: "#84cc16",
  },
];

export function getDriverColor(driverIdOrName?: string | null): DriverColor {
  const value = driverIdOrName?.trim().toLowerCase() || "sem-entregador";
  const hash = [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return DRIVER_COLORS[hash % DRIVER_COLORS.length];
}
