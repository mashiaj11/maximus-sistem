import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  ChevronLeft,
  ClipboardList,
  DollarSign,
  LoaderCircle,
  LogOut,
  Minus,
  Plus,
  RefreshCcw,
  ShoppingCart,
  Store,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateUnitPrice,
  formatOptionPrice,
  getCustomizations,
  getDefaultSelections,
  getSelectionErrors,
} from "@/lib/cart-customization";
import { formatPrice } from "@/lib/supabase-data";
import type { Category, Product, ProductOptionGroup, SelectedOptions } from "@/lib/types";
import {
  closeWaiterSession,
  getActiveWaiterSessionByTable,
  getWaiterSessionDetail,
  listWaiterTableSnapshots,
  loadWaiterMenuData,
  openWaiterSession,
  readWaiterAuthState,
  signInWaiter,
  signOutWaiter,
  waiterCreateOrder,
  type WaiterAuthState,
  type WaiterSessionDetail,
  type WaiterTableSnapshot,
} from "@/lib/waiter";

export const Route = createFileRoute("/garcom")({
  head: () => ({
    meta: [
      { title: "Garçom · Maximus" },
      { name: "description", content: "Painel operacional do garçom da Maximus." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: WaiterRoute,
});

type OpenSessionForm = {
  customerName: string;
  notes: string;
};

type DraftItem = {
  quantity: number;
  notes: string;
  selections: SelectedOptions;
};

type OrderDraftMap = Record<string, DraftItem>;
type WaiterOrderMode = "dine_in" | "takeaway";

type TableStatusTone = {
  card: string;
  badge: string;
  label: string;
};

const INITIAL_OPEN_FORM: OpenSessionForm = {
  customerName: "",
  notes: "",
};

function getTableStatusTone(statusKey: string): TableStatusTone {
  const tones: Record<string, TableStatusTone> = {
    livre: {
      card: "border-emerald-500/35 bg-card hover:border-emerald-400/60",
      badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      label: "Livre",
    },
    ocupada: {
      card: "border-amber-500/35 bg-amber-500/10 hover:border-amber-400/60",
      badge: "border-amber-500/30 bg-amber-500/10 text-amber-200",
      label: "Ocupada",
    },
    pedido_ativo: {
      card: "border-orange-500/35 bg-orange-500/10 hover:border-orange-400/60",
      badge: "border-orange-500/30 bg-orange-500/10 text-orange-200",
      label: "Pedido ativo",
    },
    em_preparo: {
      card: "border-sky-500/35 bg-sky-500/10 hover:border-sky-400/60",
      badge: "border-sky-500/30 bg-sky-500/10 text-sky-200",
      label: "Em preparo",
    },
    pronto: {
      card: "border-emerald-400/45 bg-emerald-500/10 hover:border-emerald-300/70",
      badge: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
      label: "Pronto",
    },
    conta_solicitada: {
      card: "border-fuchsia-500/35 bg-fuchsia-500/10 hover:border-fuchsia-400/60",
      badge: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200",
      label: "Conta solicitada",
    },
  };

  return tones[statusKey] ?? tones.ocupada;
}

function getTableStatusKey(statusKey: string) {
  if (statusKey === "closed" || statusKey === "fechada" || statusKey === "finalizada") {
    return "livre";
  }
  return statusKey;
}

function getSessionTotal(sessionLike: {
  total?: number | null;
  orders?: Array<{ total?: number | null }>;
  raw?: Record<string, unknown>;
}) {
  const raw = sessionLike.raw ?? {};
  const session =
    raw.session && typeof raw.session === "object" ? (raw.session as Record<string, unknown>) : {};
  const snapshotValue = [session.total_snapshot, raw.total_snapshot, sessionLike.total].find(
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
  );

  if (typeof snapshotValue === "number" && Number.isFinite(snapshotValue) && snapshotValue > 0) {
    return snapshotValue;
  }

  const ordersTotal =
    sessionLike.orders?.reduce(
      (sum, order) => sum + (order.total && order.total > 0 ? order.total : 0),
      0,
    ) ?? 0;

  return ordersTotal > 0 ? ordersTotal : 0;
}

function getOrderTypeLabel(orderType?: WaiterOrderMode) {
  return orderType === "takeaway" ? "Para levar" : "Mesa";
}

function WaiterRoute() {
  const [auth, setAuth] = useState<WaiterAuthState>({
    status: "loading",
    session: null,
    user: null,
    profile: null,
    units: [],
    unitAccess: [],
    error: null,
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [activeUnitId, setActiveUnitId] = useState("");
  const [tables, setTables] = useState<WaiterTableSnapshot[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState<WaiterTableSnapshot | null>(null);
  const [sessionDetail, setSessionDetail] = useState<WaiterSessionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [openForm, setOpenForm] = useState<OpenSessionForm>(INITIAL_OPEN_FORM);
  const [openingSession, setOpeningSession] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [isUnitOpenForOrders, setIsUnitOpenForOrders] = useState(true);
  const [menuUnitName, setMenuUnitName] = useState<string | null>(null);
  const [orderDraft, setOrderDraft] = useState<OrderDraftMap>({});
  const [orderNotes, setOrderNotes] = useState("");
  const [sendingOrder, setSendingOrder] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [closingSession, setClosingSession] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [orderMode, setOrderMode] = useState<WaiterOrderMode>("dine_in");
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [customizingSelections, setCustomizingSelections] = useState<SelectedOptions>({});
  const [customizingNotes, setCustomizingNotes] = useState("");
  const [customizingQuantity, setCustomizingQuantity] = useState(1);

  const refreshAuth = useCallback(async () => {
    setAuth((current) => ({
      status: "loading",
      session: current.session,
      user: current.user,
      profile: null,
      units: current.units,
      unitAccess: current.unitAccess,
      error: current.error,
    }));
    const nextState = await readWaiterAuthState();
    setAuth(nextState);
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const preferredUnitId =
      auth.unitAccess.find((item) => item.isPrimary)?.unitId ?? auth.units[0]?.id ?? "";
    setActiveUnitId((current) =>
      current && auth.units.some((unit) => unit.id === current) ? current : preferredUnitId,
    );
  }, [auth]);

  const refreshTables = useCallback(
    async (unitId = activeUnitId) => {
      if (!unitId) return;
      setLoadingTables(true);
      try {
        const nextTables = await listWaiterTableSnapshots(unitId);
        setTables(nextTables);
        setSelectedTable((current) =>
          current
            ? (nextTables.find((table) => table.tableId === current.tableId) ?? current)
            : null,
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível carregar as mesas.");
      } finally {
        setLoadingTables(false);
      }
    },
    [activeUnitId],
  );

  useEffect(() => {
    if (auth.status !== "authenticated" || !activeUnitId) return;
    void refreshTables(activeUnitId);
  }, [activeUnitId, auth.status, refreshTables]);

  useEffect(() => {
    if (auth.status !== "authenticated" || !activeUnitId) return;
    setLoadingMenu(true);
    loadWaiterMenuData(activeUnitId)
      .then((menu) => {
        setCategories(menu.categories);
        setProducts(menu.products);
        setIsUnitOpenForOrders(menu.isUnitOpen);
        setMenuUnitName(menu.unitName ?? null);
        setActiveCategoryId((current) =>
          current && menu.categories.some((category) => category.id === current)
            ? current
            : (menu.categories[0]?.id ?? null),
        );
      })
      .catch((error) => {
        toast.error(
          error instanceof Error ? error.message : "Não foi possível carregar o cardápio interno.",
        );
      })
      .finally(() => setLoadingMenu(false));
  }, [activeUnitId, auth.status]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const categoryMatch = activeCategoryId ? product.category === activeCategoryId : true;
      return categoryMatch && product.availableForDineIn !== false;
    });
  }, [activeCategoryId, products]);

  const draftItems = useMemo(
    () =>
      products
        .filter((product) => (orderDraft[product.id]?.quantity ?? 0) > 0)
        .map((product) => ({
          product,
          quantity: orderDraft[product.id]?.quantity ?? 0,
          notes: orderDraft[product.id]?.notes ?? "",
          selections: orderDraft[product.id]?.selections ?? getDefaultSelections(product),
          unitPrice: calculateUnitPrice(
            product,
            orderDraft[product.id]?.selections ?? getDefaultSelections(product),
          ),
          customizations: getCustomizations(
            product,
            orderDraft[product.id]?.selections ?? getDefaultSelections(product),
          ),
        })),
    [orderDraft, products],
  );

  const draftTotal = useMemo(
    () => draftItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [draftItems],
  );

  const unfinishedOrders = useMemo(() => {
    if (!sessionDetail) return [];
    const finalStatuses = new Set([
      "delivered_to_table",
      "delivered",
      "picked_up",
      "closed",
      "cancelled",
      "billed",
    ]);
    return sessionDetail.orders.filter((order) => {
      const key = order.rawStatus?.trim().toLowerCase();
      if (key) return !finalStatuses.has(key);
      return !["entregue na mesa", "entregue", "retirado", "fechada", "cancelado"].includes(
        order.status.trim().toLowerCase(),
      );
    });
  }, [sessionDetail]);

  const loggedWaiterName =
    auth.status === "authenticated" ? auth.profile.fullName : (auth.user?.email ?? "Equipe");
  const compactUserLabel =
    auth.status === "authenticated" ? auth.profile.fullName || auth.user?.email || "-" : "-";
  const customizationErrors = useMemo(
    () => (customizingProduct ? getSelectionErrors(customizingProduct, customizingSelections) : []),
    [customizingProduct, customizingSelections],
  );
  const customizationTotal = useMemo(
    () => (customizingProduct ? calculateUnitPrice(customizingProduct, customizingSelections) : 0),
    [customizingProduct, customizingSelections],
  );
  const selectedSessionTotal = useMemo(
    () => (sessionDetail ? getSessionTotal(sessionDetail) : 0),
    [sessionDetail],
  );

  function resetCustomization(product: Product, draft?: DraftItem) {
    setCustomizingProduct(product);
    setCustomizingSelections(draft?.selections ?? getDefaultSelections(product));
    setCustomizingNotes(draft?.notes ?? "");
    setCustomizingQuantity(Math.max(1, draft?.quantity ?? 1));
  }

  function closeCustomization() {
    setCustomizingProduct(null);
    setCustomizingSelections({});
    setCustomizingNotes("");
    setCustomizingQuantity(1);
  }

  async function openTable(snapshot: WaiterTableSnapshot) {
    setSelectedTable(snapshot);
    setShowOrderForm(Boolean(snapshot.activeSessionId));
    setOrderDraft({});
    setOrderNotes("");
    setOrderMode("dine_in");
    setConfirmCloseOpen(false);

    if (!snapshot.activeSessionId) {
      setSessionDetail(null);
      setOpenForm({
        customerName: snapshot.customerName ?? "",
        notes: "",
      });
      return;
    }

    setLoadingDetail(true);
    try {
      const detail = await getWaiterSessionDetail(snapshot.activeSessionId);
      setSessionDetail(detail);
      setOpenForm({
        customerName: detail.customerName ?? "",
        notes: detail.notes ?? "",
      });
    } catch (error) {
      setSessionDetail(null);
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar a comanda.");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function refreshSelectedTable() {
    if (!selectedTable) return;
    setLoadingDetail(true);
    try {
      const detail = selectedTable.activeSessionId
        ? await getWaiterSessionDetail(selectedTable.activeSessionId)
        : await getActiveWaiterSessionByTable(selectedTable.tableId);
      setSessionDetail(detail);
      if (!detail) {
        setSelectedTable((current) => (current ? { ...current, activeSessionId: null } : current));
      }
      await refreshTables();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a mesa.");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setLoggingIn(true);
    try {
      await signInWaiter(email.trim(), password);
      await refreshAuth();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOutWaiter();
      setTables([]);
      setSelectedTable(null);
      setSessionDetail(null);
      setProducts([]);
      setCategories([]);
      await refreshAuth();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível sair.");
    }
  }

  async function handleOpenSession() {
    if (!selectedTable) return;
    setOpeningSession(true);
    try {
      const detail = await openWaiterSession({
        tableId: selectedTable.tableId,
        customerName: openForm.customerName,
        notes: openForm.notes,
      });
      if (!detail) {
        throw new Error("A comanda foi aberta, mas não foi possível carregar os detalhes.");
      }
      setSessionDetail(detail);
      setShowOrderForm(true);
      setOrderMode("dine_in");
      await refreshTables();
      toast.success(`Comanda da mesa ${selectedTable.tableNumber} aberta.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir a comanda.");
    } finally {
      setOpeningSession(false);
    }
  }

  async function handleCloseSession() {
    if (!sessionDetail?.id || !selectedTable) return;
    setClosingSession(true);
    try {
      await closeWaiterSession({ sessionId: sessionDetail.id, notes: null });
      setConfirmCloseOpen(false);
      setSessionDetail(null);
      setShowOrderForm(false);
      setOrderDraft({});
      setOrderNotes("");
      await refreshTables();
      setSelectedTable((current) =>
        current
          ? {
              ...current,
              activeSessionId: null,
              customerName: undefined,
              waiterName: undefined,
              status: "Livre",
              statusKey: "livre",
              total: 0,
              orderCount: 0,
              lastOrderStatus: null,
            }
          : null,
      );
      toast.success("Comanda finalizada e mesa liberada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível finalizar a comanda.");
    } finally {
      setClosingSession(false);
    }
  }

  async function handleCreateOrder() {
    if (!selectedTable || !sessionDetail?.id || draftItems.length === 0) return;
    setSendingOrder(true);
    try {
      await waiterCreateOrder({
        unitId: activeUnitId,
        tableId: selectedTable.tableId,
        tableSessionId: sessionDetail.id,
        customerName: sessionDetail.customerName,
        notes: orderNotes,
        orderType: orderMode,
        items: draftItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          notes: item.notes,
          selections: item.selections,
        })),
      });
      setOrderDraft({});
      setOrderNotes("");
      setShowOrderForm(false);
      await refreshSelectedTable();
      await refreshTables();
      toast.success("Pedido criado com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o pedido.");
    } finally {
      setSendingOrder(false);
    }
  }

  function changeProductQuantity(productId: string, delta: number) {
    setOrderDraft((current) => {
      const currentItem = current[productId] ?? {
        quantity: 0,
        notes: "",
        selections: {},
      };
      const nextQuantity = Math.max(0, currentItem.quantity + delta);
      const next = { ...current };
      if (nextQuantity === 0) delete next[productId];
      else next[productId] = { ...currentItem, quantity: nextQuantity };
      return next;
    });
  }

  function changeProductNotes(productId: string, notes: string) {
    setOrderDraft((current) => {
      const currentItem = current[productId] ?? {
        quantity: 0,
        notes: "",
        selections: {},
      };
      return {
        ...current,
        [productId]: {
          ...currentItem,
          notes,
        },
      };
    });
  }

  function openCustomization(product: Product) {
    resetCustomization(product, orderDraft[product.id]);
  }

  function saveCustomization() {
    if (!customizingProduct) return;
    if (customizationErrors.length > 0) {
      toast.error(customizationErrors[0]);
      return;
    }

    setOrderDraft((current) => ({
      ...current,
      [customizingProduct.id]: {
        quantity: customizingQuantity,
        notes: customizingNotes,
        selections: customizingSelections,
      },
    }));
    closeCustomization();
  }

  if (auth.status === "loading") {
    return <LoadingScreen label="Carregando acesso do garçom..." />;
  }

  if (auth.status === "unauthenticated") {
    return (
      <main className="min-h-screen bg-background px-3 py-5 sm:px-4 sm:py-8">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-2xl sm:rounded-3xl sm:p-6">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="rounded-xl bg-primary/15 p-2.5 text-primary sm:rounded-2xl sm:p-3">
              <UtensilsCrossed className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Maximus</p>
              <h1 className="text-2xl font-black">Painel do garçom</h1>
            </div>
          </div>

          <form className="mt-6 space-y-4 sm:mt-8 sm:space-y-5" onSubmit={handleLogin}>
            <div className="space-y-2">
              <Label htmlFor="waiter-email">E-mail</Label>
              <Input
                id="waiter-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-10 sm:h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="waiter-password">Senha</Label>
              <Input
                id="waiter-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-10 sm:h-11"
              />
            </div>

            {(submitError || auth.error) && (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
                {submitError ?? auth.error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loggingIn}>
              {loggingIn ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </div>
      </main>
    );
  }

  if (auth.status === "forbidden" || auth.status === "blocked") {
    return (
      <main className="min-h-screen bg-background px-3 py-5 sm:px-4 sm:py-8">
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-4 sm:rounded-3xl sm:p-6">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="rounded-xl bg-destructive/10 p-2.5 text-destructive sm:rounded-2xl sm:p-3">
              <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                Acesso bloqueado
              </p>
              <h1 className="mt-2 text-2xl font-black">Você não pode usar este painel</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {auth.error ?? "Seu usuário não possui permissão para acessar o módulo do garçom."}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <Button variant="outline" onClick={handleSignOut}>
              Sair
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-4">
          <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-end md:justify-between md:gap-4">
            <div className="min-w-0 overflow-hidden">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Maximus</p>
              <h1 className="text-xl font-black leading-none sm:text-2xl">Garçom</h1>
              <p className="mt-1 truncate text-xs text-muted-foreground">{compactUserLabel}</p>
              <p className="truncate text-[11px] uppercase tracking-[0.12em] text-muted-foreground/80">
                {auth.profile.role}
              </p>
            </div>

            <div className="flex w-full min-w-0 flex-col gap-2 md:w-auto md:flex-row md:items-center md:gap-3">
              <div className="w-full min-w-0 md:min-w-[220px]">
                <Select value={activeUnitId} onValueChange={setActiveUnitId}>
                  <SelectTrigger className="h-9 w-full max-w-full bg-card text-sm">
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {auth.units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-9 w-full md:w-auto"
                onClick={() => void refreshTables()}
              >
                <RefreshCcw className="h-4 w-4" />
                Atualizar
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-9 w-full md:w-auto"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        {!selectedTable && (
          <section className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Mesas</p>
                <h2 className="text-lg font-black sm:text-xl">Operação da unidade</h2>
              </div>
              {loadingTables && (
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground sm:text-sm">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Atualizando
                </div>
              )}
            </div>

            {tables.length === 0 && !loadingTables ? (
              <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground sm:rounded-3xl sm:p-6">
                Nenhuma mesa encontrada para esta unidade.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6 xl:grid-cols-8">
                {tables.map((table) => {
                  const tone = getTableStatusTone(getTableStatusKey(table.statusKey));
                  return (
                    <button
                      key={`${table.tableId}-${table.tableNumber}`}
                      onClick={() => void openTable(table)}
                      className={`min-w-0 overflow-hidden rounded-xl border p-3 text-left transition-colors sm:rounded-2xl sm:p-3.5 ${tone.card}`}
                    >
                      <div className="flex min-w-0 flex-col gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/90">
                          Mesa
                        </p>
                        <h3 className="text-2xl font-black leading-none sm:text-3xl">
                          {table.tableNumber}
                        </h3>
                        <div>
                          <StatusBadge statusKey={table.statusKey} label={table.status} compact />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {selectedTable && (
          <section className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-2.5 sm:rounded-3xl sm:p-4">
            {
              <div className="space-y-2.5 sm:space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                      Detalhe da mesa
                    </p>
                    <h2 className="mt-1 text-xl font-black sm:text-2xl">
                      Mesa {selectedTable.tableNumber}
                    </h2>
                    <div className="mt-1">
                      <StatusBadge
                        statusKey={selectedTable.statusKey}
                        label={selectedTable.status}
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      setSelectedTable(null);
                      setSessionDetail(null);
                      setShowOrderForm(false);
                    }}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                </div>

                {loadingDetail ? (
                  <div className="rounded-xl border border-border bg-background px-3 py-5 text-xs text-muted-foreground sm:rounded-2xl sm:px-4 sm:py-6 sm:text-sm">
                    Carregando detalhes da mesa...
                  </div>
                ) : sessionDetail ? (
                  <>
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                      <InfoCard
                        icon={<Store className="h-4 w-4" />}
                        label="Comanda"
                        value={sessionDetail.id.slice(0, 8)}
                      />
                      <InfoCard
                        icon={<DollarSign className="h-4 w-4" />}
                        label="Total"
                        value={formatPrice(selectedSessionTotal)}
                      />
                      <InfoCard
                        icon={<UserRound className="h-4 w-4" />}
                        label="Cliente"
                        value={sessionDetail.customerName ?? "-"}
                      />
                      <InfoCard
                        icon={<ClipboardList className="h-4 w-4" />}
                        label="Pedidos"
                        value={String(sessionDetail.orders.length)}
                      />
                    </div>

                    <div className="rounded-xl border border-border bg-background p-2.5 text-xs sm:rounded-2xl sm:p-3 sm:text-sm">
                      <p className="font-bold">Atendido por</p>
                      <p className="mt-2 text-muted-foreground">
                        {sessionDetail.waiterName ?? selectedTable.waiterName ?? loggedWaiterName}
                      </p>
                      {sessionDetail.notes && (
                        <>
                          <p className="mt-4 font-bold">Observações</p>
                          <p className="mt-2 text-muted-foreground">{sessionDetail.notes}</p>
                        </>
                      )}
                    </div>

                    <div className="grid gap-1.5 sm:grid-cols-3 sm:gap-2">
                      <Button
                        className="h-9 w-full"
                        onClick={() => setShowOrderForm((current) => !current)}
                      >
                        <ShoppingCart className="h-4 w-4" />
                        {showOrderForm ? "Ver comanda" : "Escolher pedido"}
                      </Button>
                      <Button
                        className="h-9 w-full"
                        onClick={() => setConfirmCloseOpen(true)}
                        disabled={closingSession}
                      >
                        <DollarSign className="h-4 w-4" />
                        {closingSession ? "Finalizando..." : "Finalizar comanda"}
                      </Button>
                      <Button
                        className="h-9 w-full"
                        variant="outline"
                        onClick={() => void refreshSelectedTable()}
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Recarregar mesa
                      </Button>
                    </div>

                    {showOrderForm ? (
                      <div className="space-y-2.5 rounded-xl border border-primary/30 bg-primary/5 p-2.5 sm:space-y-3 sm:rounded-2xl sm:p-3">
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                              Escolher pedido
                            </p>
                            <p className="text-xs text-muted-foreground sm:text-sm">
                              Selecione os itens para a comanda da mesa.
                            </p>
                          </div>
                          {loadingMenu && <LoaderCircle className="h-4 w-4 animate-spin" />}
                        </div>

                        {!isUnitOpenForOrders && (
                          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs sm:rounded-2xl sm:p-4 sm:text-sm">
                            <p className="font-bold text-foreground">Hamburgueria fechada</p>
                            <p className="mt-2 text-muted-foreground">
                              {menuUnitName ?? "Esta unidade"} estÃ¡ fora do horÃ¡rio de
                              atendimento. NÃ£o Ã© possÃ­vel lanÃ§ar novos pedidos agora.
                            </p>
                          </div>
                        )}

                        {isUnitOpenForOrders && (
                          <>
                            <div className="flex gap-1 overflow-x-auto pb-1 sm:gap-2">
                              {categories.map((category) => (
                                <button
                                  key={category.id}
                                  type="button"
                                  onClick={() => setActiveCategoryId(category.id)}
                                  className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold whitespace-nowrap sm:px-3 sm:py-2 sm:text-xs ${
                                    activeCategoryId === category.id
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border bg-background text-foreground"
                                  }`}
                                >
                                  {category.label}
                                </button>
                              ))}
                            </div>

                            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-background p-1">
                              <button
                                type="button"
                                onClick={() => setOrderMode("dine_in")}
                                className={`rounded-md px-2 py-1.5 text-xs font-bold transition-colors ${
                                  orderMode === "dine_in"
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground"
                                }`}
                              >
                                Mesa
                              </button>
                              <button
                                type="button"
                                onClick={() => setOrderMode("takeaway")}
                                className={`rounded-md px-2 py-1.5 text-xs font-bold transition-colors ${
                                  orderMode === "takeaway"
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground"
                                }`}
                              >
                                Para levar
                              </button>
                            </div>
                          </>
                        )}

                        {isUnitOpenForOrders && (
                          <div className="grid gap-1.5 sm:gap-2">
                            {filteredProducts.map((product) => {
                              const quantity = orderDraft[product.id]?.quantity ?? 0;
                              const hasOptions = (product.optionGroups?.length ?? 0) > 0;
                              return (
                                <article
                                  key={product.id}
                                  className="min-w-0 overflow-hidden rounded-xl border border-border bg-background p-2 sm:rounded-2xl sm:p-2.5"
                                >
                                  <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-2 sm:grid-cols-[80px_minmax(0,1fr)] sm:gap-2.5">
                                    <ProductThumb product={product} />

                                    <div className="min-w-0 space-y-1.5">
                                      <div className="min-w-0">
                                        <p className="line-clamp-2 text-xs font-bold leading-tight sm:text-sm">
                                          {product.name}
                                        </p>
                                        <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
                                          {product.description || "Sem descrição cadastrada."}
                                        </p>
                                      </div>
                                      <span className="block text-xs font-black text-primary sm:text-sm">
                                        {formatPrice(product.price)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="mt-1.5 space-y-1.5 sm:space-y-2">
                                    {hasOptions ? (
                                      <div className="min-w-0">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          className="h-8 w-full text-xs"
                                          onClick={() => openCustomization(product)}
                                        >
                                          {quantity > 0 ? "Editar item" : "Personalizar"}
                                        </Button>
                                        {quantity > 0 && (
                                          <p className="mt-1 text-[10px] text-muted-foreground">
                                            {quantity} selecionado(s)
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex items-center gap-1.5">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7 shrink-0"
                                            onClick={() => changeProductQuantity(product.id, -1)}
                                          >
                                            <Minus className="h-3 w-3" />
                                          </Button>
                                          <span className="w-6 text-center text-xs font-bold">
                                            {quantity}
                                          </span>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7 shrink-0"
                                            onClick={() => changeProductQuantity(product.id, 1)}
                                          >
                                            <Plus className="h-3 w-3" />
                                          </Button>
                                        </div>

                                        {quantity > 0 && (
                                          <div className="space-y-1">
                                            <Label htmlFor={`notes-${product.id}`}>
                                              Observação do item
                                            </Label>
                                            <Textarea
                                              id={`notes-${product.id}`}
                                              value={orderDraft[product.id]?.notes ?? ""}
                                              onChange={(event) =>
                                                changeProductNotes(product.id, event.target.value)
                                              }
                                              placeholder="Ex.: sem cebola"
                                            />
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        )}

                        <div className="space-y-1">
                          <Label htmlFor="order-notes">Observação geral do pedido</Label>
                          <Textarea
                            id="order-notes"
                            value={orderNotes}
                            onChange={(event) => setOrderNotes(event.target.value)}
                            placeholder="Observações gerais da comanda."
                          />
                        </div>

                        <div className="rounded-xl border border-border bg-background p-2.5 sm:rounded-2xl sm:p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-bold">Resumo do pedido</p>
                            <span className="text-xs font-bold sm:text-sm">
                              {formatPrice(draftTotal)}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1.5 text-xs sm:space-y-2 sm:text-sm">
                            {draftItems.length === 0 ? (
                              <p className="text-muted-foreground">Nenhum item selecionado.</p>
                            ) : (
                              draftItems.map((item) => (
                                <div
                                  key={item.product.id}
                                  className="rounded-lg border border-border p-2 sm:rounded-xl sm:p-2.5"
                                >
                                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                                    <span className="min-w-0 break-words">
                                      {item.quantity}x {item.product.name}
                                    </span>
                                    <span className="shrink-0 font-bold">
                                      {formatPrice(item.unitPrice * item.quantity)}
                                    </span>
                                  </div>
                                  {item.customizations.length > 0 && (
                                    <div className="mt-1.5 space-y-1 text-[10px] text-muted-foreground sm:text-[11px]">
                                      {item.customizations.map((group) => (
                                        <p key={group.groupId} className="break-words">
                                          {group.groupTitle}:{" "}
                                          {group.options.map((option) => option.label).join(", ")}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                  {item.notes && (
                                    <p className="mt-1.5 break-words text-[10px] text-muted-foreground sm:text-xs">
                                      {item.notes}
                                    </p>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <Button
                          className="h-9 w-full"
                          onClick={handleCreateOrder}
                          disabled={sendingOrder || draftItems.length === 0 || !isUnitOpenForOrders}
                        >
                          {sendingOrder ? "Enviando..." : "Enviar pedido"}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2.5 sm:space-y-3">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                          Pedidos da comanda
                        </p>
                        {sessionDetail.orders.length === 0 ? (
                          <div className="rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground sm:rounded-2xl sm:p-4 sm:text-sm">
                            Nenhum pedido encontrado nesta comanda.
                          </div>
                        ) : (
                          sessionDetail.orders.map((order) => (
                            <div
                              key={order.id}
                              className="rounded-xl border border-border bg-background p-2.5 sm:rounded-2xl sm:p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold">Pedido {order.orderNumber}</p>
                                    <OrderTypeBadge orderType={order.orderType} />
                                  </div>
                                  <p className="text-xs text-muted-foreground sm:text-sm">
                                    {order.status}
                                  </p>
                                </div>
                                <span className="shrink-0 text-xs font-bold sm:text-sm">
                                  {formatPrice(order.total)}
                                </span>
                              </div>
                              {order.notes && (
                                <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
                                  {order.notes}
                                </p>
                              )}
                              <div className="mt-2 space-y-1.5 sm:space-y-2">
                                {order.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="rounded-lg border border-border p-2 text-xs sm:rounded-xl sm:p-2.5 sm:text-sm"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="break-words">
                                          {item.quantity}x {item.name}
                                        </p>
                                        {item.notes ? (
                                          <p className="mt-1 text-muted-foreground">{item.notes}</p>
                                        ) : null}
                                      </div>
                                      <span className="shrink-0">
                                        {item.totalPrice ? formatPrice(item.totalPrice) : "-"}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground sm:rounded-2xl sm:p-4 sm:text-sm">
                      Mesa livre. Abra a comanda para começar o atendimento.
                    </div>

                    <div className="space-y-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3 sm:space-y-3 sm:rounded-2xl sm:p-4">
                      <p className="font-bold">Abrir comanda</p>

                      <div className="space-y-2">
                        <Label htmlFor="customerName">Nome da pessoa</Label>
                        <Input
                          id="customerName"
                          value={openForm.customerName}
                          onChange={(event) =>
                            setOpenForm((current) => ({
                              ...current,
                              customerName: event.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="open-notes">Observações</Label>
                        <Textarea
                          id="open-notes"
                          value={openForm.notes}
                          onChange={(event) =>
                            setOpenForm((current) => ({
                              ...current,
                              notes: event.target.value,
                            }))
                          }
                          placeholder="Observações da comanda."
                        />
                      </div>

                      <Button
                        className="w-full"
                        onClick={handleOpenSession}
                        disabled={openingSession}
                      >
                        {openingSession ? "Abrindo..." : "Abrir comanda"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            }
          </section>
        )}
      </div>

      <Dialog
        open={Boolean(customizingProduct)}
        onOpenChange={(open) => {
          if (!open) closeCustomization();
        }}
      >
        <DialogContent className="max-h-[88svh] max-w-md overflow-hidden p-0">
          {customizingProduct && (
            <>
              <DialogHeader className="border-b border-border px-3 py-2.5 text-left">
                <DialogTitle className="text-base font-black">
                  {customizingProduct.name}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Escolha as opções do item antes de adicionar à comanda.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 overflow-y-auto px-3 py-3">
                <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 sm:grid-cols-[88px_minmax(0,1fr)]">
                  <ProductThumb product={customizingProduct} />
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                      {customizingProduct.description || "Sem descrição cadastrada."}
                    </p>
                    <p className="mt-1 text-sm font-black text-primary sm:text-base">
                      {formatPrice(customizationTotal)}
                    </p>
                  </div>
                </div>

                {(customizingProduct.optionGroups ?? []).map((group) => (
                  <OptionGroupField
                    key={group.id}
                    group={group}
                    selections={customizingSelections}
                    onChange={setCustomizingSelections}
                  />
                ))}

                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setCustomizingQuantity((current) => Math.max(1, current - 1))}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-xs font-bold sm:text-sm">
                      {customizingQuantity}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setCustomizingQuantity((current) => current + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customizing-notes">Observação do item</Label>
                  <Textarea
                    id="customizing-notes"
                    value={customizingNotes}
                    onChange={(event) => setCustomizingNotes(event.target.value)}
                    placeholder="Ex.: sem cebola, ponto da carne, etc."
                  />
                </div>
              </div>

              <DialogFooter className="border-t border-border p-3">
                <div className="w-full space-y-2">
                  {customizationErrors[0] && (
                    <p className="text-xs font-semibold text-destructive">
                      {customizationErrors[0]}
                    </p>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button type="button" variant="outline" onClick={closeCustomization}>
                      Cancelar
                    </Button>
                    <Button type="button" onClick={saveCustomization}>
                      Salvar item
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent className="max-w-md rounded-3xl border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar comanda</AlertDialogTitle>
            <AlertDialogDescription>
              Confira os dados antes de liberar a mesa.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2.5 rounded-xl border border-border bg-card p-3 text-xs sm:space-y-3 sm:rounded-2xl sm:p-4 sm:text-sm">
            <DetailLine label="Mesa" value={selectedTable?.tableNumber ?? "-"} />
            <DetailLine label="Cliente" value={sessionDetail?.customerName ?? "-"} />
            <DetailLine
              label="Garçom"
              value={sessionDetail?.waiterName ?? selectedTable?.waiterName ?? loggedWaiterName}
            />
            <DetailLine
              label="Total"
              value={sessionDetail ? formatPrice(selectedSessionTotal) : "-"}
            />
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold text-foreground">Ao finalizar, a mesa será liberada.</p>
            {unfinishedOrders.length > 0 && (
              <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-200">
                Ainda existem pedidos não finalizados nesta comanda. Deseja finalizar mesmo assim?
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={closingSession}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseSession} disabled={closingSession}>
              {closingSession ? "Finalizando..." : "Confirmar finalização"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground sm:gap-3 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-sm">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        {label}
      </div>
    </main>
  );
}

function EmptyDetail() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background px-4 py-8 text-center sm:min-h-[420px] sm:rounded-3xl sm:px-6 sm:py-10">
      <div className="rounded-xl bg-primary/10 p-3 text-primary sm:rounded-2xl sm:p-4">
        <UtensilsCrossed className="h-6 w-6 sm:h-8 sm:w-8" />
      </div>
      <h2 className="mt-3 text-lg font-black sm:mt-4 sm:text-xl">Selecione uma mesa</h2>
      <p className="mt-2 max-w-sm text-xs text-muted-foreground sm:text-sm">
        Abra uma mesa para ver a comanda ativa, lançar pedidos pelo cardápio interno e finalizar o
        atendimento.
      </p>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-2.5 text-xs sm:gap-3 sm:text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-medium">{value}</span>
    </div>
  );
}

function StatusBadge({
  statusKey,
  label: _label,
  compact = false,
}: {
  statusKey: string;
  label: string;
  compact?: boolean;
}) {
  const tone = getTableStatusTone(getTableStatusKey(statusKey));
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border font-bold ${
        compact
          ? "px-1.5 py-0.5 text-[9px] leading-none sm:px-2.5 sm:py-1 sm:text-xs"
          : "px-2 py-0.5 text-[11px] sm:px-2.5 sm:py-1 sm:text-xs"
      } ${tone.badge}`}
      title={tone.label}
    >
      <span
        className={`block ${
          compact ? "max-w-[46px] truncate sm:max-w-none" : "max-w-full truncate"
        }`}
      >
        {tone.label}
      </span>
    </span>
  );
}

function OrderTypeBadge({ orderType }: { orderType?: WaiterOrderMode }) {
  const takeaway = orderType === "takeaway";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
        takeaway
          ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      }`}
    >
      {getOrderTypeLabel(orderType)}
    </span>
  );
}

function ProductThumb({ product }: { product: Product }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageSrc = (product.imageUrl ?? product.image_url ?? "").trim();

  if (imageSrc && !imageFailed) {
    return (
      <img
        src={imageSrc}
        alt={product.name}
        className="h-[72px] w-[72px] rounded-md border border-border object-cover sm:h-20 sm:w-20 sm:rounded-xl"
        loading="lazy"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div className="flex h-[72px] w-[72px] items-center justify-center rounded-md border border-dashed border-border bg-card text-[10px] font-bold text-muted-foreground sm:h-20 sm:w-20 sm:rounded-xl sm:text-xs">
      Sem foto
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-background p-2.5 sm:rounded-2xl sm:p-3">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:gap-1.5 sm:text-xs sm:tracking-[0.14em]">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 truncate text-xs font-bold sm:mt-2 sm:text-sm">{value}</p>
    </div>
  );
}

function OptionGroupField({
  group,
  selections,
  onChange,
}: {
  group: ProductOptionGroup;
  selections: SelectedOptions;
  onChange: (selections: SelectedOptions) => void;
}) {
  const selected = selections[group.id] ?? [];
  const min =
    group.required || group.decisionRequired ? Math.max(group.min ?? 1, 1) : (group.min ?? 0);
  const max = group.max ?? (group.type === "single" ? 1 : undefined);
  const ruleText =
    min > 0 && max === 1
      ? "Escolha 1 opção"
      : max
        ? `Escolha até ${max} itens`
        : "Escolha quantos quiser";

  function setSingle(optionId: string) {
    onChange({ ...selections, [group.id]: [optionId] });
  }

  function toggleMultiple(optionId: string, checked: boolean) {
    if (checked && max && selected.length >= max) return;
    const next = checked ? [...selected, optionId] : selected.filter((id) => id !== optionId);
    onChange({ ...selections, [group.id]: next });
  }

  return (
    <fieldset className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-2 border-b border-border bg-secondary/50 px-3 py-2.5">
        <div className="min-w-0">
          <legend className="text-sm font-bold">{group.title}</legend>
          <p className="mt-0.5 text-xs text-muted-foreground">{min ? ruleText : "Opcional"}</p>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-background px-2 py-1 text-[11px] font-black">
          {selected.length}/{max ?? selected.length}
        </span>
      </div>

      <div className="divide-y divide-border">
        {group.options.map((option) => {
          const checked = selected.includes(option.id);
          const id = `${group.id}-${option.id}`;
          const disabled =
            group.type === "multiple" && !checked && !!group.max && selected.length >= group.max;

          return (
            <label
              key={option.id}
              htmlFor={id}
              className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-secondary/40"
            >
              <span className="flex min-w-0 items-center gap-3">
                <input
                  id={id}
                  type={group.type === "single" ? "radio" : "checkbox"}
                  name={group.id}
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) =>
                    group.type === "single"
                      ? setSingle(option.id)
                      : toggleMultiple(option.id, event.target.checked)
                  }
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <span className="min-w-0 break-words">{option.label}</span>
              </span>
              {!!option.price && (
                <span className="shrink-0 text-xs font-bold text-primary">
                  {formatOptionPrice(option).replace(option.label, "").trim()}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
