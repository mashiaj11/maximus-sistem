// Tipos de dados do Admin Maximus.

export type OrderType = "delivery" | "mesa" | "levar" | "balcao";
export type UnitId = "maximus-01" | "maximus-02";

export type PaymentMethod = "pix_app" | "pix_balcao" | "cartao" | "dinheiro";

export type PaymentStatus = "pending" | "customer_reported_paid" | "confirmed" | "rejected";

export type OrderStatus =
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

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  customizations: string[];
  notes?: string;
}

export interface Order {
  id: string;
  unitId: UnitId;
  number: number;
  customerName: string;
  customerPhone?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientNotes?: string;
  type: OrderType;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  total: number;
  createdAt: string; // ISO
  items: OrderItem[];
  notes?: string;
  address?: string;
  tableNumber?: number;
  courierId?: string;
  courierName?: string;
  deliveryFee?: number;
  delivery_fee?: number;
  deliveryFeeSnapshot?: number;
  delivery_fee_snapshot?: number;
  courierFee?: number;
  deliveryDistanceKm?: number;
  driverEarnedValue?: number;
  driver_earned_value?: number;
  customerAddressText?: string;
  address_street?: string;
  address_number?: string;
  address_neighborhood?: string;
  address_complement?: string;
  address_reference?: string;
  delivery_lat?: number;
  delivery_lng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryLocationSource?:
    | "gps"
    | "pin"
    | "geocoding"
    | "geocoded_address"
    | "manual_pin"
    | "manual_unavailable";
  delivery_location_source?:
    | "gps"
    | "pin"
    | "geocoding"
    | "geocoded_address"
    | "manual_pin"
    | "manual_unavailable";
  geocodingStatus?:
    | "gps_confirmed"
    | "geocoded"
    | "geocoding_failed"
    | "bairro_fallback"
    | "not_needed";
  geocoding_status?:
    | "gps_confirmed"
    | "geocoded"
    | "geocoding_failed"
    | "bairro_fallback"
    | "not_needed";
  customer_lat?: number;
  customer_lng?: number;
  customerLat?: number;
  customerLng?: number;
  driver_lat?: number;
  driver_lng?: number;
  driverLat?: number;
  driverLng?: number;
  deliveryStatus?: string;
  deliveryDriverId?: string;
  deliveryDriverName?: string;
  driver_id?: string;
  driver_name?: string;
  delivered_at?: string;
  payment_confirmed?: boolean;
  delivery_completed_by_driver?: boolean;
  deliveryPayoutAmount?: number;
  outForDeliveryAt?: string;
  navigationStartedAt?: string;
  navigation_started_at?: string;
  deliveredAt?: string;
  kitchenPrintStatus?: KitchenPrintStatus;
  kitchenPrintedAt?: string;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  active: boolean;
  unitIds?: UnitId[];
  description?: string;
  imageUrl?: string;
  optionGroups?: ProductOptionGroup[];
}

export type ProductDraft = Pick<
  Product,
  "name" | "categoryId" | "price" | "active" | "description" | "imageUrl" | "optionGroups"
>;

export type ProductOptionGroupType = "single" | "multiple";

export interface ProductOptionChoice {
  id: string;
  name: string;
  priceDelta: number;
  active: boolean;
}

export interface ProductOptionGroup {
  id: string;
  name: string;
  type: ProductOptionGroupType;
  required: boolean;
  minChoices: number;
  maxChoices: number;
  choices: ProductOptionChoice[];
}

export interface Category {
  id: string;
  name: string;
  order: number;
  activeByUnit: Record<UnitId, boolean>;
  availabilityScope?: "all" | "dine_in_only" | "delivery_only" | "takeaway_only";
}

export type TableStatus = "livre" | "ocupada" | "pedido_ativo";

export interface RestaurantTable {
  id: string;
  unitId: UnitId;
  number: number;
  status: TableStatus;
  active: boolean;
  menuLink: string;
  publicUrl: string;
  qrCodeData: string;
  createdAt: string;
}

export type UnitTheme = "dark" | "light";
export type KitchenPrinterType = "escpos" | "thermal_generic" | "a4";
export type KitchenPrintStatus = "pending" | "printed" | "error" | "disabled";

export interface KitchenPrintSettings {
  autoPrintEnabled: boolean;
  printerName: string;
  printerIp: string;
  printerPort: number;
  printerType: KitchenPrinterType;
  copies: number;
}

export interface WhatsappMessageSettings {
  enabled: boolean;
  officialNumber: string;
  provider?: "none" | "evolution" | "waha" | "zapi";
  apiUrl?: string;
  apiKey?: string;
  instanceId?: string;
  receivedMessage: string;
  acceptedMessage: string;
  productionMessage: string;
  readyMessage: string;
  outForDeliveryMessage: string;
  driverOnWayMessage?: string;
  driverNearbyMessage?: string;
  deliveredMessage: string;
}

export interface DriverPanelSettings {
  enabled: boolean;
}

export type WeekdayKey = "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado" | "domingo";

export interface BusinessHourPeriod {
  opensAt: string;
  closesAt: string;
}

export interface BusinessHour {
  day: WeekdayKey;
  open: boolean;
  periods: BusinessHourPeriod[];
  opensAt?: string;
  closesAt?: string;
}

export interface AdminUnit {
  id: UnitId;
  name: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  isOpen: boolean;
  businessHours: BusinessHour[];
  theme: UnitTheme;
  accessPin: string;
  kitchenPrintSettings?: KitchenPrintSettings;
  whatsappSettings?: WhatsappMessageSettings;
  driverPanelSettings?: DriverPanelSettings;
  minimumOrderValue?: number;
  baseDeliveryFee?: number;
  deliveryFeePerKm?: number;
  maxDeliveryDistanceKm?: number;
  freeDeliveryFrom?: number;
}

export type CourierStatus = "disponivel" | "em_entrega" | "inativo";

export interface Courier {
  id: string;
  unitId: UnitId;
  name: string;
  phone: string;
  username?: string;
  accessPin?: string;
  status: CourierStatus;
  active: boolean;
  isActive?: boolean;
  deletedAt?: string;
}

export interface DeliveryRule {
  id: string;
  unitId: UnitId;
  maxDistanceKm: number;
  estimatedMinutes: number;
  deliveryFee: number;
  isActive: boolean;
}

export type DeliverySettlementStatus = "open" | "paid" | "cancelled";

export interface DeliverySettlementDriver {
  driverId: string;
  driverName: string;
  deliveriesCount: number;
  totalAmount: number;
}

export interface DeliverySettlement {
  id: string;
  unitId: UnitId;
  settlementDate: string;
  drivers: DeliverySettlementDriver[];
  totalDeliveries: number;
  totalAmount: number;
  status: DeliverySettlementStatus;
  createdAt: string;
  updatedAt: string;
}
