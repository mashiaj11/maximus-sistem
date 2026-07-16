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
  Printer,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { isFinalStatus } from "@/admin/data/statuses";
import { isPaymentPending, useAdmin } from "@/admin/store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const logoUrl = "/branding/maximus-logo-transparent.png";
const SIDEBAR_COLLAPSED_KEY = "maximus-admin-sidebar-collapsed";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/admin/cardapio", label: "Cardápio", icon: BookOpen },
  { to: "/admin/finalizados", label: "Finalizados", icon: Archive },
  { to: "/admin/mesas", label: "Mesas", icon: Grid3x3 },
  { to: "/admin/entregadores", label: "Entregadores", icon: Truck },
  { to: "/admin/entrega", label: "Entrega", icon: MapPinned },
  { to: "/admin/impressao", label: "Impressão", icon: Printer },
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
      className={`${className} object-contain drop-shadow-[0_0_12px_rgba(255,61,0,0.22)]`}
      onError={() => setFailed(true)}
    />
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { orders, units, selectedUnit, selectUnit, dataError, isLoading } = useAdmin();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  });

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (!selectedUnit && units.length === 1) void selectUnit(units[0].id);
  }, [selectUnit, selectedUnit, units]);

  const activeOrders = orders.filter((o) => !isFinalStatus(o.status)).length;
  const pendingPayments = orders.filter(isPaymentPending).length;
  const selectableUnits = units;

  const navCount = (to: string) => {
    if (to === "/admin/pedidos") return activeOrders;
    return null;
  };

  const isPedidosArea =
    location.pathname === "/admin/pedidos" || location.pathname.startsWith("/admin/pedidos/");
  const isActive = (to: string, exact?: boolean) =>
    exact
      ? location.pathname === to
      : location.pathname === to || location.pathname.startsWith(to + "/");

  if (!selectedUnit) {
    return (
      <div className="admin-root min-h-screen font-sora">
        <main className="flex min-h-screen items-center justify-center p-4">
          <section className="w-full max-w-2xl">
            <div className="mb-5 text-center">
              <LogoMark src={logoUrl} className="mx-auto h-12 w-12" />
              <h1 className="mt-3 text-2xl font-black tracking-tight">Escolha a unidade</h1>
              <p className="mt-2 text-sm text-muted-foreground">Selecione a operação.</p>
            </div>

            {isLoading ? (
              <div className="rounded-lg border border-border bg-card p-5 text-center">
                <p className="text-base font-bold">Carregando unidades</p>
                <p className="mt-2 text-sm text-muted-foreground">Buscando dados.</p>
              </div>
            ) : dataError ? (
              <div className="rounded-lg border border-destructive/30 bg-card p-5 text-center">
                <p className="text-base font-bold text-destructive">Erro ao carregar unidades</p>
                <p className="mt-2 text-sm text-muted-foreground">{dataError}</p>
              </div>
            ) : selectableUnits.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card p-5 text-center">
                <p className="text-base font-bold">Nenhuma unidade cadastrada</p>
                <p className="mt-2 text-sm text-muted-foreground">Sem unidades disponíveis.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {selectableUnits.map((unit) => (
                  <button
                    key={unit.id}
                    onClick={() => void selectUnit(unit.id)}
                    className="group rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
                      {unit.isOpen ? "Aberta agora" : "Fechada"}
                    </p>
                    <h2 className="mt-2 text-lg font-black">{unit.name}</h2>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {unit.address}
                    </p>
                    <span className="mt-4 inline-flex rounded-md bg-primary px-3 py-1.5 text-xs font-extrabold text-primary-foreground group-hover:opacity-90">
                      Entrar
                    </span>
                  </button>
                ))}
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
          className={`sticky top-0 hidden h-screen flex-col border-r border-border bg-[#18191b] text-white transition-[width] duration-200 ease-out md:flex ${
            isSidebarCollapsed ? "w-16" : "w-56"
          }`}
        >
          <TooltipProvider delayDuration={150}>
            <div
              className={`border-b border-white/10 py-3 ${isSidebarCollapsed ? "px-2" : "px-3"}`}
            >
              <div
                className={`flex items-center gap-3 ${
                  isSidebarCollapsed ? "justify-center" : "justify-between"
                }`}
              >
                <LogoMark src={logoUrl} className={isSidebarCollapsed ? "h-8 w-8" : "h-10 w-10"} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setIsSidebarCollapsed((current) => !current)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/5 text-white/65 transition-colors hover:bg-white/10 hover:text-white"
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
                <div className="mt-3 flex items-center gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-white">
                      {selectedUnit.name}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-white/45">
                      Operação ativa
                    </p>
                  </div>
                </div>
              )}
            </div>
            <nav className={`flex-1 space-y-0.5 ${isSidebarCollapsed ? "p-2" : "p-2.5"}`}>
              {NAV.map(({ to, label, icon: Icon, exact }) => {
                const count = navCount(to);

                return (
                  <Tooltip key={to}>
                    <TooltipTrigger asChild>
                      <Link
                        to={to}
                        aria-label={label}
                        className={`relative flex items-center rounded-md text-xs font-semibold transition-colors ${
                          isSidebarCollapsed ? "h-10 justify-center px-0" : "gap-2.5 px-2.5 py-2"
                        } ${
                          isActive(to, exact)
                            ? "bg-primary text-primary-foreground"
                            : "text-white/68 hover:bg-white/7 hover:text-white"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!isSidebarCollapsed && <span className="flex-1 truncate">{label}</span>}
                        {count != null && (
                          <span
                            className={`rounded-md bg-black/25 text-xs font-bold text-white ${
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
              className={`border-t border-white/10 text-[11px] text-white/55 ${
                isSidebarCollapsed ? "p-2" : "p-3"
              }`}
            >
              {!isSidebarCollapsed && (
                <>
                  <div className="mb-3 min-w-0">
                    <p className="truncate font-bold text-white">{profile?.fullName}</p>
                    <p className="uppercase tracking-wide">{profile?.role}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Pix pendentes</span>
                    <span className="rounded-md bg-primary/20 px-2 py-0.5 font-bold text-primary">
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
                    className={`flex items-center justify-center rounded-md bg-white/5 text-xs font-bold text-white/85 hover:bg-white/10 ${
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
              isPedidosArea ? "p-3 md:p-4" : "mx-auto max-w-[1440px] p-3 md:p-5"
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
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight md:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
