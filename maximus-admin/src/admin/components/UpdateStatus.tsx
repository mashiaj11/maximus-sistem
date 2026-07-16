import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const logoUrl = "/branding/maximus-logo-transparent.png";

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 MB";
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function getButtonLabel(state: MaximusUpdaterState) {
  if (state.status === "available") return "Atualização disponível";
  if (state.status === "downloading") return `Baixando ${Math.round(state.percent)}%`;
  if (state.status === "downloaded") return "Download concluído";
  if (state.status === "installing") return "Instalando atualização";
  if (state.status === "error") return "Erro na atualização";
  if (state.status === "checking") return "Verificando...";
  return "Verificar atualizações";
}

function canClose(status: MaximusUpdaterState["status"]) {
  return status !== "downloading" && status !== "installing";
}

export function UpdateStatus({ compact = false }: { compact?: boolean }) {
  const updater = typeof window === "undefined" ? undefined : window.maximusDesktop?.updater;
  const [state, setState] = useState<MaximusUpdaterState | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!updater) return undefined;
    let mounted = true;
    updater.getState().then((nextState) => {
      if (mounted) setState(nextState);
    });
    const unsubscribe = updater.onStateChanged((nextState) => {
      setState(nextState);
      if (nextState.status === "available" || nextState.status === "downloaded") {
        setOpen(true);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [updater]);

  useEffect(() => {
    if (state?.status === "available" || state?.status === "downloaded") {
      setOpen(true);
    }
  }, [state?.status]);

  const visible = Boolean(updater && state?.enabled);
  const progress = Math.max(0, Math.min(100, state?.percent ?? 0));
  const busy = state?.status === "checking" || state?.status === "downloading";
  const actionLabel = useMemo(() => {
    if (!state) return "Verificar atualizações";
    if (state.status === "available") return "Atualizar agora";
    if (state.status === "error") return "Tentar novamente";
    if (state.status === "idle") return "Verificar atualizações";
    return getButtonLabel(state);
  }, [state]);

  if (!visible || !state) return null;

  const handlePrimaryAction = async () => {
    if (!updater) return;
    if (state.status === "available") {
      await updater.download();
      return;
    }
    if (state.status === "downloaded") {
      await updater.install();
      return;
    }
    await updater.check();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-md font-bold transition-colors ${
          state.status === "available" || state.status === "downloaded"
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-foreground hover:bg-accent"
        } ${compact ? "h-10 w-full text-[10px]" : "mt-3 w-full px-3 py-2 text-xs"}`}
      >
        {compact ? "Updates" : getButtonLabel(state)}
        {!compact && state.nextVersion && (
          <span className="ml-1 opacity-80">v{state.nextVersion}</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <section className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-2xl">
            <div className="flex items-center gap-4">
              <img src={logoUrl} alt="Maximus" className="h-14 w-14 object-contain" />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  Maximus Admin
                </p>
                <h2 className="mt-1 text-xl font-black">Atualização do sistema</h2>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-border bg-background p-4 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Versão atual</span>
                <strong>{state.currentVersion}</strong>
              </div>
              <div className="mt-2 flex justify-between gap-3">
                <span className="text-muted-foreground">Nova versão</span>
                <strong>{state.nextVersion ?? "Não encontrada"}</strong>
              </div>
            </div>

            {state.status === "available" && (
              <p className="mt-4 rounded-lg border border-primary/30 bg-primary/10 px-3 py-3 text-sm font-semibold">
                Atualização disponível. O download será iniciado automaticamente pelo app.
              </p>
            )}

            {state.status === "downloading" && (
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-sm font-semibold">
                  <span>Baixando atualização</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatBytes(state.transferred)} de {formatBytes(state.total)}
                  {state.bytesPerSecond > 0 ? ` · ${formatBytes(state.bytesPerSecond)}/s` : ""}
                </p>
              </div>
            )}

            {state.status === "downloaded" && (
              <p className="mt-4 rounded-lg border border-primary/30 bg-primary/10 px-3 py-3 text-sm font-semibold">
                Download concluído. Instalando atualização. O Maximus será reiniciado.
              </p>
            )}

            {state.status === "installing" && (
              <p className="mt-4 rounded-lg border border-primary/30 bg-primary/10 px-3 py-3 text-sm font-semibold">
                Instalando atualização...
              </p>
            )}

            {state.status === "error" && state.error && (
              <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm font-semibold text-destructive">
                {state.error}
              </p>
            )}

            {state.releaseNotes && (
              <div className="mt-4 max-h-32 overflow-auto rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
                {state.releaseNotes}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={!canClose(state.status)}
                onClick={() => setOpen(false)}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continuar usando
              </button>
              <button
                type="button"
                disabled={busy || state.status === "downloaded" || state.status === "installing"}
                onClick={handlePrimaryAction}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy && <RefreshCw className="h-4 w-4 animate-spin" />}
                {actionLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
