import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  Archive,
  Grid3x3,
  Settings,
  Truck,
  MapPinned,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { isFinalStatus } from "@/admin/data/statuses";
import { isPaymentPending, useAdmin } from "@/admin/store";
import type { AdminUnit } from "@/admin/data/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const logoUrl = "/branding/maximus-logo.png";
const SIDEBAR_COLLAPSED_KEY = "maximus-admin-sidebar-collapsed";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/admin/cardapio", label: "Cardápio", icon: BookOpen },
  { to: "/admin/finalizados", label: "Finalizados", icon: Archive },
  { to: "/admin/mesas", label: "Mesas", icon: Grid3x3 },
  { to: "/admin/entregadores", label: "Entregadores", icon: Truck },
  { to: "/admin/entrega", label: "Entrega", icon: MapPinned },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

function LogoMark({ src, className }: { src?: string; className: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${className} flex items-center justify-center rounded-lg border border-border bg-secondary text-[9px] font-black text-primary`}
      >
        MAXIMUS
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="Maximus Hamburgueria"
      className={`${className} object-contain`}
      onError={() => setFailed(true)}
    />
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const {
    orders,
    units,
    selectedUnit,
    selectUnit,
    clearSelectedUnit,
    authError,
    dataError,
    isLoading,
  } = useAdmin();
  const [pinUnit, setPinUnit] = useState<AdminUnit | null>(null);
  const [pin, setPin] = useState("");
  const [checkingPin, setCheckingPin] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  });

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const activeOrders = orders.filter((o) => !isFinalStatus(o.status)).length;
  const pendingPayments = orders.filter(isPaymentPending).length;
  const selectableUnits = units;

  const navCount = (to: string) => {
    if (to === "/admin/pedidos") return activeOrders;
    return null;
  };

  const isPedidosArea = location.pathname === "/admin/pedidos" || location.pathname.startsWith("/admin/pedidos/");
  const isActive = (to: string, exact?: boolean) =>
    exact
      ? location.pathname === to
      : location.pathname === to || location.pathname.startsWith(to + "/");

  if (!selectedUnit) {
    return (
      <div className="admin-root min-h-screen font-sora">
        <main className="flex min-h-screen items-center justify-center p-4">
          <section className="w-full max-w-3xl">
            <div className="mb-8 text-center">
              <LogoMark src={logoUrl} className="mx-auto h-16 w-16" />
              <h1 className="mt-4 text-3xl font-black tracking-tight">Escolha a unidade</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Selecione qual operação deseja gerenciar agora.
              </p>
            </div>

            {isLoading ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <p className="text-lg font-bold">Carregando unidades</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Buscando dados reais no Supabase.
                </p>
              </div>
            ) : dataError ? (
              <div className="rounded-xl border border-destructive/30 bg-card p-8 text-center">
                <p className="text-lg font-bold text-destructive">Erro ao carregar unidades</p>
                <p className="mt-2 text-sm text-muted-foreground">{dataError}</p>
              </div>
            ) : selectableUnits.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
                <p className="text-lg font-bold">Nenhuma unidade cadastrada</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Nenhuma unidade foi encontrada no Supabase.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {selectableUnits.map((unit) => (
                  <button
                    key={unit.id}
                    onClick={() => {
                      setPin("");
                      setPinUnit(unit);
                    }}
                    className="group rounded-xl border border-border bg-card p-6 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-accent"
                  >
                    <p className="text-xs font-bold uppercase tracking-widest text-primary">
                      {unit.isOpen ? "Aberta agora" : "Fechada"}
                    </p>
                    <h2 className="mt-3 text-2xl font-black">{unit.name}</h2>
                    <p className="mt-2 min-h-10 text-sm text-muted-foreground">{unit.address}</p>
                    <span className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground group-hover:opacity-90">
                      Entrar
                    </span>
                  </button>
                ))}
              </div>
            )}

            {pinUnit && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
                <form
                  className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setCheckingPin(true);
                    try {
                      if (await selectUnit(pinUnit.id, pin)) setPinUnit(null);
                    } finally {
                      setCheckingPin(false);
                    }
                  }}
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">
                    Acesso local
                  </p>
                  <h2 className="mt-2 text-xl font-black">{pinUnit.name}</h2>
                  <label className="mt-5 block text-sm font-semibold" htmlFor="admin-pin">
                    Senha numérica
                  </label>
                  <input
                    id="admin-pin"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pin}
                    onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-lg font-bold tracking-widest outline-none focus:border-primary"
                    autoFocus
                  />
                  {authError && (
                    <p className="mt-3 text-sm font-semibold text-destructive">{authError}</p>
                  )}
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPinUnit(null)}
                      className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={checkingPin}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                    >
                      {checkingPin ? "Validando..." : "Liberar painel"}
                    </button>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    A sessão é salva apenas neste navegador para teste local. Depois isso vira
                    Auth/RBAC no Supabase.
                  </p>
                </form>
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div
      className={`admin-root ${selectedUnit.theme === "dark" ? "admin-root--dark" : ""} min-h-screen font-sora`}
    >
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside
          className={`sticky top-0 hidden h-screen flex-col border-r border-border bg-card shadow-sm transition-[width] duration-200 ease-out md:flex ${
            isSidebarCollapsed ? "w-20" : "w-64"
          }`}
        >
          <TooltipProvider delayDuration={150}>
            <div
              className={`border-b border-border py-4 ${
                isSidebarCollapsed ? "px-3" : "px-5"
              }`}
            >
              <div
                className={`flex items-center gap-3 ${
                  isSidebarCollapsed ? "justify-center" : "justify-between"
                }`}
              >
                <LogoMark
                  src={logoUrl}
                  className={isSidebarCollapsed ? "h-9 w-9" : "h-14 w-14"}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setIsSidebarCollapsed((current) => !current)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label={isSidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
                    >
                      {isSidebarCollapsed ? (
                        <PanelLeftOpen className="h-4 w-4" />
                      ) : (
                        <PanelLeftClose className="h-4 w-4" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {isSidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
                  </TooltipContent>
                </Tooltip>
              </div>
              {!isSidebarCollapsed && (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold">{selectedUnit.name}</p>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                      Unidade atual
                    </p>
                  </div>
                  <button
                    onClick={clearSelectedUnit}
                    className="shrink-0 rounded-md bg-secondary px-2.5 py-1 text-xs font-bold hover:bg-accent"
                  >
                    Trocar
                  </button>
                </div>
              )}
            </div>
            <nav className={`flex-1 space-y-1 ${isSidebarCollapsed ? "p-3" : "p-3"}`}>
              {NAV.map(({ to, label, icon: Icon, exact }) => {
                const count = navCount(to);

                return (
                  <Tooltip key={to}>
                    <TooltipTrigger asChild>
                      <Link
                        to={to}
                        aria-label={label}
                        className={`relative flex items-center rounded-lg text-sm font-medium transition-colors ${
                          isSidebarCollapsed
                            ? "h-11 justify-center px-0"
                            : "gap-3 px-3 py-2.5"
                        } ${
                          isActive(to, exact)
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        {!isSidebarCollapsed && <span className="flex-1 truncate">{label}</span>}
                        {count != null && (
                          <span
                            className={`rounded-md bg-background/70 text-xs font-bold text-foreground ${
                              isSidebarCollapsed
                                ? "absolute right-1 top-1 min-w-5 px-1 py-0 text-center text-[10px]"
                                : "px-2 py-0.5"
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </Link>
                    </TooltipTrigger>
                    {isSidebarCollapsed && <TooltipContent side="right">{label}</TooltipContent>}
                  </Tooltip>
                );
              })}
            </nav>
            <div
              className={`border-t border-border text-[11px] text-muted-foreground ${
                isSidebarCollapsed ? "p-3" : "p-4"
              }`}
            >
              {!isSidebarCollapsed && (
                <>
                  <div className="mb-3 min-w-0">
                    <p className="truncate font-bold text-foreground">{profile?.fullName}</p>
                    <p className="uppercase tracking-widest">{profile?.role}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Pix pendentes</span>
                    <span className="rounded-md bg-primary/15 px-2 py-0.5 font-bold text-primary">
                      {pendingPayments}
                    </span>
                  </div>
                </>
              )}
              {isSidebarCollapsed && pendingPayments > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="mb-2 flex justify-center">
                      <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
                        {pendingPayments}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">Pix pendentes</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className={`flex items-center justify-center rounded-md bg-secondary text-xs font-bold text-foreground hover:bg-accent ${
                      isSidebarCollapsed ? "h-10 w-full p-0" : "mt-3 w-full gap-2 px-3 py-2"
                    }`}
                    aria-label="Sair"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {!isSidebarCollapsed && "Sair"}
                  </button>
                </TooltipTrigger>
                {isSidebarCollapsed && <TooltipContent side="right">Sair</TooltipContent>}
              </Tooltip>
            </div>
          </TooltipProvider>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile top nav */}
          <header className="md:hidden flex items-center gap-3 h-16 px-4 border-b border-border bg-card sticky top-0 z-20 backdrop-blur">
            <LogoMark src={logoUrl} className="h-9 w-9" />
            <span className="min-w-0 flex-1 truncate font-bold tracking-wide">
              {selectedUnit.name}
            </span>
            <button
              onClick={clearSelectedUnit}
              className="rounded-md bg-secondary px-2.5 py-1 text-xs font-bold"
            >
              Trocar
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-md bg-secondary p-2 text-muted-foreground"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </header>
          <nav className="md:hidden flex gap-1 overflow-x-auto px-3 py-2 border-b border-border bg-background">
            {NAV.map(({ to, label, icon: Icon, exact }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${
                  isActive(to, exact)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground bg-secondary/60"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {navCount(to) != null && (
                  <span className="rounded bg-background/70 px-1.5 text-[10px] font-bold text-foreground">
                    {navCount(to)}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <main
            className={`flex-1 w-full ${
              isPedidosArea ? "p-3 md:p-4 xl:p-5" : "mx-auto max-w-[1400px] p-4 md:p-8"
            }`}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
