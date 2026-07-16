import type { Session, User } from "@supabase/supabase-js";
import type { SelectedOptions } from "@/lib/types";
import { loadPublicMenu, type PublicMenuData } from "@/lib/supabase-data";
import { getSupabaseClient } from "@/lib/supabase";
import type { Category, Product } from "@/lib/types";

export const WAITER_ALLOWED_ROLES = [
  "waiter",
  "garcom",
  "cashier",
  "unit_manager",
  "owner",
  "super_admin",
] as const;

export type WaiterAllowedRole = (typeof WAITER_ALLOWED_ROLES)[number];

export type WaiterUserProfile = {
  id: string;
  fullName: string;
  role: string;
  active: boolean;
};

export type WaiterUnitAccess = {
  id: string;
  userId: string;
  unitId: string;
  isPrimary: boolean;
  active: boolean;
};

export type WaiterUnit = {
  id: string;
  name: string;
  slug?: string;
  active: boolean;
};

export type WaiterAuthState =
  | {
      status: "loading";
      session: Session | null;
      user: User | null;
      profile: null;
      units: WaiterUnit[];
      unitAccess: WaiterUnitAccess[];
      error: string | null;
    }
  | {
      status: "unauthenticated";
      session: null;
      user: null;
      profile: null;
      units: WaiterUnit[];
      unitAccess: WaiterUnitAccess[];
      error: string | null;
    }
  | {
      status: "forbidden";
      session: Session;
      user: User;
      profile: WaiterUserProfile;
      units: WaiterUnit[];
      unitAccess: WaiterUnitAccess[];
      error: string | null;
    }
  | {
      status: "authenticated";
      session: Session;
      user: User;
      profile: WaiterUserProfile;
      units: WaiterUnit[];
      unitAccess: WaiterUnitAccess[];
      error: string | null;
    }
  | {
      status: "blocked";
      session: Session | null;
      user: User | null;
      profile: WaiterUserProfile | null;
      units: WaiterUnit[];
      unitAccess: WaiterUnitAccess[];
      error: string | null;
    };

type UserProfileRow = {
  id: string;
  full_name: string;
  role: string;
  active: boolean;
};

type UserUnitAccessRow = {
  id: string;
  user_id: string;
  unit_id: string;
  is_primary: boolean;
  active: boolean;
};

type UnitRow = {
  id: string;
  name: string;
  slug?: string | null;
  active: boolean;
};

export type WaiterTableSnapshot = {
  id: string;
  tableId: string;
  tableNumber: string;
  status: string;
  statusKey: string;
  customerName?: string;
  waiterName?: string;
  total: number;
  orderCount: number;
  lastOrderStatus: string | null;
  lastOrderStatusKey?: string | null;
  activeSessionId: string | null;
  raw: Record<string, unknown>;
};

export type WaiterSessionItem = {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
  unitPrice?: number;
  totalPrice?: number;
};

export type WaiterSessionOrder = {
  id: string;
  orderNumber: string;
  status: string;
  rawStatus?: string;
  orderType?: "dine_in" | "takeaway";
  notes?: string;
  total: number;
  items: WaiterSessionItem[];
};

export type WaiterSessionDetail = {
  id: string;
  tableId: string;
  tableNumber: string;
  status: string;
  statusKey?: string;
  subtotal: number;
  total: number;
  customerName?: string;
  waiterName?: string;
  openedAt?: string;
  notes?: string;
  orders: WaiterSessionOrder[];
  raw: Record<string, unknown>;
};

export type WaiterOpenSessionPayload = {
  tableId: string;
  customerName?: string;
  notes?: string;
};

export type WaiterCreateOrderResult = {
  orderId: string;
  orderNumber: string;
  tableId: string | null;
  tableNumber: string | null;
  tableSessionId: string | null;
  subtotal: number;
  total: number;
};

export type WaiterCloseSessionPayload = {
  sessionId: string;
  notes?: string | null;
};

export type WaiterMenuData = {
  categories: Category[];
  products: Product[];
  isUnitOpen: boolean;
  unitName?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function pickFirst(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (source[key] != null) return source[key];
  }
  return undefined;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeTableNumber(value: unknown, fallback = "-") {
  const parsed = stringValue(value);
  if (!parsed) return fallback;
  const numeric = Number(parsed);
  return Number.isFinite(numeric) ? String(numeric).padStart(2, "0") : parsed;
}

function normalizeOrderStatusLabel(status: string | null) {
  if (!status) return null;
  const labels: Record<string, string> = {
    received: "Recebido",
    accepted: "Aceito",
    in_preparation: "Em preparo",
    ready: "Pronto",
    delivered_to_table: "Entregue na mesa",
    billed: "Conta solicitada",
    closed: "Fechada",
    open: "Aberta",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function normalizeOrderType(value: string | null): "dine_in" | "takeaway" | undefined {
  const key = normalizeStatusKey(value);
  if (key === "takeaway" || key === "to_go") return "takeaway";
  if (key === "dine_in" || key === "mesa" || key === "local") return "dine_in";
  return undefined;
}

function normalizeStatusKey(value: string | null) {
  return value?.trim().toLowerCase().replace(/\s+/g, "_") ?? null;
}

function normalizeTableStatus(status: string | null) {
  if (!status) return "Sem status";
  const labels: Record<string, string> = {
    free: "Livre",
    livre: "Livre",
    occupied: "Ocupada",
    ocupada: "Ocupada",
    open: "Comanda aberta",
    active: "Comanda ativa",
    pedido_ativo: "Pedido ativo",
    closed: "Fechada",
    blocked: "Bloqueada",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function resolveWaiterTableStatus(
  status: string | null,
  lastOrderStatus: string | null,
  hasSession: boolean,
) {
  const statusKey = normalizeStatusKey(status);
  const orderKey = normalizeStatusKey(lastOrderStatus);

  if (!hasSession) return { key: "livre", label: "Livre" };
  if (orderKey === "billed" || statusKey === "billed") {
    return { key: "conta_solicitada", label: "Conta solicitada" };
  }
  if (orderKey === "ready" || orderKey === "ready_for_pickup") {
    return { key: "pronto", label: "Pronto" };
  }
  if (orderKey === "received" || orderKey === "accepted" || orderKey === "in_preparation") {
    return { key: "em_preparo", label: "Em preparo" };
  }
  if (statusKey === "free" || statusKey === "livre") return { key: "livre", label: "Livre" };
  return { key: "ocupada", label: "Ocupada" };
}

function mapProfile(row: UserProfileRow): WaiterUserProfile {
  return {
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    active: row.active,
  };
}

function mapUnitAccess(row: UserUnitAccessRow): WaiterUnitAccess {
  return {
    id: row.id,
    userId: row.user_id,
    unitId: row.unit_id,
    isPrimary: row.is_primary,
    active: row.active,
  };
}

function readWaiterName(source: Record<string, unknown>) {
  const openedBy = asRecord(pickFirst(source, ["opened_by", "waiter", "openedBy"]));
  return (
    stringValue(pickFirst(source, ["opened_by_name", "waiter_name"])) ??
    stringValue(pickFirst(openedBy, ["name", "full_name"])) ??
    undefined
  );
}

function isAllowedRole(role: string) {
  return WAITER_ALLOWED_ROLES.includes(role as WaiterAllowedRole);
}

export async function signInWaiter(email: string, password: string) {
  const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOutWaiter() {
  const { error } = await getSupabaseClient().auth.signOut({ scope: "local" });
  if (error) throw new Error(error.message);
}

export async function readWaiterAuthState(): Promise<WaiterAuthState> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) {
    return {
      status: "blocked",
      session: null,
      user: null,
      profile: null,
      units: [],
      unitAccess: [],
      error: error.message,
    };
  }

  const session = data.session;
  if (!session?.user) {
    return {
      status: "unauthenticated",
      session: null,
      user: null,
      profile: null,
      units: [],
      unitAccess: [],
      error: null,
    };
  }

  const { data: profileRow, error: profileError } = await client
    .from("user_profiles")
    .select("id, full_name, role, active")
    .eq("id", session.user.id)
    .maybeSingle<UserProfileRow>();

  if (profileError) {
    return {
      status: "blocked",
      session,
      user: session.user,
      profile: null,
      units: [],
      unitAccess: [],
      error: profileError.message,
    };
  }

  if (!profileRow) {
    return {
      status: "blocked",
      session,
      user: session.user,
      profile: null,
      units: [],
      unitAccess: [],
      error: "Perfil do usuário não encontrado.",
    };
  }

  const profile = mapProfile(profileRow);
  if (!profile.active) {
    return {
      status: "blocked",
      session,
      user: session.user,
      profile,
      units: [],
      unitAccess: [],
      error: "Usuário inativo.",
    };
  }

  const { data: unitAccessRows, error: unitAccessError } = await client
    .from("user_unit_access")
    .select("id, user_id, unit_id, is_primary, active")
    .eq("user_id", session.user.id)
    .eq("active", true)
    .returns<UserUnitAccessRow[]>();

  if (unitAccessError) {
    return {
      status: "blocked",
      session,
      user: session.user,
      profile,
      units: [],
      unitAccess: [],
      error: unitAccessError.message,
    };
  }

  const unitAccess = (unitAccessRows ?? []).map(mapUnitAccess);
  const unitIds = unitAccess.map((item) => item.unitId);

  const unitsQuery =
    profile.role === "super_admin"
      ? client.from("units").select("id, name, slug, active").eq("active", true)
      : unitIds.length > 0
        ? client.from("units").select("id, name, slug, active").in("id", unitIds).eq("active", true)
        : null;

  const unitResult = unitsQuery ? await unitsQuery.returns<UnitRow[]>() : { data: [], error: null };

  if (unitResult.error) {
    return {
      status: "blocked",
      session,
      user: session.user,
      profile,
      units: [],
      unitAccess,
      error: unitResult.error.message,
    };
  }

  const units = (unitResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug ?? undefined,
    active: row.active,
  }));

  if (!isAllowedRole(profile.role)) {
    return {
      status: "forbidden",
      session,
      user: session.user,
      profile,
      units,
      unitAccess,
      error: "Seu perfil não tem permissão para acessar o painel do garçom.",
    };
  }

  if (profile.role !== "super_admin" && units.length === 0) {
    return {
      status: "blocked",
      session,
      user: session.user,
      profile,
      units,
      unitAccess,
      error: "Usuário sem unidade ativa vinculada.",
    };
  }

  return {
    status: "authenticated",
    session,
    user: session.user,
    profile,
    units,
    unitAccess,
    error: null,
  };
}

async function rpc<T>(name: string, args: Record<string, unknown>) {
  const { data, error } = await getSupabaseClient().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

function normalizeSnapshotRow(input: unknown): WaiterTableSnapshot {
  const row = asRecord(input);
  const session = asRecord(
    pickFirst(row, ["session", "active_session", "table_session", "current_session"]),
  );
  const table = asRecord(pickFirst(row, ["table", "store_table"]));
  const rawStatus = stringValue(
    pickFirst(row, ["status", "table_status", "session_status", "state"]) ??
      pickFirst(session, ["status", "state"]) ??
      pickFirst(table, ["status"]),
  );
  const total =
    numberValue(
      pickFirst(row, ["total", "session_total", "current_total", "comanda_total"]) ??
        pickFirst(session, ["total", "subtotal", "session_total"]),
    ) ?? 0;
  const orders = asArray(
    pickFirst(row, ["orders", "latest_orders"]) ?? pickFirst(session, ["orders"]),
  );
  const activeSessionId = stringValue(
    pickFirst(row, ["table_session_id", "session_id", "active_session_id"]) ??
      pickFirst(session, ["id"]),
  );
  const customerName =
    stringValue(
      pickFirst(row, ["customer_name"]) ??
        pickFirst(session, ["customer_name"]) ??
        pickFirst(asRecord(session.customer), ["name"]),
    ) ?? undefined;
  const waiterName = readWaiterName(session) ?? readWaiterName(row);
  const lastOrderStatusKey = normalizeStatusKey(
    stringValue(
      pickFirst(row, ["last_order_status", "latest_order_status"]) ??
        pickFirst(session, ["last_order_status"]) ??
        asRecord(orders[0]).status,
    ),
  );
  const resolvedStatus = resolveWaiterTableStatus(
    rawStatus,
    lastOrderStatusKey,
    Boolean(activeSessionId),
  );

  return {
    id:
      stringValue(pickFirst(row, ["id"])) ??
      stringValue(pickFirst(table, ["id"])) ??
      stringValue(pickFirst(row, ["table_id"])) ??
      crypto.randomUUID(),
    tableId:
      stringValue(pickFirst(row, ["table_id"])) ?? stringValue(pickFirst(table, ["id"])) ?? "",
    tableNumber: normalizeTableNumber(
      pickFirst(row, ["table_number", "number"]) ?? pickFirst(table, ["table_number", "number"]),
    ),
    status: resolvedStatus.label,
    statusKey: resolvedStatus.key,
    customerName,
    waiterName,
    total,
    orderCount: Math.max(
      0,
      numberValue(
        pickFirst(row, ["order_count", "orders_count", "pedido_count", "pedidos_count"]) ??
          orders.length,
      ),
    ),
    lastOrderStatus: normalizeOrderStatusLabel(
      stringValue(
        pickFirst(row, ["last_order_status", "latest_order_status"]) ??
          pickFirst(session, ["last_order_status"]) ??
          asRecord(orders[0]).status,
      ),
    ),
    lastOrderStatusKey,
    activeSessionId,
    raw: row,
  };
}

function normalizeSessionItem(input: unknown): WaiterSessionItem {
  const row = asRecord(input);
  return {
    id: stringValue(pickFirst(row, ["id", "item_id"])) ?? crypto.randomUUID(),
    name: stringValue(pickFirst(row, ["product_name", "name", "title", "item_name"])) ?? "Item",
    quantity: Math.max(1, numberValue(pickFirst(row, ["quantity", "qty"]))),
    notes: stringValue(pickFirst(row, ["notes", "observation", "item_notes"])) ?? undefined,
    unitPrice: numberValue(pickFirst(row, ["unit_price", "price"])),
    totalPrice: numberValue(pickFirst(row, ["total_price", "total"])),
  };
}

function normalizeSessionOrder(input: unknown): WaiterSessionOrder {
  const row = asRecord(input);
  const items = asArray(pickFirst(row, ["items", "order_items", "itens", "products", "lines"])).map(
    normalizeSessionItem,
  );
  return {
    id: stringValue(pickFirst(row, ["id", "order_id"])) ?? crypto.randomUUID(),
    orderNumber:
      stringValue(pickFirst(row, ["order_number", "number", "code"])) ??
      `#${Math.max(1, items.length)}`,
    rawStatus: stringValue(pickFirst(row, ["status", "state"])) ?? undefined,
    orderType: normalizeOrderType(
      stringValue(pickFirst(row, ["order_type", "fulfillment_type", "mode"])),
    ),
    status:
      normalizeOrderStatusLabel(stringValue(pickFirst(row, ["status", "state"]))) ?? "Sem status",
    notes: stringValue(pickFirst(row, ["notes", "observation"])) ?? undefined,
    total: numberValue(pickFirst(row, ["total", "order_total", "subtotal"])),
    items,
  };
}

function normalizeSessionDetail(input: unknown): WaiterSessionDetail {
  const response = asRecord(input);
  const session = asRecord(pickFirst(response, ["session", "data", "table_session"])) || response;
  const table = asRecord(pickFirst(session, ["table", "store_table"]));
  const orders = asArray(
    pickFirst(response, ["orders"]) ?? pickFirst(session, ["orders", "session_orders"]),
  ).map(normalizeSessionOrder);

  return {
    id: stringValue(pickFirst(session, ["id", "session_id"])) ?? "",
    tableId:
      stringValue(pickFirst(session, ["table_id"])) ?? stringValue(pickFirst(table, ["id"])) ?? "",
    tableNumber: normalizeTableNumber(
      pickFirst(session, ["table_number"]) ?? pickFirst(table, ["table_number", "number"]),
    ),
    status:
      normalizeTableStatus(
        stringValue(pickFirst(session, ["status", "state", "session_status"])),
      ) ?? "Comanda",
    subtotal: numberValue(pickFirst(session, ["subtotal", "session_subtotal"])),
    total:
      numberValue(
        pickFirst(session, ["total", "session_total", "amount_total"]) ??
          pickFirst(response, ["total"]),
      ) ?? 0,
    statusKey:
      normalizeStatusKey(stringValue(pickFirst(session, ["status", "state", "session_status"]))) ??
      undefined,
    customerName:
      stringValue(pickFirst(session, ["customer_name"])) ??
      stringValue(pickFirst(asRecord(session.customer), ["name"])) ??
      undefined,
    waiterName: readWaiterName(session) ?? readWaiterName(response),
    openedAt:
      stringValue(pickFirst(session, ["opened_at", "created_at", "started_at"])) ?? undefined,
    notes: stringValue(pickFirst(session, ["notes", "observation"])) ?? undefined,
    orders,
    raw: response,
  };
}

export async function listWaiterTableSnapshots(unitId: string) {
  const data = await rpc<unknown[]>("list_table_sessions_snapshot", { p_unit_id: unitId });
  return asArray(data).map(normalizeSnapshotRow);
}

export async function getWaiterSessionDetail(sessionId: string) {
  const data = await rpc<unknown>("get_table_session_detail", { p_session_id: sessionId });
  return normalizeSessionDetail(data);
}

export async function getActiveWaiterSessionByTable(tableId: string) {
  const data = await rpc<unknown | null>("get_active_table_session_detail_by_table", {
    p_table_id: tableId,
  });
  if (!data) return null;
  const detail = normalizeSessionDetail(data);
  return detail.id ? detail : null;
}

export async function openWaiterSession(payload: WaiterOpenSessionPayload) {
  await rpc("open_table_session", {
    p_table_id: payload.tableId,
    p_customer_name: payload.customerName?.trim() || null,
    p_customer_phone: null,
    p_party_size: null,
    p_notes: payload.notes?.trim() || null,
  });
  return getActiveWaiterSessionByTable(payload.tableId);
}

export async function requestWaiterBill(sessionId: string) {
  await rpc("request_table_session_bill", { p_session_id: sessionId });
}

export async function closeWaiterSession(payload: WaiterCloseSessionPayload) {
  await rpc("close_table_session", {
    p_session_id: payload.sessionId,
    p_payment_method: "local",
    p_notes: payload.notes?.trim() || null,
  });
}

export async function loadWaiterProducts(unitId: string): Promise<Product[]> {
  const menu = await loadPublicMenu(unitId, "dine_in");
  return menu.products;
}

export async function loadWaiterMenuData(unitId: string): Promise<WaiterMenuData> {
  const menu: PublicMenuData = await loadPublicMenu(unitId, "dine_in");
  const currentUnit = menu.units.find((unit) => unit.id === unitId || unit.slug === unitId);
  return {
    categories: menu.categories,
    products: menu.products,
    isUnitOpen: currentUnit?.isOpen ?? !menu.allUnitsClosed,
    unitName: currentUnit?.name,
  };
}

export function isSimpleWaiterProduct(product: Product) {
  return (product.optionGroups ?? []).every(
    (group) => !group.required && !group.decisionRequired && (group.min ?? 0) === 0,
  );
}

export async function waiterCreateOrder(params: {
  unitId: string;
  tableId: string;
  tableSessionId?: string | null;
  customerName?: string;
  notes?: string;
  orderType?: "dine_in" | "takeaway";
  items: Array<{
    productId: string;
    quantity: number;
    notes?: string;
    selections?: SelectedOptions;
  }>;
}) {
  const payload = {
    unit_id: params.unitId,
    table_id: params.tableId,
    table_session_id: params.tableSessionId ?? null,
    customer: params.customerName
      ? {
          name: params.customerName.trim() || null,
          phone: null,
        }
      : undefined,
    payment_method: "local",
    idempotency_key: `waiter-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`}`,
    notes: params.notes?.trim() || null,
    order_type: params.orderType ?? "dine_in",
    fulfillment_type: params.orderType === "takeaway" ? "takeaway" : undefined,
    items: params.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      selections: Object.entries(item.selections ?? {}).flatMap(([groupId, choiceIds]) =>
        (choiceIds ?? []).map((choiceId) => ({
          group_id: groupId,
          choice_id: choiceId,
        })),
      ),
      notes: item.notes?.trim() || "",
    })),
  };

  const data = await rpc<Record<string, unknown>>("waiter_create_order", { p_payload: payload });

  return {
    orderId: stringValue(data.order_id) ?? "",
    orderNumber: stringValue(data.order_number) ?? "",
    tableId: stringValue(data.table_id),
    tableNumber: stringValue(data.table_number),
    tableSessionId: stringValue(data.table_session_id),
    subtotal: numberValue(data.subtotal),
    total: numberValue(data.total),
  } satisfies WaiterCreateOrderResult;
}
