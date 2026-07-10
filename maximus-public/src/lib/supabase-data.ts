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

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
};

type OrderRow = {
  id: string;
  unit_id: string;
  order_number: number;
  order_type: "delivery" | "dine_in" | "takeaway";
  status: string;
  payment_status: string;
  payment_method: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_notes: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_location_source: OrderInfo["deliveryLocationSource"] | null;
  geocoding_status: OrderInfo["geocodingStatus"] | null;
  customer_lat: number | null;
  customer_lng: number | null;
  customer_address_text: string | null;
  delivery_distance_km: number | null;
  delivery_zone_id: string | null;
  delivery_zone_name: string | null;
  delivery_estimated_time: number | null;
  delivery_calculation_method: string | null;
  delivery_fee: number | null;
  delivery_fee_snapshot: number | null;
  minimum_order_value: number | null;
  driver_lat: number | null;
  driver_lng: number | null;
  total: number;
  created_at: string;
  units?: {
    slug: string;
    name: string;
  } | null;
  customer_addresses?: {
    street: string;
    number: string | null;
    neighborhood: string | null;
    complement: string | null;
    reference: string | null;
    latitude: number | null;
    longitude: number | null;
    delivery_zone_name?: string | null;
  } | null;
};

type OrderItemRow = {
  order_id: string;
  product_name: string;
  quantity: number;
  total_price: number;
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

  return value.map((group) => {
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
  }).filter((group) => group.active !== false).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function mapAddress(row: AddressRow): CustomerAddress {
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
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function mapOrderMode(type: OrderRow["order_type"]): OrderTrackMode {
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

function settingsByUnitId(rows: AdminSettingsRow[] | null | undefined) {
  return new Map((rows ?? []).map((row) => [row.unit_id, row]));
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
  const settings = (await queryOrThrow(
    "admin_settings",
    getSupabaseClient()
      .from("admin_settings")
      .select(
        "unit_id, official_phone, whatsapp_number, minimum_order_value, base_delivery_fee, delivery_fee_per_km, max_delivery_distance_km, free_delivery_from",
      ),
  )) as AdminSettingsRow[];
  const settingsMap = settingsByUnitId(settings);

  return rows.map((unit) => ({
    ...mapPublicUnit(unit, settingsMap.get(unit.id)),
  }));
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
  const adminSettings = (await queryOrThrow(
    "admin_settings",
    supabase
      .from("admin_settings")
      .select(
        "unit_id, official_phone, whatsapp_number, minimum_order_value, base_delivery_fee, delivery_fee_per_km, max_delivery_distance_km, free_delivery_from",
      ),
  )) as AdminSettingsRow[];
  const unitSettings = settingsByUnitId(adminSettings);
  const units = unitRows.map((unit) => mapPublicUnit(unit, unitSettings.get(unit.id)));
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

export async function getCustomerByPhone(phone: string): Promise<CustomerProfile | null> {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) return null;
  const supabase = getSupabaseClient();
  const customers = (await queryOrThrow(
    "customers",
    supabase
      .from("customers")
      .select("id, name, phone, created_at, updated_at")
      .eq("phone", cleanPhone)
      .limit(1),
  )) as CustomerRow[];
  const customer = customers[0];
  if (!customer) return null;
  const [addresses, orderRows] = await Promise.all([
    queryOrThrow(
      "customer_addresses",
      supabase
        .from("customer_addresses")
        .select(
          "id, customer_id, label, street, number, complement, neighborhood, city, state, postal_code, reference, latitude, longitude, delivery_zone_id, delivery_zone_name, delivery_fee_snapshot, is_primary, created_at, updated_at",
        )
        .eq("customer_id", customer.id)
        .eq("is_active", true)
        .order("created_at"),
    ) as Promise<AddressRow[] | null>,
    queryOrThrow(
      "orders",
      supabase
        .from("orders")
        .select(
          "id, unit_id, order_number, order_type, status, payment_status, payment_method, customer_name, customer_phone, total, created_at",
        )
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ) as Promise<OrderRow[] | null>,
  ]);
  const orderIds = (orderRows ?? []).map((order) => order.id);
  const itemRows = orderIds.length
    ? ((await queryOrThrow(
        "order_items",
        supabase
          .from("order_items")
          .select("order_id, product_name, quantity, total_price")
          .in("order_id", orderIds),
      )) as OrderItemRow[])
    : [];
  const itemsByOrder = new Map<string, OrderItemRow[]>();
  for (const item of itemRows) {
    itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item]);
  }

  const profile = {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    addresses: (addresses ?? []).map(mapAddress),
    orders: (orderRows ?? []).map(
      (order): CustomerOrderHistory => ({
        id: order.id,
        number: `#${order.order_number}`,
        date: new Date(order.created_at).getTime(),
        items: (itemsByOrder.get(order.id) ?? []).map((item) => ({
          name: item.product_name,
          quantity: item.quantity,
          total: Number(item.total_price),
        })),
        total: Number(order.total),
        mode: mapOrderMode(order.order_type),
        status: statusLabel(order.status),
      }),
    ),
    createdAt: new Date(customer.created_at).getTime(),
    updatedAt: new Date(customer.updated_at).getTime(),
  };
  saveLocalCustomerProfile({
    name: profile.name,
    phone: profile.phone,
    customer_id: profile.id,
    last_address_id: profile.addresses.find((address) => address.isDefault)?.id,
  });
  return profile;
}

export async function getCurrentCustomerFromSupabase(): Promise<CustomerProfile | null> {
  const localProfile = getLocalCustomerProfile();
  const phone = localProfile?.phone ?? getRememberedCustomerPhone();
  return phone ? getCustomerByPhone(phone) : null;
}

export async function saveCustomerToSupabase(data: {
  name: string;
  phone: string;
}): Promise<CustomerProfile> {
  const phone = normalizePhone(data.phone);
  const supabase = getSupabaseClient();
  const existing = await getCustomerByPhone(phone);
  if (existing) {
    await queryOrThrow(
      "update customer",
      supabase.from("customers").update({ name: data.name.trim() }).eq("id", existing.id),
    );
    rememberCustomerPhone(phone);
    saveLocalCustomerProfile({
      name: data.name,
      phone,
      customer_id: existing.id,
      last_address_id: existing.addresses.find((address) => address.isDefault)?.id,
    });
    return { ...existing, name: data.name.trim(), updatedAt: Date.now() };
  }

  const row = (await queryOrThrow(
    "insert customer",
    supabase
      .from("customers")
      .insert({ name: data.name.trim(), phone })
      .select("id, name, phone, created_at, updated_at")
      .single(),
  )) as CustomerRow;
  rememberCustomerPhone(phone);
  saveLocalCustomerProfile({ name: row.name, phone: row.phone, customer_id: row.id });
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    addresses: [],
    orders: [],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export async function saveAddressToSupabase(
  customerId: string,
  address: Omit<CustomerAddress, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<CustomerProfile> {
  const supabase = getSupabaseClient();
  const payload = {
    customer_id: customerId,
    label: address.label,
    street: address.street,
    number: address.number,
    complement: address.complement ?? null,
    neighborhood: address.neighborhood,
    city: address.city ?? "Santarem",
    state: address.state ?? "PA",
    postal_code: address.postalCode ?? null,
    reference: address.reference ?? null,
    latitude: address.latitude ?? null,
    longitude: address.longitude ?? null,
    delivery_zone_id: address.deliveryZoneId ?? null,
    delivery_zone_name: address.deliveryZoneName ?? address.neighborhood ?? null,
    delivery_fee_snapshot: address.deliveryFeeSnapshot ?? null,
    is_primary: address.isDefault,
    is_active: true,
    deleted_at: null,
  };

  if (address.isDefault) {
    await queryOrThrow(
      "clear default address",
      supabase
        .from("customer_addresses")
        .update({ is_primary: false })
        .eq("customer_id", customerId),
    );
  }

  if (address.id) {
    await queryOrThrow(
      "update address",
      supabase.from("customer_addresses").update(payload).eq("id", address.id),
    );
  } else {
    await queryOrThrow("insert address", supabase.from("customer_addresses").insert(payload));
  }

  const customer = await getCustomerById(customerId);
  if (!customer) throw new Error("Cliente não encontrado.");
  saveLocalCustomerProfile({
    name: customer.name,
    phone: customer.phone,
    customer_id: customer.id,
    last_address_id:
      customer.addresses.find((item) => item.id === address.id)?.id ??
      customer.addresses.find((item) => item.isDefault)?.id ??
      customer.addresses.at(-1)?.id,
  });
  return customer;
}

export async function deleteAddressFromSupabase(
  customerId: string,
  addressId: string,
): Promise<CustomerProfile> {
  const supabase = getSupabaseClient();
  await queryOrThrow(
    "soft delete address",
    supabase
      .from("customer_addresses")
      .update({ is_active: false, deleted_at: new Date().toISOString(), is_primary: false })
      .eq("id", addressId)
      .eq("customer_id", customerId),
  );
  const customer = await getCustomerById(customerId);
  if (!customer) throw new Error("Cliente não encontrado.");
  if (customer.addresses.length > 0 && !customer.addresses.some((address) => address.isDefault)) {
    return saveAddressToSupabase(customerId, { ...customer.addresses[0], isDefault: true });
  }
  return customer;
}

export async function setDefaultAddressOnSupabase(
  customerId: string,
  addressId: string,
): Promise<CustomerProfile> {
  const customer = await getCustomerById(customerId);
  const address = customer?.addresses.find((item) => item.id === addressId);
  if (!customer || !address) throw new Error("Endereço não encontrado.");
  return saveAddressToSupabase(customerId, { ...address, isDefault: true });
}

async function getCustomerById(customerId: string) {
  const rows = (await queryOrThrow(
    "customer by id",
    getSupabaseClient().from("customers").select("phone").eq("id", customerId).limit(1),
  )) as Array<{ phone: string }>;
  return rows[0] ? getCustomerByPhone(rows[0].phone) : null;
}

function orderTypeForMode(mode: OrderTrackMode): "delivery" | "dine_in" | "takeaway" {
  if (mode === "delivery") return "delivery";
  if (mode === "mesa") return "dine_in";
  return "takeaway";
}

function paymentStatusForOrder(status?: OrderInfo["paymentStatus"]) {
  if (status === "pending_on_delivery") return "paid_on_delivery";
  if (status === "paid_on_delivery") return "paid_on_delivery";
  return status ?? "pending";
}

function paymentMethodForOrder(method?: OrderInfo["paymentMethod"]) {
  if (method === "pix_entrega") return "pix_balcao";
  if (method === "local") return "local";
  return method ?? "pix_app";
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
  const orderNumber = Math.floor(Date.now() % 1000000000);
  const subtotal = params.cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const deliveryFee = params.deliveryFee ?? 0;
  const total = subtotal + deliveryFee;
  const paymentStatus = paymentStatusForOrder(params.order.paymentStatus);
  const paymentMethod = paymentMethodForOrder(params.order.paymentMethod);
  const order = (await queryOrThrow(
    "insert order",
    supabase
      .from("orders")
      .insert({
        unit_id: params.unitId,
        unit_name: params.order.unitName ?? null,
        unit_lat: params.order.unitLat ?? null,
        unit_lng: params.order.unitLng ?? null,
        customer_id: params.customerId ?? null,
        customer_address_id: params.addressId ?? null,
        table_id: params.tableId ?? null,
        order_number: orderNumber,
        order_type: orderTypeForMode(params.order.mode),
        status: "received",
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        customer_name: params.order.customerName ?? null,
        customer_phone: params.order.customerPhone ?? null,
        recipient_name: params.order.recipientName ?? null,
        recipient_phone: params.order.recipientPhone ?? null,
        recipient_notes: params.order.recipientNotes ?? null,
        delivery_fee: deliveryFee,
        delivery_fee_snapshot: deliveryFee,
        delivery_range_id: params.deliveryRangeId ?? params.order.deliveryRangeId ?? null,
        delivery_zone_id: params.order.deliveryZoneId ?? null,
        delivery_zone_name: params.order.deliveryZoneName ?? null,
        driver_earned_value: deliveryFee,
        delivery_payout_amount: deliveryFee,
        minimum_order_value: params.order.minimumOrderValue ?? 0,
        delivery_distance_km: params.deliveryDistanceKm ?? null,
        delivery_estimated_time: params.order.deliveryEstimatedTime ?? null,
        delivery_calculation_method: params.order.deliveryCalculationMethod ?? null,
        customer_lat: params.order.customerLat ?? null,
        customer_lng: params.order.customerLng ?? null,
        customer_address_text: params.order.customerAddressText ?? null,
        delivery_lat: params.order.deliveryLat ?? null,
        delivery_lng: params.order.deliveryLng ?? null,
        delivery_location_source: params.order.deliveryLocationSource ?? null,
        geocoding_status: params.order.geocodingStatus ?? null,
        address_street: params.order.address?.street ?? null,
        address_number: params.order.address?.number ?? null,
        address_neighborhood: params.order.address?.neighborhood ?? null,
        address_complement: params.order.address?.complement ?? null,
        address_reference: params.order.address?.reference ?? null,
        subtotal,
        total,
        notes: null,
      })
      .select("id, order_number, created_at")
      .single(),
  )) as { id: string; order_number: number; created_at: string };

  await queryOrThrow(
    "insert order_items",
    supabase.from("order_items").insert(
      params.cartItems.map((item) => ({
        order_id: order.id,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.unitPrice * item.quantity,
        customizations: item.customizations.flatMap((group) =>
          group.options.map((option) => `${group.groupTitle}: ${option.label}`),
        ),
        notes: item.note ?? null,
      })),
    ),
  );

  await queryOrThrow(
    "insert payment",
    supabase.from("payments").insert({
      order_id: order.id,
      method: paymentMethod,
      status: paymentStatus,
      amount: total,
      confirmed_at: paymentStatus === "confirmed" ? new Date().toISOString() : null,
    }),
  );

  try {
    await invokeOrderWhatsAppNotification(order.id, "received");
  } catch (error) {
    console.error("[Maximus][WhatsApp] Falha ao notificar pedido recebido", error);
  }

  rememberLastOrderId(order.id);

  return {
    id: order.id,
    number: order.order_number,
    createdAt: new Date(order.created_at).getTime(),
    total,
  };
}

export async function getOrderInfo(orderId: string): Promise<OrderInfo | null> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
  }

  const rows = (await queryOrThrow(
    "order",
    getSupabaseClient()
      .from("orders")
      .select(
        "id, unit_id, order_number, order_type, status, payment_status, payment_method, customer_name, customer_phone, recipient_name, recipient_phone, recipient_notes, delivery_fee, delivery_fee_snapshot, minimum_order_value, delivery_distance_km, delivery_zone_id, delivery_zone_name, delivery_estimated_time, delivery_calculation_method, delivery_lat, delivery_lng, delivery_location_source, geocoding_status, customer_lat, customer_lng, customer_address_text, driver_lat, driver_lng, total, created_at, units(slug, name), customer_addresses(street, number, neighborhood, complement, reference, latitude, longitude, delivery_zone_name)",
      )
      .eq("id", orderId)
      .limit(1),
  )) as OrderRow[];
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    mode: mapOrderMode(row.order_type),
    total: Number(row.total),
    createdAt: new Date(row.created_at).getTime(),
    paymentStatus:
      row.payment_status === "paid_on_delivery"
        ? "pending_on_delivery"
        : (row.payment_status as OrderInfo["paymentStatus"]),
    paymentMethod: row.payment_method as OrderInfo["paymentMethod"],
    customerName: row.customer_name ?? undefined,
    customerPhone: row.customer_phone ?? undefined,
    recipientName: row.recipient_name ?? undefined,
    recipientPhone: row.recipient_phone ?? undefined,
    recipientNotes: row.recipient_notes ?? undefined,
    unitId: row.unit_id,
    unitSlug: row.units?.slug,
    unitName: row.units?.name,
    deliveryFee: Number(row.delivery_fee ?? row.delivery_fee_snapshot ?? 0),
    deliveryDistanceKm:
      row.delivery_distance_km == null ? undefined : Number(row.delivery_distance_km),
    deliveryZoneId: row.delivery_zone_id ?? undefined,
    deliveryZoneName: row.delivery_zone_name ?? row.customer_addresses?.delivery_zone_name ?? undefined,
    deliveryEstimatedTime:
      row.delivery_estimated_time == null ? undefined : Number(row.delivery_estimated_time),
    deliveryCalculationMethod: row.delivery_calculation_method ?? undefined,
    minimumOrderValue: Number(row.minimum_order_value ?? 0),
    status: row.status,
    deliveryStatus: row.status,
    deliveryLat: row.delivery_lat ?? row.customer_addresses?.latitude ?? undefined,
    deliveryLng: row.delivery_lng ?? row.customer_addresses?.longitude ?? undefined,
    deliveryLocationSource: row.delivery_location_source ?? undefined,
    geocodingStatus: row.geocoding_status ?? undefined,
    customerLat: row.customer_lat ?? undefined,
    customerLng: row.customer_lng ?? undefined,
    customerAddressText:
      row.customer_address_text ??
      (row.customer_addresses
        ? [
            `${row.customer_addresses.street}${
              row.customer_addresses.number ? `, ${row.customer_addresses.number}` : ""
            }`,
            row.customer_addresses.neighborhood,
            row.customer_addresses.complement
              ? `Compl.: ${row.customer_addresses.complement}`
              : null,
            row.customer_addresses.reference ? `Ref.: ${row.customer_addresses.reference}` : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : undefined),
    driverLat: row.driver_lat ?? undefined,
    driverLng: row.driver_lng ?? undefined,
  };
}

export function formatPrice(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
