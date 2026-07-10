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
  icon,
  onClick,
}: {
  label: string;
  description?: string;
  icon?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary/10"
    >
      {icon && (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
          {icon}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-lg font-bold">{label}</span>
        {description && (
          <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
        )}
      </span>
    </button>
  );
}
