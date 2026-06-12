import { type ReactNode, useEffect, useState } from "react";

export function ClientOnly({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (typeof window === "undefined" || !mounted) return fallback;

  return children;
}
