import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      aria-label="Maximus Hamburgueria - início"
      className={cn("inline-flex shrink-0 items-center", className)}
    >
      <img
        src="/branding/maximus-hero-logo.png"
        alt="Maximus Hamburgueria"
        width={260}
        height={52}
        className="h-12 w-auto object-contain sm:h-14"
      />
    </Link>
  );
}
