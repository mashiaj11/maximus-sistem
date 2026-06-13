import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type {
  AdminUnit,
  Category,
  Courier,
  CourierStatus,
  DeliveryRule,
  KitchenPrintSettings,
  Order,
  OrderItem,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductDraft,
  RestaurantTable,
  TableStatus,
  UnitId,
} from "./data/types";
import { UNITS } from "./data/units";

type UnitRow = {
  id: string;
  slug: UnitId;
  name: string;
  phone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_open: boolean;
  business_hours: unknown;
  theme: AdminUnit["theme"];
  kitchen_print_settings: unknown;
};

type CategoryRow = {
  id: string;
  name: string;
  sort_order: number;
  availability_scope: NonNullable<Category["availabilityScope"]>;
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
  option_groups: Product["optionGroups"] | null;
  available: boolean;
};

type StoreTableRow = {
  id: string;
  unit_id: string;
  table_number: number;
  public_url: string;
  qr_code_data: string;
  status: TableStatus;
  active: boolean;
  is_active: boolean | null;
  deleted_at: string | null;
  created_at: string;
};

type DriverRow = {
  id: string;
  unit_id: string;
  name: string;
  phone: string | null;
  username: string | null;
  access_pin: string | null;
  status: CourierStatus;
  active: boolean;
  is_active: boolean | null;
  deleted_at: string | null;
};

type DeliveryRuleRow = {
  id: string;
  unit_id: string;
  max_distance_km: number;
  estimated_minutes: number;
  delivery_fee: number;
  active: boolean;
};

type AdminSettingsRow = {
  unit_id: string;
  settings: unknown;
  require_driver_completion: boolean;
  whatsapp_enabled: boolean;
  whatsapp_number: string | null;
  whatsapp_messages: unknown;
  official_phone: string | null;
  delivery_panel_enabled: boolean;
  kitchen_print_enabled: boolean;
  kitchen_print_settings: unknown;
  minimum_order_value: number | null;
  base_delivery_fee: number | null;
  delivery_fee_per_km: number | null;
  max_delivery_distance_km: number | null;
  free_delivery_from: number | null;
  admin_pin: string | null;
};

type OrderRow = {
  id: string;
  unit_id: string;
  customer_address_id: string | null;
  table_id: string | null;
  delivery_driver_id: string | null;
  delivery_driver_name: string | null;
  order_number: number;
  order_type: "delivery" | "dine_in" | "takeaway";
  status:
    | "received"
    | "accepted"
    | "in_preparation"
    | "ready"
    | "out_for_delivery"
    | "driver_on_way"
    | "driver_nearby"
    | "arrived"
    | "ready_for_pickup"
    | "delivered_to_table"
    | "picked_up"
    | "delivered"
    | "cancelled";
  payment_status:
    | "pending"
    | "customer_reported_paid"
    | "confirmed"
    | "rejected"
    | "paid_on_delivery";
  payment_method: PaymentMethod | null;
  customer_name: string | null;
  customer_phone: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_notes: string | null;
  delivery_fee: number;
  delivery_fee_snapshot: number | null;
  minimum_order_value: number | null;
  driver_earned_value: number | null;
  delivery_payout_amount: number;
  delivery_distance_km: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_location_source: Order["deliveryLocationSource"] | null;
  geocoding_status: Order["geocodingStatus"] | null;
  customer_lat: number | null;
  customer_lng: number | null;
  customer_address_text: string | null;
  driver_lat: number | null;
  driver_lng: number | null;
  driver_id: string | null;
  driver_name: string | null;
  payment_confirmed: boolean;
  delivery_completed_by_driver: boolean;
  kitchen_print_status: Order["kitchenPrintStatus"];
  kitchen_printed_at: string | null;
  out_for_delivery_at: string | null;
  navigation_started_at: string | null;
  delivered_at: string | null;
  subtotal: number;
  total: number;
  notes: string | null;
  created_at: string;
};

type CustomerAddressRow = {
  id: string;
  street: string;
  number: string | null;
  neighborhood: string | null;
  complement: string | null;
  reference: string | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  customizations: string[] | null;
  notes: string | null;
};

export type SupabaseAdminData = {
  units: AdminUnit[];
  orders: Order[];
  categories: Category[];
  products: Product[];
  tables: RestaurantTable[];
  couriers: Courier[];
  deliveryRules: DeliveryRule[];
};

const DB_TYPE_BY_APP: Record<OrderType, OrderRow["order_type"]> = {
  delivery: "delivery",
  mesa: "dine_in",
  levar: "takeaway",
  balcao: "takeaway",
};

const APP_TYPE_BY_DB: Record<OrderRow["order_type"], OrderType> = {
  delivery: "delivery",
  dine_in: "mesa",
  takeaway: "levar",
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function assertConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase nao configurado.");
  }
}

function buildUnitLookups(units: UnitRow[]) {
  const idBySlug = new Map<UnitId, string>();
  const slugById = new Map<string, UnitId>();

  for (const unit of units) {
    idBySlug.set(unit.slug, unit.id);
    slugById.set(unit.id, unit.slug);
  }

  return { idBySlug, slugById };
}

function fallbackUnit(unitId: UnitId) {
  return UNITS.find((unit) => unit.id === unitId) ?? UNITS[0];
}

const WEEKDAY_KEYS: AdminUnit["businessHours"][number]["day"][] = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
];

const FALLBACK_KITCHEN_PRINT_SETTINGS: KitchenPrintSettings = {
  autoPrintEnabled: false,
  printerName: "Cozinha",
  printerIp: "",
  printerPort: 9100,
  printerType: "escpos",
  copies: 1,
};

function normalizeBusinessHours(value: unknown, fallback: AdminUnit["businessHours"]) {
  const rows =
    Array.isArray(value) && value.length
      ? (value as Array<Partial<AdminUnit["businessHours"][number]>>)
      : fallback.length
        ? fallback
        : WEEKDAY_KEYS.map((day) => ({ day, open: false, periods: [] }));
  return rows.map((hour) => {
    const periods =
      Array.isArray(hour.periods) && hour.periods.length
        ? hour.periods
        : hour.opensAt && hour.closesAt
          ? [{ opensAt: hour.opensAt, closesAt: hour.closesAt }]
          : [];
    return {
      day: hour.day as AdminUnit["businessHours"][number]["day"],
      open: Boolean(hour.open),
      periods: periods.map((period) => ({
        opensAt: period.opensAt ?? "",
        closesAt: period.closesAt ?? "",
      })),
    };
  });
}

function mapUnit(row: UnitRow, settings?: AdminSettingsRow): AdminUnit {
  const fallback = fallbackUnit(row.slug);
  const fallbackKitchenPrintSettings =
    fallback.kitchenPrintSettings ?? FALLBACK_KITCHEN_PRINT_SETTINGS;
  const unitPatch =
    settings?.settings && typeof settings.settings === "object"
      ? ((settings.settings as { unit_patch?: Partial<AdminUnit> }).unit_patch ?? {})
      : {};
  const whatsappMessages =
    settings?.whatsapp_messages && typeof settings.whatsapp_messages === "object"
      ? (settings.whatsapp_messages as Partial<AdminUnit["whatsappSettings"]>)
      : {};
  const kitchenPrintSettings =
    settings?.kitchen_print_settings && typeof settings.kitchen_print_settings === "object"
      ? (settings.kitchen_print_settings as Partial<KitchenPrintSettings>)
      : {};

  return {
    id: row.slug,
    name: unitPatch.name ?? row.name,
    phone: unitPatch.phone ?? settings?.official_phone ?? row.phone ?? fallback.phone,
    address: unitPatch.address ?? row.address ?? fallback.address,
    latitude: Number(unitPatch.latitude ?? row.latitude ?? fallback.latitude),
    longitude: Number(unitPatch.longitude ?? row.longitude ?? fallback.longitude),
    isOpen: unitPatch.isOpen ?? row.is_open,
    businessHours: normalizeBusinessHours(unitPatch.businessHours ?? row.business_hours, []),
    theme: unitPatch.theme ?? row.theme ?? fallback.theme,
    accessPin: settings?.admin_pin ?? unitPatch.accessPin ?? fallback.accessPin,
    kitchenPrintSettings:
      row.kitchen_print_settings && typeof row.kitchen_print_settings === "object"
        ? {
            ...fallbackKitchenPrintSettings,
            ...(row.kitchen_print_settings as Partial<KitchenPrintSettings>),
            ...kitchenPrintSettings,
            autoPrintEnabled:
              settings?.kitchen_print_enabled ??
              (row.kitchen_print_settings as Partial<KitchenPrintSettings>).autoPrintEnabled,
          }
        : {
            ...fallbackKitchenPrintSettings,
            ...kitchenPrintSettings,
            autoPrintEnabled:
              settings?.kitchen_print_enabled ?? fallbackKitchenPrintSettings.autoPrintEnabled,
          },
    whatsappSettings: {
      ...fallback.whatsappSettings,
      ...whatsappMessages,
      enabled: settings?.whatsapp_enabled ?? fallback.whatsappSettings?.enabled ?? false,
      provider: whatsappMessages.provider ?? "none",
      apiUrl: whatsappMessages.apiUrl ?? "",
      apiKey: whatsappMessages.apiKey ?? "",
      instanceId: whatsappMessages.instanceId ?? "",
      officialNumber:
        settings?.whatsapp_number ??
        settings?.official_phone ??
        fallback.whatsappSettings?.officialNumber ??
        row.phone ??
        fallback.phone,
    } as AdminUnit["whatsappSettings"],
    driverPanelSettings: {
      ...fallback.driverPanelSettings,
      enabled:
        settings?.require_driver_completion ??
        settings?.delivery_panel_enabled ??
        fallback.driverPanelSettings?.enabled ??
        false,
    },
    minimumOrderValue: Number(settings?.minimum_order_value ?? 0),
    baseDeliveryFee: Number(settings?.base_delivery_fee ?? 0),
    deliveryFeePerKm: Number(settings?.delivery_fee_per_km ?? 0),
    maxDeliveryDistanceKm: Number(settings?.max_delivery_distance_km ?? 0),
    freeDeliveryFrom: Number(settings?.free_delivery_from ?? 0),
  };
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    order: row.sort_order,
    activeByUnit: {
      "maximus-01": row.active,
      "maximus-02": row.active,
    },
    availabilityScope: row.availability_scope,
  };
}

function mapProduct(row: ProductRow, slugById: Map<string, UnitId>): Product {
  const unitId = slugById.get(row.unit_id);

  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    price: Number(row.price),
    active: row.available,
    unitIds: unitId ? [unitId] : [],
    description: row.description ?? undefined,
    imageUrl: row.image_url ?? undefined,
    optionGroups: Array.isArray(row.option_groups) ? row.option_groups : [],
  };
}

function mapTable(row: StoreTableRow, slugById: Map<string, UnitId>): RestaurantTable | null {
  const unitId = slugById.get(row.unit_id);
  if (!unitId) return null;

  return {
    id: row.id,
    unitId,
    number: row.table_number,
    status: row.status,
    active: row.active && row.is_active !== false && row.deleted_at == null,
    menuLink: row.public_url,
    publicUrl: row.public_url,
    qrCodeData: row.qr_code_data,
    createdAt: row.created_at,
  };
}

function mapCourier(row: DriverRow, slugById: Map<string, UnitId>): Courier | null {
  const unitId = slugById.get(row.unit_id);
  if (!unitId) return null;
  return {
    id: row.id,
    unitId,
    name: row.name,
    phone: row.phone ?? "",
    username: row.username ?? undefined,
    accessPin: row.access_pin ?? undefined,
    status: row.status,
    active: row.active && row.is_active !== false,
    isActive: row.is_active !== false,
    deletedAt: row.deleted_at ?? undefined,
  };
}

function mapDeliveryRule(row: DeliveryRuleRow, slugById: Map<string, UnitId>): DeliveryRule | null {
  const unitId = slugById.get(row.unit_id);
  if (!unitId) return null;

  return {
    id: row.id,
    unitId,
    maxDistanceKm: Number(row.max_distance_km),
    estimatedMinutes: row.estimated_minutes,
    deliveryFee: Number(row.delivery_fee),
    isActive: row.active,
  };
}

function mapOrder(
  row: OrderRow,
  items: OrderItemRow[],
  slugById: Map<string, UnitId>,
  tableNumberById: Map<string, number>,
  addressById: Map<string, CustomerAddressRow>,
): Order | null {
  const unitId = slugById.get(row.unit_id);
  if (!unitId) return null;

  const mappedItems: OrderItem[] = items.map((item) => ({
    id: item.id,
    name: item.product_name,
    quantity: item.quantity,
    unitPrice: Number(item.unit_price),
    customizations: Array.isArray(item.customizations) ? item.customizations : [],
    notes: item.notes ?? undefined,
  }));

  const paymentStatus: PaymentStatus =
    row.payment_status === "paid_on_delivery" ? "confirmed" : row.payment_status;
  const address = row.customer_address_id ? addressById.get(row.customer_address_id) : null;
  const addressText = address
    ? [
        `${address.street}${address.number ? `, ${address.number}` : ""}`,
        address.neighborhood,
        address.complement ? `Compl.: ${address.complement}` : null,
        address.reference ? `Ref.: ${address.reference}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  return {
    id: row.id,
    unitId,
    number: row.order_number,
    customerName: row.customer_name ?? "Cliente",
    customerPhone: row.customer_phone ?? undefined,
    recipientName: row.recipient_name ?? undefined,
    recipientPhone: row.recipient_phone ?? undefined,
    recipientNotes: row.recipient_notes ?? undefined,
    type: APP_TYPE_BY_DB[row.order_type],
    status: row.status,
    paymentMethod: row.payment_method ?? "pix_app",
    paymentStatus,
    total: Number(row.total),
    createdAt: row.created_at,
    items: mappedItems,
    notes: row.notes ?? undefined,
    address: addressText,
    tableNumber: row.table_id ? tableNumberById.get(row.table_id) : undefined,
    courierId: row.delivery_driver_id ?? undefined,
    courierName: row.delivery_driver_name ?? undefined,
    deliveryFee: Number(row.delivery_fee),
    delivery_fee: Number(row.delivery_fee),
    deliveryFeeSnapshot: Number(row.delivery_fee_snapshot ?? row.delivery_fee),
    delivery_fee_snapshot: Number(row.delivery_fee_snapshot ?? row.delivery_fee),
    deliveryDriverId: row.delivery_driver_id ?? undefined,
    deliveryDriverName: row.delivery_driver_name ?? undefined,
    courierFee: Number(row.driver_earned_value ?? row.delivery_payout_amount),
    deliveryPayoutAmount: Number(row.driver_earned_value ?? row.delivery_payout_amount),
    driverEarnedValue: Number(row.driver_earned_value ?? row.delivery_payout_amount),
    driver_earned_value: Number(row.driver_earned_value ?? row.delivery_payout_amount),
    deliveryDistanceKm:
      row.delivery_distance_km == null ? undefined : Number(row.delivery_distance_km),
    delivery_lat: row.delivery_lat ?? undefined,
    delivery_lng: row.delivery_lng ?? undefined,
    deliveryLat: row.delivery_lat ?? undefined,
    deliveryLng: row.delivery_lng ?? undefined,
    deliveryLocationSource: row.delivery_location_source ?? undefined,
    geocodingStatus: row.geocoding_status ?? undefined,
    geocoding_status: row.geocoding_status ?? undefined,
    customer_lat: row.customer_lat ?? undefined,
    customer_lng: row.customer_lng ?? undefined,
    customerLat: row.customer_lat ?? undefined,
    customerLng: row.customer_lng ?? undefined,
    customerAddressText: row.customer_address_text ?? addressText,
    driver_lat: row.driver_lat ?? undefined,
    driver_lng: row.driver_lng ?? undefined,
    driverLat: row.driver_lat ?? undefined,
    driverLng: row.driver_lng ?? undefined,
    driver_id: row.driver_id ?? row.delivery_driver_id ?? undefined,
    driver_name: row.driver_name ?? row.delivery_driver_name ?? undefined,
    payment_confirmed: row.payment_confirmed,
    delivery_completed_by_driver: row.delivery_completed_by_driver,
    outForDeliveryAt: row.out_for_delivery_at ?? undefined,
    navigationStartedAt: row.navigation_started_at ?? undefined,
    navigation_started_at: row.navigation_started_at ?? undefined,
    deliveredAt: row.delivered_at ?? undefined,
    kitchenPrintStatus: row.kitchen_print_status,
    kitchenPrintedAt: row.kitchen_printed_at ?? undefined,
  };
}

async function selectOrThrow<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function loadSupabaseAdminData(): Promise<SupabaseAdminData> {
  assertConfigured();
  const supabase = getSupabaseClient();

  const units = (await selectOrThrow(
    supabase
      .from("units")
      .select(
        "id, slug, name, phone, address, latitude, longitude, is_open, business_hours, theme, kitchen_print_settings",
      )
      .eq("active", true)
      .order("slug"),
  )) as UnitRow[];
  const { idBySlug, slugById } = buildUnitLookups(units);

  const [categories, products, tables, couriers, deliveryRules, adminSettings] = await Promise.all([
    selectOrThrow(
      supabase
        .from("categories")
        .select("id, name, sort_order, availability_scope, active")
        .order("sort_order", { ascending: true }),
    ) as Promise<CategoryRow[] | null>,
    selectOrThrow(
      supabase
        .from("products")
        .select(
          "id, unit_id, category_id, name, description, price, image_url, option_groups, available",
        )
        .order("name", { ascending: true }),
    ) as Promise<ProductRow[] | null>,
    selectOrThrow(
      supabase
        .from("store_tables")
        .select(
          "id, unit_id, table_number, public_url, qr_code_data, status, active, is_active, deleted_at, created_at",
        )
        .eq("active", true)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("table_number", { ascending: true }),
    ) as Promise<StoreTableRow[] | null>,
    selectOrThrow(
      supabase
        .from("delivery_drivers")
        .select(
          "id, unit_id, name, phone, username, access_pin, status, active, is_active, deleted_at",
        )
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ) as Promise<DriverRow[] | null>,
    selectOrThrow(
      supabase
        .from("delivery_fee_rules")
        .select("id, unit_id, max_distance_km, estimated_minutes, delivery_fee, active")
        .order("max_distance_km", { ascending: true }),
    ) as Promise<DeliveryRuleRow[] | null>,
    selectOrThrow(
      supabase
        .from("admin_settings")
        .select(
          "unit_id, settings, require_driver_completion, whatsapp_enabled, whatsapp_number, whatsapp_messages, official_phone, delivery_panel_enabled, kitchen_print_enabled, kitchen_print_settings, minimum_order_value, base_delivery_fee, delivery_fee_per_km, max_delivery_distance_km, free_delivery_from, admin_pin",
        ),
    ) as Promise<AdminSettingsRow[] | null>,
  ]);
  const adminSettingsByUnitId = new Map((adminSettings ?? []).map((row) => [row.unit_id, row]));
  const orderRows = (await selectOrThrow(
    supabase
      .from("orders")
      .select(
        "id, unit_id, customer_address_id, table_id, delivery_driver_id, delivery_driver_name, order_number, order_type, status, payment_status, payment_method, customer_name, customer_phone, recipient_name, recipient_phone, recipient_notes, delivery_fee, delivery_fee_snapshot, minimum_order_value, delivery_payout_amount, driver_earned_value, delivery_distance_km, delivery_lat, delivery_lng, delivery_location_source, geocoding_status, customer_lat, customer_lng, customer_address_text, driver_lat, driver_lng, driver_id, driver_name, payment_confirmed, delivery_completed_by_driver, kitchen_print_status, kitchen_printed_at, out_for_delivery_at, navigation_started_at, delivered_at, subtotal, total, notes, created_at",
      )
      .order("created_at", { ascending: false }),
  )) as OrderRow[];
  const orderItems = orderRows.length
    ? ((await selectOrThrow(
        supabase
          .from("order_items")
          .select("id, order_id, product_name, quantity, unit_price, customizations, notes")
          .in(
            "order_id",
            orderRows.map((order) => order.id),
          ),
      )) as OrderItemRow[])
    : [];
  const addressIds = [
    ...new Set(
      orderRows.map((order) => order.customer_address_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  const addresses = addressIds.length
    ? ((await selectOrThrow(
        supabase
          .from("customer_addresses")
          .select("id, street, number, neighborhood, complement, reference")
          .in("id", addressIds),
      )) as CustomerAddressRow[])
    : [];
  const addressById = new Map(addresses.map((address) => [address.id, address]));
  const orderItemsByOrder = new Map<string, OrderItemRow[]>();
  for (const item of orderItems) {
    orderItemsByOrder.set(item.order_id, [...(orderItemsByOrder.get(item.order_id) ?? []), item]);
  }
  const tableNumberById = new Map<string, number>();
  for (const table of tables ?? []) {
    tableNumberById.set(table.id, table.table_number);
  }

  if (!idBySlug.size) {
    throw new Error("Nenhuma unidade encontrada no Supabase.");
  }

  return {
    units: units.map((unit) => mapUnit(unit, adminSettingsByUnitId.get(unit.id))),
    orders: orderRows
      .map((order) =>
        mapOrder(
          order,
          orderItemsByOrder.get(order.id) ?? [],
          slugById,
          tableNumberById,
          addressById,
        ),
      )
      .filter((order): order is Order => Boolean(order)),
    categories: (categories ?? []).map(mapCategory),
    products: (products ?? []).map((product) => mapProduct(product, slugById)),
    tables: (tables ?? [])
      .map((table) => mapTable(table, slugById))
      .filter((table): table is RestaurantTable => Boolean(table)),
    couriers: (couriers ?? [])
      .map((courier) => mapCourier(courier, slugById))
      .filter((courier): courier is Courier => Boolean(courier)),
    deliveryRules: (deliveryRules ?? [])
      .map((rule) => mapDeliveryRule(rule, slugById))
      .filter((rule): rule is DeliveryRule => Boolean(rule)),
  };
}

export async function updateSupabaseOrderStatus(
  orderId: string,
  status: OrderStatus,
  deliveredAt?: string,
) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("orders")
    .update({
      status,
      delivered_at: deliveredAt,
      kitchen_print_status: status === "in_preparation" ? "pending" : undefined,
    })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}

export async function updateSupabaseOrderKitchenPrintStatus(
  orderId: string,
  kitchenPrintStatus: NonNullable<Order["kitchenPrintStatus"]>,
  kitchenPrintedAt?: string,
) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("orders")
    .update({
      kitchen_print_status: kitchenPrintStatus,
      kitchen_printed_at: kitchenPrintedAt,
    })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}

export async function assignSupabaseDeliveryDriver(
  orderId: string,
  courier: Courier,
  payoutAmount: number,
  outForDeliveryAt: string,
) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("orders")
    .update({
      status: "out_for_delivery",
      delivery_driver_id: courier.id,
      delivery_driver_name: courier.name,
      delivery_payout_amount: payoutAmount,
      driver_earned_value: payoutAmount,
      out_for_delivery_at: outForDeliveryAt,
    })
    .eq("id", orderId);
  if (error) throw new Error(error.message);

  await updateSupabaseCourier(courier.id, { status: "em_entrega", active: true });
}

export async function updateSupabaseOrderPayment(order: Order, paymentStatus: PaymentStatus) {
  assertConfigured();
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("orders")
    .update({ payment_status: paymentStatus })
    .eq("id", order.id);
  if (error) throw new Error(error.message);

  const { error: paymentError } = await supabase.from("payments").insert({
    order_id: order.id,
    method: order.paymentMethod,
    status: paymentStatus,
    amount: order.total,
    confirmed_at: paymentStatus === "confirmed" ? new Date().toISOString() : null,
  });
  if (paymentError) throw new Error(paymentError.message);
}

export async function updateSupabaseDriverLocation(
  orderId: string,
  latitude: number,
  longitude: number,
  status: OrderStatus = "driver_on_way",
) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("orders")
    .update({
      driver_lat: latitude,
      driver_lng: longitude,
      status,
      delivery_status: status,
    })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}

export async function startSupabaseDeliveryNavigation(order: Order, startedAt: string) {
  assertConfigured();
  const shouldMoveOut = order.status === "ready" || order.status === "ready_for_pickup";
  const { error } = await getSupabaseClient()
    .from("orders")
    .update({
      navigation_started_at: startedAt,
      status: shouldMoveOut ? "out_for_delivery" : order.status,
      delivery_status: shouldMoveOut ? "out_for_delivery" : order.deliveryStatus,
      out_for_delivery_at: shouldMoveOut
        ? (order.outForDeliveryAt ?? startedAt)
        : order.outForDeliveryAt,
    })
    .eq("id", order.id);
  if (error) throw new Error(error.message);
}

export async function completeSupabaseDeliveryByDriver(
  order: Order,
  paymentConfirmed: boolean,
  deliveredAt: string,
) {
  assertConfigured();
  const supabase = getSupabaseClient();
  const nextPaymentStatus = paymentConfirmed ? "confirmed" : order.paymentStatus;
  const driverId = order.deliveryDriverId ?? order.courierId ?? order.driver_id ?? null;
  const driverName = order.deliveryDriverName ?? order.courierName ?? order.driver_name ?? null;
  const { error } = await supabase
    .from("orders")
    .update({
      status: "delivered",
      delivery_status: "delivered",
      delivered_at: deliveredAt,
      payment_status: nextPaymentStatus,
      payment_confirmed: paymentConfirmed || order.paymentStatus === "confirmed",
      delivery_completed_by_driver: true,
      delivery_driver_id: driverId,
      delivery_driver_name: driverName,
      driver_id: driverId,
      driver_name: driverName,
    })
    .eq("id", order.id);
  if (error) throw new Error(error.message);

  if (paymentConfirmed) {
    const { error: paymentError } = await supabase.from("payments").insert({
      order_id: order.id,
      method: order.paymentMethod,
      status: "confirmed",
      amount: order.total,
      confirmed_at: deliveredAt,
    });
    if (paymentError) throw new Error(paymentError.message);
  }

  if (driverId) {
    await updateSupabaseCourier(driverId, { status: "disponivel", active: true });
  }
}

export async function updateSupabaseUnit(unitId: UnitId, patch: Partial<AdminUnit>) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("units")
    .update({
      name: patch.name,
      phone: patch.phone,
      address: patch.address,
      latitude: patch.latitude,
      longitude: patch.longitude,
      is_open: patch.isOpen,
      business_hours: patch.businessHours,
      theme: patch.theme,
      kitchen_print_settings: patch.kitchenPrintSettings,
    })
    .eq("slug", unitId);
  if (error) throw new Error(error.message);
}

export async function upsertSupabaseAdminSettings(unit: AdminUnit) {
  assertConfigured();
  const supabase = getSupabaseClient();
  const unitRow = (await selectOrThrow(
    supabase.from("units").select("id").eq("slug", unit.id).single(),
  )) as Pick<UnitRow, "id">;
  const whatsappSettings = unit.whatsappSettings;
  const kitchenPrintSettings = unit.kitchenPrintSettings;
  const driverPanelSettings = unit.driverPanelSettings;
  const { error } = await supabase.from("admin_settings").upsert(
    {
      unit_id: unitRow.id,
      settings: {
        unit_patch: {
          name: unit.name,
          phone: unit.phone,
          address: unit.address,
          latitude: unit.latitude,
          longitude: unit.longitude,
          isOpen: unit.isOpen,
          businessHours: unit.businessHours,
          theme: unit.theme,
          accessPin: unit.accessPin,
          kitchenPrintSettings,
          whatsappSettings,
          driverPanelSettings,
        },
      },
      require_driver_completion: Boolean(driverPanelSettings?.enabled),
      whatsapp_enabled: Boolean(whatsappSettings?.enabled),
      whatsapp_number: whatsappSettings?.officialNumber ?? unit.phone,
      whatsapp_messages: whatsappSettings ?? {},
      official_phone: unit.phone,
      delivery_panel_enabled: Boolean(driverPanelSettings?.enabled),
      kitchen_print_enabled: Boolean(kitchenPrintSettings?.autoPrintEnabled),
      kitchen_print_settings: kitchenPrintSettings ?? {},
      minimum_order_value: unit.minimumOrderValue ?? 0,
      base_delivery_fee: unit.baseDeliveryFee ?? 0,
      delivery_fee_per_km: unit.deliveryFeePerKm ?? 0,
      max_delivery_distance_km: unit.maxDeliveryDistanceKm ?? 0,
      free_delivery_from: unit.freeDeliveryFrom ?? 0,
      admin_pin: unit.accessPin,
    },
    { onConflict: "unit_id" },
  );
  if (error) throw new Error(error.message);
}

export async function insertSupabaseCategory(name: string, order: number): Promise<Category> {
  assertConfigured();
  const cleanName = name.trim();
  const { data, error } = await getSupabaseClient()
    .from("categories")
    .insert({
      name: cleanName,
      slug: `${slugify(cleanName)}-${Date.now().toString(36)}`,
      sort_order: order,
    })
    .select("id, name, sort_order, availability_scope, active")
    .single();
  if (error) throw new Error(error.message);
  return mapCategory(data as CategoryRow);
}

export async function updateSupabaseCategory(
  categoryId: string,
  patch: Partial<Pick<Category, "name" | "order">>,
) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("categories")
    .update({ name: patch.name, sort_order: patch.order })
    .eq("id", categoryId);
  if (error) throw new Error(error.message);
}

export async function deleteSupabaseCategory(categoryId: string) {
  assertConfigured();
  const { error } = await getSupabaseClient().from("categories").delete().eq("id", categoryId);
  if (error) throw new Error(error.message);
}

export async function setSupabaseCategoryActive(categoryId: string, active: boolean) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("categories")
    .update({ active })
    .eq("id", categoryId);
  if (error) throw new Error(error.message);
}

export async function insertSupabaseProduct(unitId: UnitId, data: ProductDraft): Promise<Product> {
  assertConfigured();
  const supabase = getSupabaseClient();
  const unitRow = (await selectOrThrow(
    supabase.from("units").select("id, slug").eq("slug", unitId).single(),
  )) as UnitRow;
  const cleanName = data.name.trim();
  const { data: row, error } = await supabase
    .from("products")
    .insert({
      unit_id: unitRow.id,
      category_id: data.categoryId,
      name: cleanName,
      slug: `${slugify(cleanName)}-${Date.now().toString(36)}`,
      description: data.description?.trim() || null,
      price: data.price,
      image_url: data.imageUrl ?? null,
      option_groups: data.optionGroups ?? [],
      available: data.active,
    })
    .select(
      "id, unit_id, category_id, name, description, price, image_url, option_groups, available",
    )
    .single();
  if (error) throw new Error(error.message);
  return mapProduct(row as ProductRow, new Map([[unitRow.id, unitRow.slug]]));
}

export async function updateSupabaseProduct(productId: string, patch: Partial<Product>) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("products")
    .update({
      name: patch.name,
      category_id: patch.categoryId,
      description: patch.description,
      price: patch.price,
      image_url: patch.imageUrl,
      option_groups: patch.optionGroups,
      available: patch.active,
    })
    .eq("id", productId);
  if (error) throw new Error(error.message);
}

export async function deleteSupabaseProduct(productId: string) {
  assertConfigured();
  const { error } = await getSupabaseClient().from("products").delete().eq("id", productId);
  if (error) throw new Error(error.message);
}

export async function setSupabaseProductAvailable(productId: string, available: boolean) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("products")
    .update({ available })
    .eq("id", productId);
  if (error) throw new Error(error.message);
}

export async function insertSupabaseTable(
  unitId: UnitId,
  tableNumber?: number,
): Promise<RestaurantTable> {
  assertConfigured();
  const supabase = getSupabaseClient();
  const unitRow = (await selectOrThrow(
    supabase.from("units").select("id, slug").eq("slug", unitId).single(),
  )) as UnitRow;
  const lastRows = (await selectOrThrow(
    supabase
      .from("store_tables")
      .select("table_number")
      .eq("unit_id", unitRow.id)
      .order("table_number", { ascending: false })
      .limit(1),
  )) as Array<{ table_number: number }>;
  const nextNumber = Math.max(tableNumber ?? 0, (lastRows[0]?.table_number ?? 0) + 1);
  const publicUrl = `/menu?unidade=${unitId}&mesa=${String(nextNumber).padStart(2, "0")}`;
  const { data, error } = await supabase
    .from("store_tables")
    .insert({
      unit_id: unitRow.id,
      table_number: nextNumber,
      public_url: publicUrl,
      qr_code_data: publicUrl,
      active: true,
      is_active: true,
      deleted_at: null,
    })
    .select(
      "id, unit_id, table_number, public_url, qr_code_data, status, active, is_active, deleted_at, created_at",
    )
    .single();
  if (error) throw new Error(error.message);
  const table = mapTable(data as StoreTableRow, new Map([[unitRow.id, unitRow.slug]]));
  if (!table) throw new Error("Mesa criada sem unidade valida.");
  return table;
}

export async function updateSupabaseTable(
  tableId: string,
  patch: Partial<Pick<RestaurantTable, "status" | "active">>,
) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("store_tables")
    .update({ status: patch.status, active: patch.active, is_active: patch.active })
    .eq("id", tableId);
  if (error) throw new Error(error.message);
}

export async function deleteSupabaseTable(tableId: string, unitId: UnitId) {
  assertConfigured();
  const supabase = getSupabaseClient();
  const unitRow = (await selectOrThrow(
    supabase.from("units").select("id, slug").eq("slug", unitId).single(),
  )) as Pick<UnitRow, "id" | "slug">;
  const tableRows = (await selectOrThrow(
    supabase
      .from("store_tables")
      .select("id, unit_id, table_number")
      .eq("id", tableId)
      .eq("unit_id", unitRow.id)
      .limit(1),
  )) as Array<Pick<StoreTableRow, "id" | "unit_id" | "table_number">>;
  const table = tableRows[0];
  if (!table) throw new Error("Mesa não encontrada nesta unidade.");

  const orders = (await selectOrThrow(
    supabase.from("orders").select("id").eq("table_id", tableId).limit(1),
  )) as Array<{ id: string }>;
  const operation = orders.length > 0 ? "soft_delete" : "delete";

  if (operation === "delete") {
    const { error } = await supabase
      .from("store_tables")
      .delete()
      .eq("id", tableId)
      .eq("unit_id", unitRow.id);
    if (error) throw new Error(error.message);
    return { operation };
  }

  const { error } = await supabase
    .from("store_tables")
    .update({
      active: false,
      is_active: false,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", tableId)
    .eq("unit_id", unitRow.id);
  if (error) throw new Error(error.message);
  return { operation };
}

export async function insertSupabaseCourier(
  unitId: UnitId,
  data: Pick<Courier, "name" | "phone" | "status"> & { username?: string; accessPin?: string },
): Promise<Courier> {
  assertConfigured();
  const supabase = getSupabaseClient();
  const unitRow = (await selectOrThrow(
    supabase.from("units").select("id, slug").eq("slug", unitId).single(),
  )) as UnitRow;
  const { data: row, error } = await supabase
    .from("delivery_drivers")
    .insert({
      unit_id: unitRow.id,
      name: data.name.trim(),
      phone: data.phone.trim() || null,
      username: data.username?.trim() || null,
      access_pin: data.accessPin?.trim() || null,
      status: data.status,
      active: data.status !== "inativo",
      is_active: data.status !== "inativo",
    })
    .select("id, unit_id, name, phone, username, access_pin, status, active, is_active, deleted_at")
    .single();
  if (error) throw new Error(error.message);
  const courier = mapCourier(row as DriverRow, new Map([[unitRow.id, unitRow.slug]]));
  if (!courier) throw new Error("Entregador criado sem unidade valida.");
  return courier;
}

export async function updateSupabaseCourier(
  courierId: string,
  patch: Partial<Pick<Courier, "name" | "phone" | "status" | "active" | "username" | "accessPin">>,
) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("delivery_drivers")
    .update({
      name: patch.name,
      phone: patch.phone,
      username: patch.username,
      access_pin: patch.accessPin,
      status: patch.status,
      active: patch.status === "inativo" ? false : patch.active,
      is_active: patch.status === "inativo" ? false : patch.active,
    })
    .eq("id", courierId);
  if (error) throw new Error(error.message);
}

export async function deleteSupabaseCourier(courierId: string) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("delivery_drivers")
    .update({
      active: false,
      is_active: false,
      status: "inativo",
      deleted_at: new Date().toISOString(),
    })
    .eq("id", courierId);
  if (error) throw new Error(error.message);
}

export async function validateSupabaseAdminPin(unitId: UnitId, pin: string) {
  assertConfigured();
  const supabase = getSupabaseClient();
  const unit = (await selectOrThrow(
    supabase.from("units").select("id, slug").eq("slug", unitId).single(),
  )) as Pick<UnitRow, "id" | "slug">;
  const rows = (await selectOrThrow(
    supabase.from("admin_settings").select("admin_pin, settings").eq("unit_id", unit.id).limit(1),
  )) as Array<Pick<AdminSettingsRow, "admin_pin" | "settings">>;
  const settings = rows[0];
  const legacyPin =
    settings?.settings && typeof settings.settings === "object"
      ? ((settings.settings as { unit_patch?: { accessPin?: string } }).unit_patch?.accessPin ?? "")
      : "";
  const expected = settings?.admin_pin || legacyPin || fallbackUnit(unitId).accessPin;
  return Boolean(expected) && expected === pin;
}

export async function loginSupabaseDriver(username: string, pin: string) {
  assertConfigured();
  const rows = (await selectOrThrow(
    getSupabaseClient()
      .from("delivery_drivers")
      .select(
        "id, unit_id, name, phone, username, access_pin, status, active, is_active, deleted_at",
      )
      .eq("username", username.trim())
      .eq("is_active", true)
      .limit(1),
  )) as DriverRow[];
  const driver = rows[0];
  if (
    !driver ||
    driver.access_pin !== pin.trim() ||
    driver.status === "inativo" ||
    !driver.active
  ) {
    return null;
  }
  return driver.id;
}

export async function resetSupabaseOperationalData(params: {
  unitSlug: UnitId;
  adminPin: string;
  confirmation: "ZERAR";
}) {
  assertConfigured();
  const { error } = await getSupabaseClient().rpc("reset_operational_data", {
    p_unit_slug: params.unitSlug,
    p_admin_pin: params.adminPin,
    p_confirmation: params.confirmation,
  });
  if (error) throw new Error(error.message);
}

export async function insertSupabaseDeliveryRule(
  unitId: UnitId,
  rule: Omit<DeliveryRule, "id">,
): Promise<DeliveryRule> {
  assertConfigured();
  const supabase = getSupabaseClient();
  const unitRow = (await selectOrThrow(
    supabase.from("units").select("id, slug").eq("slug", unitId).single(),
  )) as UnitRow;
  const { data, error } = await supabase
    .from("delivery_fee_rules")
    .insert({
      unit_id: unitRow.id,
      max_distance_km: rule.maxDistanceKm,
      estimated_minutes: rule.estimatedMinutes,
      delivery_fee: rule.deliveryFee,
      active: rule.isActive,
    })
    .select("id, unit_id, max_distance_km, estimated_minutes, delivery_fee, active")
    .single();
  if (error) throw new Error(error.message);
  const mapped = mapDeliveryRule(data as DeliveryRuleRow, new Map([[unitRow.id, unitRow.slug]]));
  if (!mapped) throw new Error("Regra criada sem unidade valida.");
  return mapped;
}

export async function updateSupabaseDeliveryRule(
  ruleId: string,
  patch: Partial<
    Pick<DeliveryRule, "maxDistanceKm" | "estimatedMinutes" | "deliveryFee" | "isActive">
  >,
) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("delivery_fee_rules")
    .update({
      max_distance_km: patch.maxDistanceKm,
      estimated_minutes: patch.estimatedMinutes,
      delivery_fee: patch.deliveryFee,
      active: patch.isActive,
    })
    .eq("id", ruleId);
  if (error) throw new Error(error.message);
}

export async function deleteSupabaseDeliveryRule(ruleId: string) {
  assertConfigured();
  const { error } = await getSupabaseClient().from("delivery_fee_rules").delete().eq("id", ruleId);
  if (error) throw new Error(error.message);
}
