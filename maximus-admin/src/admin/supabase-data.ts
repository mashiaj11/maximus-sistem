import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type {
  AdminUnit,
  Category,
  Courier,
  CourierStatus,
  DeliveryRule,
  DeliveryZone,
  KitchenPrintSettings,
  Order,
  OrderItem,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  PrintDestination,
  PrintJobDestination,
  PrintJobStatus,
  Product,
  ProductDraft,
  RestaurantTable,
  TableStatus,
  UnitId,
  WhatsappMessageSettings,
  WhatsappSendMode,
  WhatsappStatusSettings,
  WhatsappStatusMessages,
} from "./data/types";

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
  active?: boolean | null;
};

type CategoryRow = {
  id: string;
  name: string;
  sort_order: number;
  availability_scope: NonNullable<Category["availabilityScope"]>;
  print_destination?: PrintDestination | null;
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

type DeliveryZoneRow = {
  id: string;
  unit_id: string;
  name: string;
  fee: number;
  estimated_time_min: number | null;
  estimated_time_max: number | null;
  active: boolean;
  sort_order: number;
};

type AdminSettingsRow = {
  unit_id: string;
  settings: unknown;
  require_driver_completion: boolean;
  whatsapp_enabled: boolean;
  whatsapp_bot_enabled: boolean | null;
  whatsapp_number: string | null;
  whatsapp_welcome_message: string | null;
  whatsapp_human_message: string | null;
  whatsapp_messages: unknown;
  whatsapp_status_settings: unknown;
  delivery_panel_enabled: boolean;
  kitchen_print_enabled: boolean;
  kitchen_print_settings: unknown;
  minimum_order_value: number | null;
  base_delivery_fee: number | null;
  delivery_fee_per_km: number | null;
  max_delivery_distance_km: number | null;
  free_delivery_from: number | null;
};

const UNIT_SELECT =
  "id, slug, name, phone, address, latitude, longitude, is_open, business_hours, theme, kitchen_print_settings";

const ADMIN_SETTINGS_SELECT =
  "unit_id, settings, require_driver_completion, whatsapp_enabled, whatsapp_bot_enabled, whatsapp_number, whatsapp_welcome_message, whatsapp_human_message, whatsapp_messages, whatsapp_status_settings, delivery_panel_enabled, kitchen_print_enabled, kitchen_print_settings, minimum_order_value, base_delivery_fee, delivery_fee_per_km, max_delivery_distance_km, free_delivery_from";

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
  delivery_zone_id: string | null;
  delivery_zone_name: string | null;
  delivery_estimated_time: number | null;
  delivery_calculation_method: string | null;
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
  product_id: string | null;
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
  deliveryZones: DeliveryZone[];
};

export type PrintJob = {
  id: string;
  unitId: UnitId;
  orderId: string;
  printType: string;
  destination: PrintJobDestination;
  status: PrintJobStatus;
  attempts: number;
  payload: unknown;
  errorMessage?: string;
  createdAt: string;
  claimedAt?: string;
  printedAt?: string;
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

function compactUpdate<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
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

function emptyUnit(unitId: UnitId): AdminUnit {
  return {
    id: unitId,
    name: unitId,
    phone: "",
    address: "",
    latitude: 0,
    longitude: 0,
    isOpen: false,
    active: true,
    businessHours: [],
    theme: "light",
    kitchenPrintSettings: FALLBACK_KITCHEN_PRINT_SETTINGS,
    whatsappSettings: {
      enabled: false,
      botEnabled: false,
      officialNumber: "",
      welcomeMessage: "",
      humanMessage: "",
      ...DEFAULT_WHATSAPP_MESSAGES,
      statusSettings: normalizeWhatsappStatusSettings(undefined, DEFAULT_WHATSAPP_MESSAGES),
    },
    driverPanelSettings: { enabled: false },
  };
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

const DEFAULT_WHATSAPP_MESSAGES: WhatsappStatusMessages = {
  received: "",
  accepted: "",
  in_preparation: "",
  ready: "",
  ready_for_pickup: "",
  out_for_delivery: "",
  driver_on_way: "",
  driver_nearby: "",
  arrived: "",
  delivered: "",
  picked_up: "",
  delivered_to_table: "",
  cancelled: "",
};

const DEFAULT_WHATSAPP_WELCOME_MESSAGE = "";
const DEFAULT_WHATSAPP_HUMAN_MESSAGE = "";
const WHATSAPP_SEND_MODES: WhatsappSendMode[] = ["text", "pdf", "text_and_pdf"];

type LegacyWhatsappMessages = {
  receivedMessage?: string;
  acceptedMessage?: string;
  productionMessage?: string;
  readyMessage?: string;
  outForDeliveryMessage?: string;
  driverOnWayMessage?: string;
  driverNearbyMessage?: string;
  deliveredMessage?: string;
};

function normalizeWhatsappMessages(
  value?: Partial<WhatsappMessageSettings> & LegacyWhatsappMessages,
): WhatsappStatusMessages {
  return {
    received: value?.received ?? value?.receivedMessage ?? DEFAULT_WHATSAPP_MESSAGES.received,
    accepted: value?.accepted ?? value?.acceptedMessage ?? DEFAULT_WHATSAPP_MESSAGES.accepted,
    in_preparation:
      value?.in_preparation ?? value?.productionMessage ?? DEFAULT_WHATSAPP_MESSAGES.in_preparation,
    ready: value?.ready ?? value?.readyMessage ?? DEFAULT_WHATSAPP_MESSAGES.ready,
    ready_for_pickup:
      value?.ready_for_pickup ?? value?.readyMessage ?? DEFAULT_WHATSAPP_MESSAGES.ready_for_pickup,
    out_for_delivery:
      value?.out_for_delivery ??
      value?.outForDeliveryMessage ??
      DEFAULT_WHATSAPP_MESSAGES.out_for_delivery,
    driver_on_way:
      value?.driver_on_way ?? value?.driverOnWayMessage ?? DEFAULT_WHATSAPP_MESSAGES.driver_on_way,
    driver_nearby:
      value?.driver_nearby ?? value?.driverNearbyMessage ?? DEFAULT_WHATSAPP_MESSAGES.driver_nearby,
    arrived: value?.arrived ?? DEFAULT_WHATSAPP_MESSAGES.arrived,
    delivered: value?.delivered ?? value?.deliveredMessage ?? DEFAULT_WHATSAPP_MESSAGES.delivered,
    picked_up: value?.picked_up ?? value?.deliveredMessage ?? DEFAULT_WHATSAPP_MESSAGES.picked_up,
    delivered_to_table:
      value?.delivered_to_table ??
      value?.deliveredMessage ??
      DEFAULT_WHATSAPP_MESSAGES.delivered_to_table,
    cancelled: value?.cancelled ?? DEFAULT_WHATSAPP_MESSAGES.cancelled,
  };
}

function normalizeWhatsappStatusSettings(value: unknown, messages: WhatsappStatusMessages) {
  const rows = value && typeof value === "object" ? (value as Partial<WhatsappStatusSettings>) : {};
  return Object.fromEntries(
    Object.entries(messages).map(([status, message]) => {
      const saved = rows[status as keyof WhatsappStatusMessages];
      const mode = saved?.mode && WHATSAPP_SEND_MODES.includes(saved.mode) ? saved.mode : "text";
      return [
        status,
        {
          enabled: saved?.enabled ?? true,
          mode,
          message: saved?.message ?? message,
        },
      ];
    }),
  ) as WhatsappStatusSettings;
}

type LegacyBusinessHour = Partial<AdminUnit["businessHours"][number]> & {
  opensAt?: string;
  closesAt?: string;
};

function normalizeBusinessHours(value: unknown, fallback: AdminUnit["businessHours"]) {
  const rows = (
    Array.isArray(value) && value.length
      ? (value as LegacyBusinessHour[])
      : fallback.length
        ? fallback
        : WEEKDAY_KEYS.map((day) => ({ day, open: false, periods: [] }))
  ) as LegacyBusinessHour[];
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
  const empty = emptyUnit(row.slug);
  const settingsObject =
    settings?.settings && typeof settings.settings === "object"
      ? (settings.settings as {
          public_app_url?: string;
          accepts_delivery?: boolean;
          accepts_pickup?: boolean;
          accepts_dine_in?: boolean;
        })
      : {};
  const whatsappMessages =
    settings?.whatsapp_messages && typeof settings.whatsapp_messages === "object"
      ? (settings.whatsapp_messages as Partial<AdminUnit["whatsappSettings"]>)
      : {};
  const normalizedWhatsappMessages = normalizeWhatsappMessages(whatsappMessages);
  const whatsappStatusSettings = normalizeWhatsappStatusSettings(
    settings?.whatsapp_status_settings,
    normalizedWhatsappMessages,
  );
  const kitchenPrintSettings =
    settings?.kitchen_print_settings && typeof settings.kitchen_print_settings === "object"
      ? (settings.kitchen_print_settings as Partial<KitchenPrintSettings>)
      : {};

  return {
    id: row.slug,
    name: row.name ?? empty.name,
    phone: row.phone ?? "",
    address: row.address ?? "",
    latitude: Number(row.latitude ?? 0),
    longitude: Number(row.longitude ?? 0),
    isOpen: Boolean(row.is_open),
    active: true,
    businessHours: Array.isArray(row.business_hours)
      ? normalizeBusinessHours(row.business_hours, [])
      : [],
    theme: row.theme ?? "light",
    publicAppUrl: settingsObject.public_app_url ?? "",
    acceptsDelivery: settingsObject.accepts_delivery ?? true,
    acceptsPickup: settingsObject.accepts_pickup ?? true,
    acceptsDineIn: settingsObject.accepts_dine_in ?? true,
    kitchenPrintSettings:
      row.kitchen_print_settings && typeof row.kitchen_print_settings === "object"
        ? {
            ...FALLBACK_KITCHEN_PRINT_SETTINGS,
            ...(row.kitchen_print_settings as Partial<KitchenPrintSettings>),
            ...kitchenPrintSettings,
            autoPrintEnabled:
              settings?.kitchen_print_enabled ??
              (row.kitchen_print_settings as Partial<KitchenPrintSettings>).autoPrintEnabled ??
              FALLBACK_KITCHEN_PRINT_SETTINGS.autoPrintEnabled,
          }
        : {
            ...FALLBACK_KITCHEN_PRINT_SETTINGS,
            ...kitchenPrintSettings,
            autoPrintEnabled:
              settings?.kitchen_print_enabled ?? FALLBACK_KITCHEN_PRINT_SETTINGS.autoPrintEnabled,
          },
    whatsappSettings: {
      ...normalizedWhatsappMessages,
      enabled: settings?.whatsapp_enabled ?? false,
      botEnabled: settings?.whatsapp_bot_enabled ?? false,
      welcomeMessage: settings?.whatsapp_welcome_message ?? "",
      humanMessage: settings?.whatsapp_human_message ?? "",
      officialNumber: settings?.whatsapp_number ?? "",
      statusSettings: whatsappStatusSettings,
    } as AdminUnit["whatsappSettings"],
    driverPanelSettings: {
      enabled: settings?.require_driver_completion ?? settings?.delivery_panel_enabled ?? false,
    },
    minimumOrderValue: Number(settings?.minimum_order_value ?? 0),
    baseDeliveryFee: Number(settings?.base_delivery_fee ?? 0),
    deliveryFeePerKm: Number(settings?.delivery_fee_per_km ?? 0),
    maxDeliveryDistanceKm: Number(settings?.max_delivery_distance_km ?? 0),
    freeDeliveryFrom: Number(settings?.free_delivery_from ?? 0),
  };
}

function mapCategory(row: CategoryRow, unitSlugs: UnitId[]): Category {
  return {
    id: row.id,
    name: row.name,
    order: row.sort_order,
    activeByUnit: Object.fromEntries(unitSlugs.map((slug) => [slug, row.active])),
    availabilityScope: row.availability_scope,
    printDestination: row.print_destination ?? "kitchen",
  };
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

function mapProduct(
  row: ProductRow,
  slugById: Map<string, UnitId>,
  availabilityRows: ProductUnitAvailabilityRow[] = [],
  unitSlugs: UnitId[] = [],
): Product {
  const legacyUnitId = slugById.get(row.unit_id);
  const activeByUnit = Object.fromEntries(
    availabilityRows
      .map((availability) => {
        const unitId = slugById.get(availability.unit_id);
        return unitId ? [unitId, availability.is_available] : null;
      })
      .filter((entry): entry is [UnitId, boolean] => Boolean(entry)),
  );
  for (const unitSlug of unitSlugs) {
    if (activeByUnit[unitSlug] === undefined) {
      activeByUnit[unitSlug] = row.available;
    }
  }
  const unitIds = Object.entries(activeByUnit)
    .filter(([, active]) => active)
    .map(([unitId]) => unitId);

  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    price: Number(row.price),
    active: unitIds.length ? true : row.available,
    unitIds: unitIds.length ? unitIds : legacyUnitId ? [legacyUnitId] : [],
    activeByUnit,
    description: row.description ?? undefined,
    imageUrl: row.image_url ?? undefined,
    optionGroups: Array.isArray(row.option_groups) ? row.option_groups : [],
    availableForDelivery: row.available_for_delivery !== false,
    availableForPickup: row.available_for_pickup !== false,
    availableForDineIn: row.available_for_dine_in !== false,
    dineInOnly: row.dine_in_only === true,
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

function mapDeliveryZone(row: DeliveryZoneRow, slugById: Map<string, UnitId>): DeliveryZone | null {
  const unitId = slugById.get(row.unit_id);
  if (!unitId) return null;
  return {
    id: row.id,
    unitId,
    name: row.name,
    fee: Number(row.fee),
    estimatedTimeMin: row.estimated_time_min,
    estimatedTimeMax: row.estimated_time_max,
    isActive: row.active,
    sortOrder: row.sort_order,
  };
}

function mapOrder(
  row: OrderRow,
  items: OrderItemRow[],
  slugById: Map<string, UnitId>,
  tableNumberById: Map<string, number>,
  addressById: Map<string, CustomerAddressRow>,
  printDestinationByProductId: Map<string, PrintDestination>,
): Order | null {
  const unitId = slugById.get(row.unit_id);
  if (!unitId) return null;

  const mappedItems: OrderItem[] = items.map((item) => ({
    id: item.id,
    productId: item.product_id ?? undefined,
    name: item.product_name,
    quantity: item.quantity,
    unitPrice: Number(item.unit_price),
    customizations: Array.isArray(item.customizations) ? item.customizations : [],
    notes: item.notes ?? undefined,
    printDestination: item.product_id
      ? (printDestinationByProductId.get(item.product_id) ?? "kitchen")
      : "kitchen",
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
    deliveryZoneId: row.delivery_zone_id ?? undefined,
    deliveryZoneName: row.delivery_zone_name ?? undefined,
    deliveryEstimatedTime:
      row.delivery_estimated_time == null ? undefined : Number(row.delivery_estimated_time),
    deliveryCalculationMethod: row.delivery_calculation_method ?? undefined,
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

function isMissingSchemaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("Could not find the table") ||
    message.includes("Could not find the column") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

async function selectOptional<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  fallback: T,
) {
  try {
    return (await selectOrThrow(query)) ?? fallback;
  } catch (error) {
    if (isMissingSchemaError(error)) return fallback;
    throw error;
  }
}

export async function loadSupabaseAdminData(): Promise<SupabaseAdminData> {
  assertConfigured();
  const supabase = getSupabaseClient();

  const units = (await selectOrThrow(
    supabase.from("units").select(UNIT_SELECT).order("slug"),
  )) as UnitRow[];
  const { idBySlug, slugById } = buildUnitLookups(units);

  const [
    categories,
    products,
    productAvailability,
    tables,
    couriers,
    deliveryRules,
    deliveryZones,
    adminSettings,
  ] = await Promise.all([
    selectOrThrow(
      supabase
        .from("categories")
        .select("id, name, sort_order, availability_scope, print_destination, active")
        .eq("active", true)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true }),
    ) as Promise<CategoryRow[] | null>,
    selectOrThrow(
      supabase
        .from("products")
        .select(
          "id, unit_id, category_id, name, description, price, image_url, option_groups, available, available_for_delivery, available_for_pickup, available_for_dine_in, dine_in_only, deleted_at, created_at",
        )
        .is("deleted_at", null)
        .order("name", { ascending: true }),
    ) as Promise<ProductRow[] | null>,
    selectOrThrow(
      supabase
        .from("product_unit_availability")
        .select(
          "product_id, unit_id, is_available, available_for_delivery, available_for_pickup, available_for_dine_in",
        ),
    ) as Promise<ProductUnitAvailabilityRow[] | null>,
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
    selectOptional(
      supabase
        .from("delivery_zones")
        .select(
          "id, unit_id, name, fee, estimated_time_min, estimated_time_max, active, sort_order",
        )
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      [] as DeliveryZoneRow[],
    ) as Promise<DeliveryZoneRow[] | null>,
    selectOrThrow(supabase.from("admin_settings").select(ADMIN_SETTINGS_SELECT)) as Promise<
      AdminSettingsRow[] | null
    >,
  ]);
  const adminSettingsByUnitId = new Map((adminSettings ?? []).map((row) => [row.unit_id, row]));
  const productAvailabilityByProductId = new Map<string, ProductUnitAvailabilityRow[]>();
  for (const availability of productAvailability ?? []) {
    productAvailabilityByProductId.set(availability.product_id, [
      ...(productAvailabilityByProductId.get(availability.product_id) ?? []),
      availability,
    ]);
  }
  const orderSelectWithZones =
    "id, unit_id, customer_address_id, table_id, delivery_driver_id, delivery_driver_name, order_number, order_type, status, payment_status, payment_method, customer_name, customer_phone, recipient_name, recipient_phone, recipient_notes, delivery_fee, delivery_fee_snapshot, minimum_order_value, delivery_payout_amount, driver_earned_value, delivery_distance_km, delivery_zone_id, delivery_zone_name, delivery_estimated_time, delivery_calculation_method, delivery_lat, delivery_lng, delivery_location_source, geocoding_status, customer_lat, customer_lng, customer_address_text, driver_lat, driver_lng, driver_id, driver_name, payment_confirmed, delivery_completed_by_driver, kitchen_print_status, kitchen_printed_at, out_for_delivery_at, navigation_started_at, delivered_at, subtotal, total, notes, created_at";
  const orderSelectLegacy =
    "id, unit_id, customer_address_id, table_id, delivery_driver_id, delivery_driver_name, order_number, order_type, status, payment_status, payment_method, customer_name, customer_phone, recipient_name, recipient_phone, recipient_notes, delivery_fee, delivery_fee_snapshot, minimum_order_value, delivery_payout_amount, driver_earned_value, delivery_distance_km, delivery_lat, delivery_lng, delivery_location_source, geocoding_status, customer_lat, customer_lng, customer_address_text, driver_lat, driver_lng, driver_id, driver_name, payment_confirmed, delivery_completed_by_driver, kitchen_print_status, kitchen_printed_at, out_for_delivery_at, navigation_started_at, delivered_at, subtotal, total, notes, created_at";
  let orderRows: OrderRow[];
  try {
    orderRows = (await selectOrThrow(
      supabase
        .from("orders")
        .select(orderSelectWithZones)
        .order("created_at", { ascending: false }),
    )) as OrderRow[];
  } catch (error) {
    if (!isMissingSchemaError(error)) throw error;
    orderRows = (await selectOrThrow(
      supabase.from("orders").select(orderSelectLegacy).order("created_at", { ascending: false }),
    )) as OrderRow[];
  }
  const orderItems = orderRows.length
    ? ((await selectOrThrow(
        supabase
          .from("order_items")
          .select(
            "id, order_id, product_id, product_name, quantity, unit_price, customizations, notes",
          )
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
  const categoryDestinationById = new Map(
    (categories ?? []).map((category) => [
      category.id,
      (category.print_destination ?? "kitchen") as PrintDestination,
    ]),
  );
  const printDestinationByProductId = new Map(
    (products ?? []).map((product) => [
      product.id,
      categoryDestinationById.get(product.category_id) ?? "kitchen",
    ]),
  );

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
          printDestinationByProductId,
        ),
      )
      .filter((order): order is Order => Boolean(order)),
    categories: (categories ?? []).map((category) =>
      mapCategory(
        category,
        units.map((unit) => unit.slug),
      ),
    ),
    products: uniqueGlobalProducts(products ?? []).map((product) =>
      mapProduct(
        product,
        slugById,
        productAvailabilityByProductId.get(product.id),
        units.map((unit) => unit.slug),
      ),
    ),
    tables: (tables ?? [])
      .map((table) => mapTable(table, slugById))
      .filter((table): table is RestaurantTable => Boolean(table)),
    couriers: (couriers ?? [])
      .map((courier) => mapCourier(courier, slugById))
      .filter((courier): courier is Courier => Boolean(courier)),
    deliveryRules: (deliveryRules ?? [])
      .map((rule) => mapDeliveryRule(rule, slugById))
      .filter((rule): rule is DeliveryRule => Boolean(rule)),
    deliveryZones: (deliveryZones ?? [])
      .map((zone) => mapDeliveryZone(zone, slugById))
      .filter((zone): zone is DeliveryZone => Boolean(zone)),
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
      delivery_status: status,
      delivered_at: deliveredAt,
      out_for_delivery_at: status === "out_for_delivery" ? new Date().toISOString() : undefined,
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
) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("orders")
    .update({
      delivery_driver_id: courier.id,
      delivery_driver_name: courier.name,
      delivery_payout_amount: payoutAmount,
      driver_earned_value: payoutAmount,
    })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}

export async function updateSupabaseOrderPayment(
  order: Order,
  paymentStatus: PaymentStatus,
  nextStatus?: OrderStatus,
) {
  assertConfigured();
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: paymentStatus,
      ...(nextStatus ? { status: nextStatus, delivery_status: nextStatus } : {}),
    })
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

export async function markSupabaseDeliveryArrived(order: Order) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("orders")
    .update({
      status: "arrived",
      delivery_status: "arrived",
      delivery_driver_id: order.deliveryDriverId ?? order.courierId ?? order.driver_id ?? null,
      delivery_driver_name:
        order.deliveryDriverName ?? order.courierName ?? order.driver_name ?? null,
      driver_id: order.driver_id ?? order.deliveryDriverId ?? order.courierId ?? null,
      driver_name: order.driver_name ?? order.deliveryDriverName ?? order.courierName ?? null,
    })
    .eq("id", order.id);
  if (error) throw new Error(error.message);
}

export async function startSupabaseDeliveryNavigation(
  order: Order,
  startedAt: string,
  driverLocation?: { latitude: number; longitude: number },
) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("orders")
    .update({
      navigation_started_at: startedAt,
      status: "driver_on_way",
      delivery_status: "driver_on_way",
      out_for_delivery_at: order.outForDeliveryAt ?? startedAt,
      driver_lat: driverLocation?.latitude ?? order.driverLat ?? order.driver_lat ?? null,
      driver_lng: driverLocation?.longitude ?? order.driverLng ?? order.driver_lng ?? null,
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
}

export async function updateSupabaseUnit(unitId: UnitId, patch: Partial<AdminUnit>) {
  assertConfigured();
  const payload = compactUpdate({
    name: patch.name,
    phone: patch.phone,
    address: patch.address,
    latitude: patch.latitude,
    longitude: patch.longitude,
    is_open: patch.isOpen,
    business_hours: patch.businessHours,
    theme: patch.theme,
    kitchen_print_settings: patch.kitchenPrintSettings,
  });
  const { data, error } = await getSupabaseClient()
    .from("units")
    .update(payload)
    .eq("slug", unitId)
    .select(UNIT_SELECT)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nenhuma unidade foi atualizada no Supabase.");
}

export type KitchenPrintSettingsSnapshot = {
  settings: KitchenPrintSettings;
  savedAt: string | null;
};

function mergeKitchenPrintSettings(
  unitSettings: unknown,
  adminSettings: unknown,
): KitchenPrintSettings {
  const unit =
    unitSettings && typeof unitSettings === "object"
      ? (unitSettings as Partial<KitchenPrintSettings>)
      : {};
  const admin =
    adminSettings && typeof adminSettings === "object"
      ? (adminSettings as Partial<KitchenPrintSettings>)
      : {};

  return {
    ...FALLBACK_KITCHEN_PRINT_SETTINGS,
    ...unit,
    ...admin,
    sectors: {
      ...unit.sectors,
      ...admin.sectors,
    },
  };
}

export async function loadSupabaseKitchenPrintSettings(
  unitId: UnitId,
): Promise<KitchenPrintSettingsSnapshot> {
  assertConfigured();
  const supabase = getSupabaseClient();
  const { data: unit, error: unitError } = await supabase
    .from("units")
    .select("id, kitchen_print_settings, updated_at")
    .eq("slug", unitId)
    .single();
  if (unitError) throw new Error(unitError.message);

  const { data: adminSettings, error: settingsError } = await supabase
    .from("admin_settings")
    .select("kitchen_print_settings, updated_at")
    .eq("unit_id", unit.id)
    .maybeSingle();
  if (settingsError) throw new Error(settingsError.message);

  return {
    settings: mergeKitchenPrintSettings(
      unit.kitchen_print_settings,
      adminSettings?.kitchen_print_settings,
    ),
    savedAt: adminSettings?.updated_at ?? unit.updated_at ?? null,
  };
}

export async function upsertSupabaseAdminSettings(unit: AdminUnit) {
  assertConfigured();
  const supabase = getSupabaseClient();
  const unitRow = (await selectOrThrow(
    supabase.from("units").select("id").eq("slug", unit.id).single(),
  )) as Pick<UnitRow, "id">;
  const whatsappSettings = unit.whatsappSettings;
  const whatsappMessages = normalizeWhatsappMessages(whatsappSettings);
  const whatsappStatusSettings = normalizeWhatsappStatusSettings(
    whatsappSettings?.statusSettings,
    whatsappMessages,
  );
  const normalizedWhatsappSettings: WhatsappMessageSettings = {
    enabled: Boolean(whatsappSettings?.enabled),
    botEnabled: Boolean(whatsappSettings?.botEnabled),
    officialNumber: whatsappSettings?.officialNumber?.trim() ?? "",
    welcomeMessage: whatsappSettings?.welcomeMessage ?? DEFAULT_WHATSAPP_WELCOME_MESSAGE,
    humanMessage: whatsappSettings?.humanMessage ?? DEFAULT_WHATSAPP_HUMAN_MESSAGE,
    ...whatsappMessages,
    statusSettings: whatsappStatusSettings,
  };
  const kitchenPrintSettings = unit.kitchenPrintSettings;
  const driverPanelSettings = unit.driverPanelSettings;
  const settingsPayload = {
    unit_id: unitRow.id,
    settings: {
      public_app_url: unit.publicAppUrl?.trim() ?? "",
      accepts_delivery: unit.acceptsDelivery ?? true,
      accepts_pickup: unit.acceptsPickup ?? true,
      accepts_dine_in: unit.acceptsDineIn ?? true,
    },
    require_driver_completion: Boolean(driverPanelSettings?.enabled),
    whatsapp_enabled: Boolean(whatsappSettings?.enabled),
    whatsapp_bot_enabled: Boolean(whatsappSettings?.botEnabled),
    whatsapp_number: whatsappSettings?.officialNumber?.trim() ?? "",
    whatsapp_welcome_message: whatsappSettings?.welcomeMessage ?? DEFAULT_WHATSAPP_WELCOME_MESSAGE,
    whatsapp_human_message: whatsappSettings?.humanMessage ?? DEFAULT_WHATSAPP_HUMAN_MESSAGE,
    whatsapp_messages: whatsappMessages,
    whatsapp_status_settings: whatsappStatusSettings,
    delivery_panel_enabled: Boolean(driverPanelSettings?.enabled),
    kitchen_print_enabled: Boolean(kitchenPrintSettings?.autoPrintEnabled),
    kitchen_print_settings: kitchenPrintSettings ?? {},
    minimum_order_value: unit.minimumOrderValue ?? 0,
    base_delivery_fee: unit.baseDeliveryFee ?? 0,
    delivery_fee_per_km: unit.deliveryFeePerKm ?? 0,
    max_delivery_distance_km: unit.maxDeliveryDistanceKm ?? 0,
    free_delivery_from: unit.freeDeliveryFrom ?? 0,
  };
  const { data, error } = await supabase
    .from("admin_settings")
    .upsert(settingsPayload, { onConflict: "unit_id" })
    .select(ADMIN_SETTINGS_SELECT)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("As configurações da unidade não foram confirmadas no Supabase.");
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
      print_destination: "kitchen",
    })
    .select("id, name, sort_order, availability_scope, print_destination, active")
    .single();
  if (error) throw new Error(error.message);
  return mapCategory(data as CategoryRow, []);
}

export async function updateSupabaseCategory(
  categoryId: string,
  patch: Partial<Pick<Category, "name" | "order" | "printDestination">>,
) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("categories")
    .update({
      name: patch.name,
      sort_order: patch.order,
      print_destination: patch.printDestination,
    })
    .eq("id", categoryId);
  if (error) throw new Error(error.message);
}

export async function deleteSupabaseCategory(categoryId: string) {
  assertConfigured();
  const now = new Date().toISOString();
  const { error } = await getSupabaseClient()
    .from("categories")
    .update({
      active: false,
      deleted_at: now,
      updated_at: now,
    })
    .eq("id", categoryId);
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
  const unitRows = (await selectOrThrow(
    supabase.from("units").select("id, slug").eq("active", true).order("slug"),
  )) as Array<Pick<UnitRow, "id" | "slug">>;
  const unitRow = unitRows.find((unit) => unit.slug === unitId) ?? unitRows[0];
  if (!unitRow) throw new Error("Nenhuma unidade ativa encontrada para criar produto.");
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
      available: true,
      available_for_delivery: true,
      available_for_pickup: true,
      available_for_dine_in: true,
      dine_in_only: data.dineInOnly ?? false,
    })
    .select(
      "id, unit_id, category_id, name, description, price, image_url, option_groups, available, available_for_delivery, available_for_pickup, available_for_dine_in, dine_in_only",
    )
    .single();
  if (error) throw new Error(error.message);
  const availabilityRows = unitRows.map((unit) => ({
    product_id: row.id,
    unit_id: unit.id,
    is_available: data.active,
    available_for_delivery: data.availableForDelivery ?? true,
    available_for_pickup: data.availableForPickup ?? true,
    available_for_dine_in: data.availableForDineIn ?? true,
  }));
  const { error: availabilityError } = await supabase
    .from("product_unit_availability")
    .upsert(availabilityRows, { onConflict: "product_id,unit_id" });
  if (availabilityError) throw new Error(availabilityError.message);
  return mapProduct(
    row as ProductRow,
    new Map(unitRows.map((unit) => [unit.id, unit.slug])),
    availabilityRows,
    unitRows.map((unit) => unit.slug),
  );
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
      dine_in_only: patch.dineInOnly,
    })
    .eq("id", productId);
  if (error) throw new Error(error.message);
}

export async function upsertSupabaseProductAvailability(
  productId: string,
  unitId: UnitId,
  patch: Partial<Product>,
) {
  assertConfigured();
  const unitRow = (await selectOrThrow(
    getSupabaseClient().from("units").select("id").eq("slug", unitId).single(),
  )) as Pick<UnitRow, "id">;
  const payload = compactUpdate({
    product_id: productId,
    unit_id: unitRow.id,
    is_available: patch.active,
    available_for_delivery: patch.availableForDelivery,
    available_for_pickup: patch.availableForPickup,
    available_for_dine_in: patch.availableForDineIn,
  });
  const { error } = await getSupabaseClient()
    .from("product_unit_availability")
    .upsert(payload, { onConflict: "product_id,unit_id" });
  if (error) throw new Error(error.message);
}

export async function deleteSupabaseProduct(productId: string) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("products")
    .update({
      available: false,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", productId);
  if (error) throw new Error(error.message);
}

export async function setSupabaseProductAvailable(
  productId: string,
  unitId: UnitId,
  available: boolean,
) {
  await upsertSupabaseProductAvailability(productId, unitId, { active: available });
}

export function normalizePublicAppUrl(value?: string | null) {
  return value?.trim().replace(/\/+$/, "") ?? "";
}

function devPublicAppUrlFallback() {
  if (!import.meta.env.DEV || typeof window === "undefined") return "";
  return window.location.origin;
}

export function buildTablePublicUrl(
  publicAppUrl: string | null | undefined,
  unitSlug: UnitId,
  tableNumber: number,
) {
  const base = normalizePublicAppUrl(publicAppUrl) || devPublicAppUrlFallback();
  const path = `/mesa?unit=${encodeURIComponent(unitSlug)}&table=${encodeURIComponent(
    String(tableNumber),
  )}&mode=dine_in`;
  return base ? `${base}${path}` : path;
}

const STORE_TABLE_SELECT =
  "id, unit_id, table_number, public_url, qr_code_data, status, active, is_active, deleted_at, created_at";

async function loadPublicAppUrlForUnit(unitDbId: string) {
  const { data, error } = await getSupabaseClient()
    .from("admin_settings")
    .select("settings")
    .eq("unit_id", unitDbId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.settings || typeof data.settings !== "object") return "";
  const settings = data.settings as { public_app_url?: string };
  return settings.public_app_url ?? "";
}

export async function insertSupabaseTable(
  unitId: UnitId,
  tableNumber?: number,
  publicAppUrl?: string | null,
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
      .eq("active", true)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("table_number", { ascending: false })
      .limit(1),
  )) as Array<{ table_number: number }>;
  const nextNumber = Math.max(tableNumber ?? 0, (lastRows[0]?.table_number ?? 0) + 1);
  const configuredPublicAppUrl = publicAppUrl ?? (await loadPublicAppUrlForUnit(unitRow.id));
  const publicUrl = buildTablePublicUrl(configuredPublicAppUrl, unitId, nextNumber);
  const existingRows = (await selectOrThrow(
    supabase
      .from("store_tables")
      .select(STORE_TABLE_SELECT)
      .eq("unit_id", unitRow.id)
      .eq("table_number", nextNumber)
      .limit(1),
  )) as StoreTableRow[];
  const existing = existingRows[0];
  if (
    existing &&
    (existing.active !== true || existing.is_active !== true || existing.deleted_at)
  ) {
    const { data, error } = await supabase
      .from("store_tables")
      .update({
        public_url: publicUrl,
        qr_code_data: publicUrl,
        status: "livre",
        active: true,
        is_active: true,
        deleted_at: null,
      })
      .eq("id", existing.id)
      .eq("unit_id", unitRow.id)
      .select(STORE_TABLE_SELECT)
      .single();
    if (error) throw new Error(error.message);
    const table = mapTable(data as StoreTableRow, new Map([[unitRow.id, unitRow.slug]]));
    if (!table) throw new Error("Mesa reativada sem unidade valida.");
    return table;
  }
  const { data, error } = await supabase
    .from("store_tables")
    .insert({
      unit_id: unitRow.id,
      table_number: nextNumber,
      public_url: publicUrl,
      qr_code_data: publicUrl,
      status: "livre",
      active: true,
      is_active: true,
      deleted_at: null,
    })
    .select(STORE_TABLE_SELECT)
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
  const payload = compactUpdate({
    status: patch.status,
    active: patch.active,
    is_active: patch.active,
  });
  const { data, error } = await getSupabaseClient()
    .from("store_tables")
    .update(payload)
    .eq("id", tableId)
    .select(STORE_TABLE_SELECT)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Mesa não foi atualizada no Supabase.");
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
    const { data, error } = await supabase
      .from("store_tables")
      .delete()
      .eq("id", tableId)
      .eq("unit_id", unitRow.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("Mesa não foi apagada no Supabase.");
    return { operation };
  }

  const { data, error } = await supabase
    .from("store_tables")
    .update({
      active: false,
      is_active: false,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", tableId)
    .eq("unit_id", unitRow.id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Mesa não foi arquivada no Supabase.");
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

function mapPrintJob(row: {
  id: string;
  unit_id: string;
  order_id: string;
  print_type: string;
  destination: PrintJobDestination;
  status: PrintJobStatus;
  attempts: number;
  payload: unknown;
  error_message: string | null;
  created_at: string;
  claimed_at: string | null;
  printed_at: string | null;
}): PrintJob {
  return {
    id: row.id,
    unitId: row.unit_id,
    orderId: row.order_id,
    printType: row.print_type,
    destination: row.destination,
    status: row.status,
    attempts: row.attempts,
    payload: row.payload,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    claimedAt: row.claimed_at ?? undefined,
    printedAt: row.printed_at ?? undefined,
  };
}

export async function createSupabasePrintJobs(
  order: Order,
  jobs: Array<{ destination: PrintJobDestination; payload: unknown }>,
) {
  assertConfigured();
  if (!jobs.length) return [];
  const unit = (await selectOrThrow(
    getSupabaseClient().from("units").select("id").eq("slug", order.unitId).single(),
  )) as Pick<UnitRow, "id">;
  const rows = jobs.map((job) => ({
    unit_id: unit.id,
    order_id: order.id,
    print_type: "order",
    destination: job.destination,
    status: "pending",
    payload: job.payload,
  }));
  const { data, error } = await getSupabaseClient()
    .from("print_jobs")
    .upsert(rows, { onConflict: "order_id,print_type,destination", ignoreDuplicates: true })
    .select(
      "id, unit_id, order_id, print_type, destination, status, attempts, payload, error_message, created_at, claimed_at, printed_at",
    );
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapPrintJob(row as Parameters<typeof mapPrintJob>[0]));
}

export async function claimNextSupabasePrintJob(unitId: UnitId) {
  assertConfigured();
  const unit = (await selectOrThrow(
    getSupabaseClient().from("units").select("id").eq("slug", unitId).single(),
  )) as Pick<UnitRow, "id">;
  const { data, error } = await getSupabaseClient().rpc("claim_next_print_job", {
    p_unit_id: unit.id,
  });
  if (error) throw new Error(error.message);
  return data ? mapPrintJob(data as Parameters<typeof mapPrintJob>[0]) : null;
}

export async function finishSupabasePrintJob(
  jobId: string,
  status: Extract<PrintJobStatus, "printed" | "simulated" | "failed">,
  errorMessage?: string,
) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("print_jobs")
    .update({
      status,
      error_message: errorMessage ?? null,
      printed_at: status === "printed" || status === "simulated" ? new Date().toISOString() : null,
    })
    .eq("id", jobId);
  if (error) throw new Error(error.message);
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

export async function insertSupabaseDeliveryZone(
  unitId: UnitId,
  zone: Omit<DeliveryZone, "id">,
): Promise<DeliveryZone> {
  assertConfigured();
  const supabase = getSupabaseClient();
  const unitRow = (await selectOrThrow(
    supabase.from("units").select("id, slug").eq("slug", unitId).single(),
  )) as UnitRow;
  const { data, error } = await supabase
    .from("delivery_zones")
    .insert({
      unit_id: unitRow.id,
      name: zone.name,
      fee: zone.fee,
      estimated_time_min: zone.estimatedTimeMin ?? null,
      estimated_time_max: zone.estimatedTimeMax ?? null,
      active: zone.isActive,
      sort_order: zone.sortOrder,
    })
    .select("id, unit_id, name, fee, estimated_time_min, estimated_time_max, active, sort_order")
    .single();
  if (error) throw new Error(error.message);
  const mapped = mapDeliveryZone(data as DeliveryZoneRow, new Map([[unitRow.id, unitRow.slug]]));
  if (!mapped) throw new Error("Região criada sem unidade valida.");
  return mapped;
}

export async function updateSupabaseDeliveryZone(
  zoneId: string,
  patch: Partial<
    Pick<
      DeliveryZone,
      "name" | "fee" | "estimatedTimeMin" | "estimatedTimeMax" | "isActive" | "sortOrder"
    >
  >,
) {
  assertConfigured();
  const { error } = await getSupabaseClient()
    .from("delivery_zones")
    .update({
      name: patch.name,
      fee: patch.fee,
      estimated_time_min: patch.estimatedTimeMin,
      estimated_time_max: patch.estimatedTimeMax,
      active: patch.isActive,
      sort_order: patch.sortOrder,
    })
    .eq("id", zoneId);
  if (error) throw new Error(error.message);
}

export async function deleteSupabaseDeliveryZone(zoneId: string) {
  assertConfigured();
  const { error } = await getSupabaseClient().from("delivery_zones").delete().eq("id", zoneId);
  if (error) throw new Error(error.message);
}
