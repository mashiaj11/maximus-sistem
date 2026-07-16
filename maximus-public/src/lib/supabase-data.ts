import { getSupabaseClient } from "./supabase";
import { isSupabaseConfigured } from "./supabase";
import type {
  CartItem,
  Category,
  CustomerAddress,
  CustomerOrderHistory,
  CustomerProfile,
  DeliveryZone,
  FoodVariant,
  OrderInfo,
  OrderTrackMode,
  Product,
  ProductOptionGroup,
} from "./types";
import type { GeoUnit, PublicBusinessHour, WeekdayKey } from "./geo";

type AvailabilityScope = "all" | "dine_in_only" | "delivery_only" | "takeaway_only";
export type PublicConsumptionMode = "delivery" | "pickup" | "dine_in";
type OrderWhatsappStatus =
  | "received"
  | "accepted"
  | "in_preparation"
  | "ready"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "driver_on_way"
  | "driver_nearby"
  | "arrived"
  | "delivered"
  | "picked_up"
  | "delivered_to_table"
  | "cancelled";

type UnitRow = {
  id: string;
  slug: string;
  name: string;
  phone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_open: boolean;
  business_hours?: unknown;
  active?: boolean | null;
};

type AdminSettingsRow = {
  unit_id: string;
  official_phone: string | null;
  whatsapp_number: string | null;
  minimum_order_value: number | null;
  base_delivery_fee: number | null;
  delivery_fee_per_km: number | null;
  max_delivery_distance_km: number | null;
  free_delivery_from: number | null;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  availability_scope: AvailabilityScope;
  active: boolean;
};

type ProductRow = {
  id: string;
  unit_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  option_groups: unknown;
  available: boolean;
  available_for_delivery?: boolean | null;
  available_for_pickup?: boolean | null;
  available_for_dine_in?: boolean | null;
  dine_in_only?: boolean | null;
  deleted_at?: string | null;
  created_at?: string | null;
};

type ProductUnitAvailabilityRow = {
  product_id: string;
  unit_id: string;
  is_available: boolean;
  available_for_delivery?: boolean | null;
  available_for_pickup?: boolean | null;
  available_for_dine_in?: boolean | null;
};

type StoreTableRow = {
  id: string;
  unit_id: string;
  table_number: number;
  status: "livre" | "ocupada" | "pedido_ativo";
  active: boolean;
};

type AddressRow = {
  id: string;
  customer_id: string;
  label: CustomerAddress["label"] | null;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  reference: string | null;
  latitude: number | null;
  longitude: number | null;
  delivery_zone_id: string | null;
  delivery_zone_name: string | null;
  delivery_fee_snapshot: number | null;
  is_primary: boolean;
  is_active?: boolean | null;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type CustomerLookupRpc = {
  id: string;
  name: string;
  phone: string;
};

type CustomerOrderItemRpc = {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  customizations: string[] | null;
  notes: string | null;
};

type CustomerOrderRpc = {
  id: string;
  order_number: number;
  created_at: string;
  status: string;
  order_type: "delivery" | "dine_in" | "takeaway";
  payment_method: string | null;
  payment_status: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  customer_address_text: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  notes: string | null;
  items: CustomerOrderItemRpc[];
  unit_name?: string | null;
  delivery_estimated_time?: number | null;
  delivery_zone_name?: string | null;
};

export type CustomerReorderPayload = {
  unit_id: string;
  order_type: "delivery" | "dine_in" | "takeaway";
  items: Array<{
    product_id: string | null;
    product_name: string;
    quantity: number;
    notes: string;
    available: boolean;
    selections: Array<{
      group_id?: string;
      choice_id?: string;
      group_name?: string;
      choice_name?: string;
      available: boolean;
    }>;
  }>;
};

export type PublicTable = {
  id: string;
  unitId: string;
  tableNumber: string;
  status: "livre" | "ocupada" | "indisponivel";
  isActive: boolean;
};

export type PublicMenuData = {
  units: GeoUnit[];
  categories: Category[];
  products: Product[];
  allUnitsClosed: boolean;
};

const CURRENT_CUSTOMER_PHONE_KEY = "maximus_current_customer_phone";
const LAST_ORDER_ID_KEY = "maximus_last_order_id";
const CUSTOMER_PROFILE_KEY = "maximus:customer-profile";

export type LocalCustomerProfile = {
  name: string;
  phone: string;
  customer_id?: string;
  last_address_id?: string;
  updated_at: string;
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function slugToVariant(slug: string): FoodVariant {
  if (slug.includes("churrasco")) return "churrasco";
  if (slug.includes("petisco") || slug.includes("entrada") || slug.includes("aperitivo"))
    return "petiscos";
  if (slug.includes("sobremesa") || slug.includes("doce") || slug.includes("pudim"))
    return "sobremesas";
  if (slug.includes("suco")) return "sucos";
  if (slug.includes("refrigerante") || slug.includes("refri")) return "refrigerantes";
  if (slug.includes("bebida")) return "bebidas";
  if (slug.includes("chopp")) return "chopp";
  if (slug.includes("executivo") || slug.includes("prato")) return "plate";
  return "burger";
}

function scopeAllowed(scope: AvailabilityScope, mode: PublicConsumptionMode) {
  if (scope === "all") return true;
  if (scope === "dine_in_only") return mode === "dine_in";
  if (scope === "delivery_only") return mode === "delivery";
  if (scope === "takeaway_only") return mode === "pickup";
  return false;
}

function productAllowed(
  product: ProductRow,
  mode: PublicConsumptionMode,
  availability?: ProductUnitAvailabilityRow,
) {
  if (product.dine_in_only) return mode === "dine_in";
  if (mode === "dine_in") {
    return (availability?.available_for_dine_in ?? product.available_for_dine_in) !== false;
  }
  if (mode === "pickup") {
    return (availability?.available_for_pickup ?? product.available_for_pickup) !== false;
  }
  return (availability?.available_for_delivery ?? product.available_for_delivery) !== false;
}

function mapOptionGroups(value: unknown): ProductOptionGroup[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((group) => {
      const item = group as {
        id?: string;
        name?: string;
        title?: string;
        type?: "single" | "multiple";
        required?: boolean;
        isRequired?: boolean;
        decisionRequired?: boolean;
        decision_required?: boolean;
        active?: boolean;
        sortOrder?: number;
        sort_order?: number;
        minChoices?: number;
        maxChoices?: number;
        min?: number;
        max?: number;
        choices?: Array<{
          id?: string;
          name?: string;
          label?: string;
          priceDelta?: number;
          price?: number;
          active?: boolean;
          isNegativeChoice?: boolean;
          is_negative_choice?: boolean;
          maxQuantity?: number;
          max_quantity?: number;
          sortOrder?: number;
          sort_order?: number;
        }>;
        options?: Array<{
          id?: string;
          name?: string;
          label?: string;
          priceDelta?: number;
          price?: number;
          active?: boolean;
          isNegativeChoice?: boolean;
          is_negative_choice?: boolean;
          maxQuantity?: number;
          max_quantity?: number;
          sortOrder?: number;
          sort_order?: number;
        }>;
      };

      const choices = item.choices ?? item.options ?? [];
      return {
        id: item.id ?? item.name ?? crypto.randomUUID(),
        title: item.title ?? item.name ?? "Opções",
        type: item.type ?? (Number(item.maxChoices ?? item.max ?? 1) > 1 ? "multiple" : "single"),
        required: Boolean(item.required ?? item.isRequired),
        min: item.min ?? item.minChoices,
        max: item.max ?? item.maxChoices,
        decisionRequired: Boolean(item.decisionRequired ?? item.decision_required),
        active: item.active !== false,
        sortOrder: item.sortOrder ?? item.sort_order ?? 0,
        options: choices
          .filter((choice) => choice.active !== false)
          .sort((a, b) => (a.sortOrder ?? a.sort_order ?? 0) - (b.sortOrder ?? b.sort_order ?? 0))
          .map((choice) => ({
            id: choice.id ?? choice.name ?? crypto.randomUUID(),
            label: choice.label ?? choice.name ?? "Opção",
            price: choice.price ?? choice.priceDelta,
            isNegativeChoice: Boolean(choice.isNegativeChoice ?? choice.is_negative_choice),
            maxQuantity: choice.maxQuantity ?? choice.max_quantity ?? 1,
          })),
      };
    })
    .filter((group) => group.active !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function mapAddress(row: AddressRow): CustomerAddress {
  const now = Date.now();
  return {
    id: row.id,
    label: row.label ?? "Casa",
    street: row.street,
    number: row.number ?? "",
    neighborhood: row.neighborhood ?? "",
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    postalCode: row.postal_code ?? undefined,
    complement: row.complement ?? undefined,
    reference: row.reference ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    deliveryZoneId: row.delivery_zone_id ?? undefined,
    deliveryZoneName: row.delivery_zone_name ?? undefined,
    deliveryFeeSnapshot:
      row.delivery_fee_snapshot == null ? undefined : Number(row.delivery_fee_snapshot),
    isDefault: row.is_primary,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : now,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : now,
  };
}

function mapOrderMode(type: "delivery" | "dine_in" | "takeaway"): OrderTrackMode {
  if (type === "delivery") return "delivery";
  if (type === "dine_in") return "mesa";
  return "retirada";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    received: "Pedido recebido",
    accepted: "Pedido aceito",
    in_preparation: "Em produção",
    ready: "Pedido pronto",
    out_for_delivery: "Saiu para entrega",
    driver_on_way: "Pedido chegou",
    driver_nearby: "Pedido chegou",
    arrived: "Pedido chegou",
    ready_for_pickup: "Pronto para retirada",
    delivered_to_table: "Entregue na mesa",
    picked_up: "Retirado",
    delivered: "Entregue",
    cancelled: "Cancelado",
  };
  return labels[status] ?? status;
}

function mapPublicUnit(unit: UnitRow, settings?: AdminSettingsRow): GeoUnit {
  const phone = settings?.official_phone ?? unit.phone ?? "";
  return {
    id: unit.id,
    slug: unit.slug,
    name: unit.name,
    address: unit.address ?? "",
    phone,
    whatsappPhone: settings?.whatsapp_number ?? phone,
    latitude: Number(unit.latitude ?? 0),
    longitude: Number(unit.longitude ?? 0),
    isOpen: unit.is_open && isOpenByBusinessHours(unit.business_hours),
    businessHours: normalizeBusinessHours(unit.business_hours),
    minimumOrderValue: Number(settings?.minimum_order_value ?? 0),
    baseDeliveryFee: Number(settings?.base_delivery_fee ?? 0),
    deliveryFeePerKm: Number(settings?.delivery_fee_per_km ?? 0),
    maxDeliveryDistanceKm: Number(settings?.max_delivery_distance_km ?? 0),
    freeDeliveryFrom: Number(settings?.free_delivery_from ?? 0),
  };
}

function normalizeBusinessHours(value: unknown): PublicBusinessHour[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as {
        day?: WeekdayKey;
        open?: boolean;
        periods?: Array<{ opensAt?: string; closesAt?: string }>;
        opensAt?: string;
        closesAt?: string;
      };
      if (!row.day) return null;
      const periods =
        Array.isArray(row.periods) && row.periods.length
          ? row.periods
          : row.opensAt && row.closesAt
            ? [{ opensAt: row.opensAt, closesAt: row.closesAt }]
            : [];
      return {
        day: row.day,
        open: Boolean(row.open),
        periods: periods.map((period) => ({
          opensAt: period.opensAt ?? "",
          closesAt: period.closesAt ?? "",
        })),
      };
    })
    .filter((hour): hour is PublicBusinessHour => Boolean(hour));
}

function isOpenByBusinessHours(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return false;
  const dayKeys = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  const now = new Date();
  const today = dayKeys[now.getDay()];
  const current = now.getHours() * 60 + now.getMinutes();
  const row = value.find(
    (item) => item && typeof item === "object" && (item as { day?: string }).day === today,
  ) as
    | {
        open?: boolean;
        periods?: Array<{ opensAt?: string; closesAt?: string }>;
        opensAt?: string;
        closesAt?: string;
      }
    | undefined;
  if (!row || !row.open) return false;
  const periods =
    Array.isArray(row.periods) && row.periods.length
      ? row.periods
      : row.opensAt && row.closesAt
        ? [{ opensAt: row.opensAt, closesAt: row.closesAt }]
        : [];
  return periods.some((period) => {
    const start = timeToMinutes(period.opensAt ?? "");
    const end = timeToMinutes(period.closesAt ?? "");
    if (start === end) return false;
    if (end < start) return current >= start || current <= end;
    return current >= start && current <= end;
  });
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

async function queryOrThrow<T>(
  label: string,
  promise: PromiseLike<{ data: T | null; error: { message: string } | null }>,
) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function rpcOrThrow<T>(functionName: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabaseClient().rpc(functionName, args);
  if (error) {
    const rpcError = error as { code?: string; message: string };
    const missingRpc =
      rpcError.code === "PGRST202" ||
      rpcError.message.toLowerCase().includes("could not find the function") ||
      rpcError.message.toLowerCase().includes("schema cache");
    if (missingRpc) {
      console.error(
        "RPC de cliente/endereço não encontrada no Supabase. Verifique se as migrations foram aplicadas.",
        { functionName, code: rpcError.code },
      );
    }
    throw new Error(rpcError.message);
  }
  return data as T;
}

async function loadPublicUnitRows(label: string) {
  const { data, error } = await getSupabaseClient()
    .from("units")
    .select("id, slug, name, phone, address, latitude, longitude, is_open, business_hours, active")
    .eq("active", true)
    .order("slug");

  console.log("PUBLIC UNITS RAW", data, error);

  if (error) throw new Error(`${label}: ${error.message}`);
  return (data ?? []) as UnitRow[];
}

export function rememberCustomerPhone(phone: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CURRENT_CUSTOMER_PHONE_KEY, normalizePhone(phone));
  }
}

export function getLocalCustomerProfile(): LocalCustomerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CUSTOMER_PROFILE_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw) as LocalCustomerProfile;
    if (!profile.name || !profile.phone) return null;
    return profile;
  } catch {
    return null;
  }
}

export function saveLocalCustomerProfile(profile: {
  name: string;
  phone: string;
  customer_id?: string;
  last_address_id?: string;
}) {
  if (typeof window === "undefined") return;
  const next: LocalCustomerProfile = {
    name: profile.name.trim(),
    phone: normalizePhone(profile.phone),
    customer_id: profile.customer_id,
    last_address_id: profile.last_address_id,
    updated_at: new Date().toISOString(),
  };
  window.localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(next));
  rememberCustomerPhone(next.phone);
}

export function clearLocalCustomerProfile() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CUSTOMER_PROFILE_KEY);
}

export function getRememberedCustomerPhone() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CURRENT_CUSTOMER_PHONE_KEY);
}

export function rememberLastOrderId(orderId: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LAST_ORDER_ID_KEY, orderId);
  }
}

export function getRememberedLastOrderId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_ORDER_ID_KEY);
}

export function clearRememberedLastOrderId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LAST_ORDER_ID_KEY);
}

export async function loadPublicUnits() {
  const rows = await loadPublicUnitRows("units");
  return rows.map((unit) => mapPublicUnit(unit));
}

export async function loadActivePublicUnit(unitSlug?: string) {
  const units = await loadPublicUnits();
  return (
    (unitSlug ? units.find((unit) => unit.slug === unitSlug || unit.id === unitSlug) : null) ??
    units[0] ??
    null
  );
}

function productGlobalKey(product: ProductRow) {
  return [
    product.category_id,
    product.name.trim().toLowerCase(),
    Number(product.price).toFixed(2),
    product.description ?? "",
    product.image_url ?? "",
    JSON.stringify(product.option_groups ?? []),
  ].join("|");
}

function uniqueGlobalProducts(products: ProductRow[]) {
  const byKey = new Map<string, ProductRow>();
  for (const product of products) {
    const key = productGlobalKey(product);
    const current = byKey.get(key);
    const productTime = product.created_at ? new Date(product.created_at).getTime() : 0;
    const currentTime = current?.created_at ? new Date(current.created_at).getTime() : 0;
    if (
      !current ||
      productTime < currentTime ||
      (productTime === currentTime && product.id.localeCompare(current.id) < 0)
    ) {
      byKey.set(key, product);
    }
  }
  return [...byKey.values()];
}

export async function loadPublicMenu(
  unitSlug?: string,
  mode: PublicConsumptionMode = "delivery",
): Promise<PublicMenuData> {
  const supabase = getSupabaseClient();
  const unitRows = await loadPublicUnitRows("units");
  const units = unitRows.map((unit) => mapPublicUnit(unit));
  const openUnits = units.filter((unit) => unit.isOpen);
  const requestedUnit = units.find((unit) => unit.slug === unitSlug || unit.id === unitSlug);
  const selectedUnit =
    (requestedUnit?.isOpen ? requestedUnit : null) ?? openUnits[0] ?? requestedUnit ?? units[0];
  const allUnitsClosed = openUnits.length === 0;
  const categories = (await queryOrThrow(
    "categories",
    supabase
      .from("categories")
      .select("id, name, slug, sort_order, availability_scope, active")
      .eq("active", true)
      .order("sort_order"),
  )) as CategoryRow[];
  console.log("PUBLIC CATEGORIES RAW", categories);
  const allowedCategories = categories.filter((category) =>
    scopeAllowed(category.availability_scope, mode),
  );
  const productRows =
    selectedUnit && !allUnitsClosed
      ? ((await queryOrThrow(
          "products",
          supabase
            .from("products")
            .select(
              "id, unit_id, category_id, name, description, price, image_url, option_groups, available, available_for_delivery, available_for_pickup, available_for_dine_in, dine_in_only, deleted_at, created_at",
            )
            .eq("available", true)
            .is("deleted_at", null)
            .order("name"),
        )) as ProductRow[])
      : [];
  const globalProducts = uniqueGlobalProducts(productRows);
  const availabilityRows =
    selectedUnit && globalProducts.length
      ? ((await queryOrThrow(
          "product_unit_availability",
          supabase
            .from("product_unit_availability")
            .select(
              "product_id, unit_id, is_available, available_for_delivery, available_for_pickup, available_for_dine_in",
            )
            .eq("unit_id", selectedUnit.id)
            .in(
              "product_id",
              globalProducts.map((product) => product.id),
            ),
        )) as ProductUnitAvailabilityRow[])
      : [];
  const availabilityByProductId = new Map(availabilityRows.map((row) => [row.product_id, row]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const allowedIds = new Set(allowedCategories.map((category) => category.id));
  console.log("PUBLIC PRODUCTS RAW", productRows);
  const filteredProducts = globalProducts
    .filter((product) => allowedIds.has(product.category_id))
    .filter((product) => {
      const availability = availabilityByProductId.get(product.id);
      if (availability) return availability.is_available;
      return product.available;
    })
    .filter((product) => productAllowed(product, mode, availabilityByProductId.get(product.id)));
  console.log("PUBLIC PRODUCTS FILTERED", filteredProducts);
  for (const category of allowedCategories) {
    const categoryProducts = filteredProducts.filter(
      (product) => product.category_id === category.id,
    );
    console.log("CATEGORY PRODUCTS", category.id, categoryProducts);
  }

  return {
    units,
    allUnitsClosed,
    categories: allUnitsClosed
      ? []
      : allowedCategories.map((category) => ({
          id: category.id,
          label: category.name,
          svg: slugToVariant(category.slug),
          availabilityScope: category.availability_scope,
        })),
    products: filteredProducts.map((product) => {
      const category = categoryById.get(product.category_id);
      return {
        id: product.id,
        name: product.name,
        description: product.description ?? "",
        price: Number(product.price),
        category: product.category_id,
        svg: slugToVariant(category?.slug ?? ""),
        imageUrl: product.image_url ?? undefined,
        optionGroups: mapOptionGroups(product.option_groups),
        availableForDelivery:
          (availabilityByProductId.get(product.id)?.available_for_delivery ??
            product.available_for_delivery) !== false,
        availableForPickup:
          (availabilityByProductId.get(product.id)?.available_for_pickup ??
            product.available_for_pickup) !== false,
        availableForDineIn:
          (availabilityByProductId.get(product.id)?.available_for_dine_in ??
            product.available_for_dine_in) !== false,
        dineInOnly: product.dine_in_only === true,
      };
    }),
  };
}

export async function loadPublicTables(unitSlug: string): Promise<PublicTable[]> {
  const supabase = getSupabaseClient();
  const units = (await queryOrThrow(
    "units",
    supabase.from("units").select("id, slug").eq("active", true),
  )) as Array<Pick<UnitRow, "id" | "slug">>;
  const unit = units.find((item) => item.slug === unitSlug || item.id === unitSlug);
  if (!unit) return [];
  const rows = (await queryOrThrow(
    "store_tables",
    supabase
      .from("store_tables")
      .select("id, unit_id, table_number, status, active")
      .eq("unit_id", unit.id)
      .order("table_number"),
  )) as StoreTableRow[];

  return rows.map((row) => ({
    id: row.id,
    unitId: unit.slug,
    tableNumber: String(row.table_number).padStart(2, "0"),
    status: row.active ? (row.status === "livre" ? "livre" : "ocupada") : "indisponivel",
    isActive: row.active,
  }));
}

export async function findPublicTable(unitSlug: string, tableNumber: string) {
  const supabase = getSupabaseClient();
  const units = (await queryOrThrow(
    "units",
    supabase.from("units").select("id, slug").eq("active", true),
  )) as Array<Pick<UnitRow, "id" | "slug">>;
  const unit = units.find((item) => item.slug === unitSlug || item.id === unitSlug);
  if (!unit) return null;
  const number = Number(tableNumber);
  if (!Number.isFinite(number)) return null;
  const rows = (await queryOrThrow(
    "store_table",
    supabase
      .from("store_tables")
      .select("id, table_number, active")
      .eq("unit_id", unit.id)
      .eq("table_number", number)
      .limit(1),
  )) as Array<Pick<StoreTableRow, "id" | "table_number" | "active">>;
  return rows[0] ?? null;
}

export async function loadDeliveryRules(unitId: string) {
  const rows = (await queryOrThrow(
    "delivery_fee_rules",
    getSupabaseClient()
      .from("delivery_fee_rules")
      .select("id, max_distance_km, estimated_minutes, delivery_fee, active")
      .eq("unit_id", unitId)
      .eq("active", true)
      .order("max_distance_km"),
  )) as Array<{
    id: string;
    max_distance_km: number;
    delivery_fee: number;
    estimated_minutes: number;
    active: boolean;
  }>;
  return rows.map((row) => ({
    id: row.id,
    maxDistanceKm: Number(row.max_distance_km),
    deliveryFee: Number(row.delivery_fee),
    estimatedMinutes: row.estimated_minutes,
    isActive: row.active,
  }));
}

export async function loadDeliveryZones(unitId: string): Promise<DeliveryZone[]> {
  const rows = (await queryOrThrow(
    "delivery_zones",
    getSupabaseClient()
      .from("delivery_zones")
      .select("id, unit_id, name, fee, estimated_time_min, estimated_time_max, active, sort_order")
      .eq("unit_id", unitId)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  )) as Array<{
    id: string;
    unit_id: string;
    name: string;
    fee: number;
    estimated_time_min: number | null;
    estimated_time_max: number | null;
    active: boolean;
    sort_order: number;
  }>;
  return rows.map((row) => ({
    id: row.id,
    unitId: row.unit_id,
    name: row.name,
    fee: Number(row.fee),
    estimatedTimeMin: row.estimated_time_min,
    estimatedTimeMax: row.estimated_time_max,
    isActive: row.active,
    sortOrder: row.sort_order,
  }));
}

function mapCustomerOrder(order: CustomerOrderRpc): CustomerOrderHistory {
  const address = order.address_street
    ? {
        id: `order-address-${order.id}`,
        label: "Outro" as const,
        street: order.address_street,
        number: order.address_number ?? "",
        neighborhood: order.address_neighborhood ?? "",
        isDefault: false,
        createdAt: new Date(order.created_at).getTime(),
        updatedAt: new Date(order.created_at).getTime(),
      }
    : undefined;
  return {
    id: order.id,
    number: `#${order.order_number}`,
    date: new Date(order.created_at).getTime(),
    items: (order.items ?? []).map((item) => ({
      productId: item.product_id ?? undefined,
      name: item.product_name,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      total: Number(item.total_price),
      customizations: item.customizations ?? [],
      notes: item.notes ?? undefined,
    })),
    subtotal: Number(order.subtotal ?? 0),
    deliveryFee: Number(order.delivery_fee ?? 0),
    total: Number(order.total),
    mode: mapOrderMode(order.order_type),
    status: statusLabel(order.status),
    rawStatus: order.status,
    paymentMethod: order.payment_method ?? undefined,
    paymentStatus: order.payment_status,
    address,
  };
}

async function loadCustomerProfile(customer: CustomerLookupRpc): Promise<CustomerProfile> {
  const [addresses, orders] = await Promise.all([
    rpcOrThrow<AddressRow[]>("customer_list_addresses_by_phone", {
      p_phone: customer.phone,
      p_name: customer.name,
    }),
    rpcOrThrow<CustomerOrderRpc[]>("customer_list_orders_by_phone", {
      p_phone: customer.phone,
      p_name: customer.name,
    }),
  ]);
  const now = Date.now();
  const profile: CustomerProfile = {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    addresses: (addresses ?? []).map(mapAddress),
    orders: (orders ?? []).slice(0, 20).map(mapCustomerOrder),
    createdAt: now,
    updatedAt: now,
  };
  saveLocalCustomerProfile({
    name: profile.name,
    phone: profile.phone,
    customer_id: profile.id,
    last_address_id: profile.addresses.find((a) => a.isDefault)?.id,
  });
  return profile;
}

export async function getCustomerByPhone(
  phone: string,
  name?: string,
): Promise<CustomerProfile | null> {
  const cleanPhone = normalizePhone(phone);
  if (cleanPhone.length < 10 || cleanPhone.length > 13) return null;
  const customer = await rpcOrThrow<CustomerLookupRpc>("customer_lookup_by_phone", {
    p_phone: cleanPhone,
    p_name: name?.trim() || null,
  });
  if (!customer?.id) return null;
  return loadCustomerProfile(customer);
}

export async function getCurrentCustomerFromSupabase(): Promise<CustomerProfile | null> {
  const localProfile = getLocalCustomerProfile();
  const phone = localProfile?.phone ?? getRememberedCustomerPhone();
  return phone ? getCustomerByPhone(phone, localProfile?.name) : null;
}

export async function saveCustomerToSupabase(data: {
  name: string;
  phone: string;
}): Promise<CustomerProfile> {
  const phone = normalizePhone(data.phone);
  let profile: CustomerProfile;
  try {
    const customer = await rpcOrThrow<CustomerLookupRpc>("customer_lookup_by_phone", {
      p_phone: phone,
      p_name: data.name.trim(),
    });
    profile = await loadCustomerProfile(customer);
  } catch (error) {
    if (!isMissingCustomerRpc(error)) throw error;
    const now = Date.now();
    profile = {
      id: `local-${phone}`,
      name: data.name.trim(),
      phone,
      addresses: [],
      orders: [],
      createdAt: now,
      updatedAt: now,
    };
  }
  rememberCustomerPhone(phone);
  saveLocalCustomerProfile({ name: profile.name, phone: profile.phone, customer_id: profile.id });
  return profile;
}

function isMissingCustomerRpc(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("customer_lookup_by_phone") &&
    (message.includes("could not find") ||
      message.includes("schema cache") ||
      message.includes("function") ||
      message.includes("pgrst202"))
  );
}

export async function saveAddressToSupabase(
  customerId: string,
  address: Omit<CustomerAddress, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<CustomerProfile> {
  const identity = requireLocalCustomerIdentity(customerId);
  const payload = addressRpcPayload(address);
  if (address.id) {
    await rpcOrThrow("customer_update_address_by_phone", {
      p_phone: identity.phone,
      p_name: identity.name,
      p_address_id: address.id,
      p_address: payload,
    });
  } else {
    await rpcOrThrow("customer_upsert_address_by_phone", {
      p_phone: identity.phone,
      p_name: identity.name,
      p_address: payload,
    });
  }
  const profile = await getCustomerByPhone(identity.phone, identity.name);
  if (!profile) throw new Error("Não foi possível atualizar os endereços do cliente.");
  return profile;
}

export async function deleteAddressFromSupabase(
  customerId: string,
  addressId: string,
): Promise<CustomerProfile> {
  const identity = requireLocalCustomerIdentity(customerId);
  await rpcOrThrow("customer_delete_address_by_phone", {
    p_phone: identity.phone,
    p_name: identity.name,
    p_address_id: addressId,
  });
  const profile = await getCustomerByPhone(identity.phone, identity.name);
  if (!profile) throw new Error("Não foi possível atualizar os endereços do cliente.");
  return profile;
}

export async function setDefaultAddressOnSupabase(
  customerId: string,
  addressId: string,
): Promise<CustomerProfile> {
  const identity = requireLocalCustomerIdentity(customerId);
  const profile = await getCustomerByPhone(identity.phone, identity.name);
  const address = profile?.addresses.find((item) => item.id === addressId);
  if (!address) throw new Error("Endereço não encontrado.");
  await rpcOrThrow("customer_update_address_by_phone", {
    p_phone: identity.phone,
    p_name: identity.name,
    p_address_id: addressId,
    p_address: addressRpcPayload({ ...address, isDefault: true }),
  });
  const refreshed = await getCustomerByPhone(identity.phone, identity.name);
  if (!refreshed) throw new Error("Não foi possível definir o endereço padrão.");
  return refreshed;
}

function requireLocalCustomerIdentity(customerId?: string) {
  const identity = getLocalCustomerProfile();
  if (!identity?.phone || !identity.name) throw new Error("Informe nome e telefone do cliente.");
  if (customerId && identity.customer_id && identity.customer_id !== customerId) {
    throw new Error("Os dados do cliente mudaram. Informe o telefone novamente.");
  }
  return identity;
}

function addressRpcPayload(address: Omit<CustomerAddress, "id" | "createdAt" | "updatedAt">) {
  return {
    label: address.label,
    street: address.street,
    number: address.number,
    neighborhood: address.neighborhood,
    city: address.city ?? "Santarem",
    state: address.state ?? "PA",
    postal_code: address.postalCode ?? null,
    complement: address.complement ?? null,
    reference: address.reference ?? null,
    latitude: address.latitude ?? null,
    longitude: address.longitude ?? null,
    delivery_zone_id: address.deliveryZoneId ?? null,
    delivery_zone_name: address.deliveryZoneName ?? null,
    delivery_fee_snapshot: address.deliveryFeeSnapshot ?? null,
    is_primary: address.isDefault,
  };
}

export async function loadCustomerOrderDetail(orderId: string) {
  const identity = requireLocalCustomerIdentity();
  return rpcOrThrow<CustomerOrderRpc>("customer_get_order_detail_by_phone", {
    p_phone: identity.phone,
    p_name: identity.name,
    p_order_id: orderId,
  });
}

export async function loadCustomerReorderPayload(orderId: string) {
  const identity = requireLocalCustomerIdentity();
  return rpcOrThrow<CustomerReorderPayload>("customer_reorder_payload_by_phone", {
    p_phone: identity.phone,
    p_name: identity.name,
    p_order_id: orderId,
  });
}

function orderTypeForMode(mode: OrderTrackMode): "delivery" | "dine_in" | "takeaway" {
  if (mode === "delivery") return "delivery";
  if (mode === "mesa") return "dine_in";
  return "takeaway";
}

function paymentMethodForOrder(method?: OrderInfo["paymentMethod"]) {
  if (method === "pix_entrega") return "pix_balcao";
  if (method === "local") return "local";
  return method ?? "pix_app";
}

function secureSelectionsForCartItem(item: CartItem) {
  return (item.product.optionGroups ?? []).flatMap((group) => {
    const validChoiceIds = new Set(group.options.map((choice) => choice.id));
    return (item.selections[group.id] ?? []).map((choiceId) => {
      if (!validChoiceIds.has(choiceId)) {
        throw new Error(
          `Uma opção de ${item.product.name} não está mais disponível. Atualize o item no carrinho.`,
        );
      }
      return {
        group_id: group.id,
        choice_id: choiceId,
      };
    });
  });
}

async function invokeOrderWhatsAppNotification(orderId: string, status: OrderWhatsappStatus) {
  const { error } = await getSupabaseClient().functions.invoke("send-order-whatsapp", {
    body: { orderId, status },
  });
  if (error) throw new Error(error.message);
}

export async function createOrderInSupabase(params: {
  order: Omit<OrderInfo, "id" | "createdAt">;
  cartItems: CartItem[];
  customerId?: string;
  addressId?: string;
  unitId: string;
  tableId?: string | null;
  deliveryFee?: number;
  deliveryDistanceKm?: number | null;
  deliveryRangeId?: string | null;
}) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
  }

  const supabase = getSupabaseClient();
  const unitRows = (await queryOrThrow(
    "order unit",
    supabase
      .from("units")
      .select("id, is_open, business_hours, active")
      .eq("id", params.unitId)
      .eq("active", true)
      .limit(1),
  )) as Array<Pick<UnitRow, "id" | "is_open" | "business_hours" | "active">>;
  const unit = unitRows[0];
  if (!unit || !unit.is_open || !isOpenByBusinessHours(unit.business_hours)) {
    throw new Error("A unidade selecionada está fechada no momento.");
  }
  const paymentMethod = paymentMethodForOrder(params.order.paymentMethod);
  const fingerprint = JSON.stringify({
    unitId: params.unitId,
    mode: params.order.mode,
    phone: params.order.customerPhone,
    tableId: params.tableId,
    addressId: params.addressId,
    address: params.order.address,
    items: params.cartItems.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      selections: item.selections,
      note: item.note,
    })),
  });
  const storageKey = "maximus:secure-checkout-idempotency";
  let idempotencyKey = "";
  try {
    const cached = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") as {
      fingerprint?: string;
      key?: string;
    } | null;
    if (cached?.fingerprint === fingerprint && cached.key) idempotencyKey = cached.key;
  } catch {
    // O checkout continua quando o armazenamento do navegador estiver indisponivel.
  }
  if (!idempotencyKey) {
    idempotencyKey = `checkout-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ fingerprint, key: idempotencyKey }));
    } catch {
      // A transacao do servidor continua protegida mesmo sem sessionStorage.
    }
  }

  const address = params.order.address;
  const { data, error } = await supabase.rpc("create_order_secure", {
    p_payload: {
      idempotency_key: idempotencyKey,
      unit_id: params.unitId,
      unit_slug: params.order.unitSlug,
      order_type: orderTypeForMode(params.order.mode),
      payment_method: paymentMethod,
      customer: {
        name: params.order.customerName ?? "",
        phone: params.order.customerPhone ?? "",
      },
      table_id: params.tableId ?? null,
      customer_address_id: params.addressId ?? null,
      delivery_zone_id: params.order.deliveryZoneId ?? null,
      delivery_range_id: params.deliveryRangeId ?? params.order.deliveryRangeId ?? null,
      delivery_distance_km: params.deliveryDistanceKm ?? null,
      address:
        address && !params.addressId
          ? {
              label: address.label,
              street: address.street,
              number: address.number,
              neighborhood: address.neighborhood,
              city: "Santarem",
              state: "PA",
              postal_code: address.postalCode,
              complement: address.complement,
              reference: address.reference,
              latitude: address.latitude,
              longitude: address.longitude,
              delivery_zone_id: params.order.deliveryZoneId ?? null,
            }
          : null,
      items: params.cartItems.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        selections: secureSelectionsForCartItem(item),
        notes: item.note ?? null,
      })),
    },
  });
  if (error) throw new Error(error.message);
  const result = data as {
    ok?: boolean;
    order_id?: string;
    order_number?: number;
    total?: number | string;
  } | null;
  if (!result?.ok || !result.order_id || result.order_number == null) {
    throw new Error("O servidor nao confirmou a criacao do pedido.");
  }
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    // Ignora bloqueios do armazenamento apos a confirmacao.
  }

  try {
    await invokeOrderWhatsAppNotification(result.order_id, "received");
  } catch (error) {
    console.error("[Maximus][WhatsApp] Falha ao notificar pedido recebido", error);
  }

  rememberLastOrderId(result.order_id);

  return {
    id: result.order_id,
    number: result.order_number,
    createdAt: Date.now(),
    total: Number(result.total ?? params.order.total),
  };
}

export async function getOrderInfo(orderId: string): Promise<OrderInfo | null> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
  }
  const row = await loadCustomerOrderDetail(orderId);
  const identity = requireLocalCustomerIdentity();
  return {
    id: row.id,
    mode: mapOrderMode(row.order_type),
    total: Number(row.total),
    createdAt: new Date(row.created_at).getTime(),
    paymentStatus: row.payment_status as OrderInfo["paymentStatus"],
    paymentMethod: row.payment_method as OrderInfo["paymentMethod"],
    customerName: identity.name,
    customerPhone: identity.phone,
    unitName: row.unit_name ?? undefined,
    deliveryFee: Number(row.delivery_fee ?? 0),
    deliveryZoneName: row.delivery_zone_name ?? undefined,
    deliveryEstimatedTime:
      row.delivery_estimated_time == null ? undefined : Number(row.delivery_estimated_time),
    status: row.status,
    deliveryStatus: row.status,
    customerAddressText: row.customer_address_text ?? undefined,
    items: (row.items ?? []).map((item) => ({
      name: item.product_name,
      quantity: Number(item.quantity),
      total: Number(item.total_price),
    })),
  };
}

export function formatPrice(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
