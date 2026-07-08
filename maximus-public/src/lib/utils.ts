import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeMesa(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const mesa = value.trim();
  return /^\d{1,3}$/.test(mesa) ? mesa : undefined;
}
