import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function CheckoutShell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      {onBack && (
        <button
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
      )}
      <h1 className="text-2xl font-extrabold">{title}</h1>
      {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function BigOption({
  label,
  description,
  onClick,
}: {
  label: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all hover:border-primary hover:-translate-y-0.5"
    >
      <span className="text-lg font-bold">{label}</span>
      {description && <span className="mt-1 text-sm text-muted-foreground">{description}</span>}
    </button>
  );
}
