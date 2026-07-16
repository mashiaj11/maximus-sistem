export type FoodVariant =
  | "burger"
  | "churrasco"
  | "petiscos"
  | "bebidas"
  | "chopp"
  | "plate"
  | "sobremesas"
  | "sucos"
  | "refrigerantes";

export type OptionGroupType = "single" | "multiple";

export interface ProductOption {
  id: string;
  label: string;
  price?: number;
  isNegativeChoice?: boolean;
  maxQuantity?: number;
}

export interface ProductOptionGroup {
  id: string;
  title: string;
  type: OptionGroupType;
  required?: boolean;
  min?: number;
  max?: number;
  decisionRequired?: boolean;
  active?: boolean;
  sortOrder?: number;
  options: ProductOption[];
}

export type SelectedOptions = Record<string, string[]>;

export interface CartCustomization {
  groupId: string;
  groupTitle: string;
  type: OptionGroupType;
  options: ProductOption[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: CategoryId;
  svg: FoodVariant;
  imageUrl?: string;
  image_url?: string;
  optionGroups?: ProductOptionGroup[];
  availableForDelivery?: boolean;
  availableForPickup?: boolean;
  availableForDineIn?: boolean;
  dineInOnly?: boolean;
}

export type CategoryId = string;

export interface Category {
  id: CategoryId;
  label: string;
  svg: FoodVariant;
  availabilityScope?: "all" | "dine_in_only" | "delivery_only" | "takeaway_only";
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  basePrice: number;
  unitPrice: number;
  selections: SelectedOptions;
  customizations: CartCustomization[];
  note?: string;
}

export interface CustomerAddress {
  id: string;
  label: "Casa" | "Trabalho" | "Amigos" | "Outro";
  street: string;
  number: string;
  neighborhood: string;
  city?: string;
  state?: string;
  postalCode?: string;
  complement?: string;
  reference?: string;
  latitude?: number;
  longitude?: number;
  deliveryZoneId?: string;
  deliveryZoneName?: string;
  deliveryFeeSnapshot?: number;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DeliveryZone {
  id: string;
  unitId: string;
  name: string;
  fee: number;
  estimatedTimeMin?: number | null;
  estimatedTimeMax?: number | null;
  isActive: boolean;
  sortOrder: number;
}

export interface CustomerOrderItem {
  productId?: string;
  name: string;
  quantity: number;
  unitPrice?: number;
  total: number;
  customizations?: string[];
  notes?: string;
}

export interface CustomerOrderHistory {
  id: string;
  number: string;
  date: number;
  items: CustomerOrderItem[];
  subtotal?: number;
  deliveryFee?: number;
  total: number;
  mode: OrderTrackMode;
  status: string;
  rawStatus?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  address?: CustomerAddress;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  addresses: CustomerAddress[];
  orders: CustomerOrderHistory[];
  createdAt: number;
  updatedAt: number;
}

export type ConsumeMode = "delivery" | "balcao" | "local" | "mesa" | "levar";

export type OrderTrackMode = "delivery" | "mesa" | "retirada";

export interface OrderInfo {
  id: string;
  mode: OrderTrackMode;
  total: number;
  createdAt: number;
  paymentStatus?:
    | "pending"
    | "customer_reported_paid"
    | "confirmed"
    | "rejected"
    | "pending_on_delivery"
    | "paid_on_delivery";
  paymentMethod?: "pix_app" | "pix_entrega" | "cartao" | "dinheiro" | "local";
  table?: string;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientNotes?: string;
  address?: CustomerAddress;
  items?: CustomerOrderItem[];
  unitId?: string;
  unitSlug?: string;
  unitName?: string;
  unitLat?: number;
  unitLng?: number;
  status?: string;
  deliveryStatus?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryDistanceKm?: number | null;
  deliveryFee?: number;
  deliveryRangeId?: string | null;
  deliveryZoneId?: string | null;
  deliveryZoneName?: string | null;
  deliveryEstimatedTime?: number | null;
  deliveryCalculationMethod?: string | null;
  minimumOrderValue?: number;
  deliveryLocationSource?:
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
  customerLat?: number;
  customerLng?: number;
  customerAddressText?: string;
  driverLat?: number;
  driverLng?: number;
}

export interface OrderStatusStep {
  key: string;
  label: string;
}

export const STATUS_FLOWS: Record<OrderTrackMode, OrderStatusStep[]> = {
  delivery: [
    { key: "received", label: "Pedido recebido" },
    { key: "accepted", label: "Pedido aceito" },
    { key: "in_preparation", label: "Em produção" },
    { key: "ready", label: "Pedido pronto" },
    { key: "out_for_delivery", label: "Saiu para entrega" },
    { key: "arrived", label: "Pedido chegou" },
    { key: "delivered", label: "Entregue" },
  ],
  mesa: [
    { key: "received", label: "Pedido recebido" },
    { key: "accepted", label: "Pedido aceito" },
    { key: "in_preparation", label: "Em produção" },
    { key: "ready", label: "Pedido pronto" },
    { key: "delivered_to_table", label: "Entregue na mesa" },
  ],
  retirada: [
    { key: "received", label: "Pedido recebido" },
    { key: "accepted", label: "Pedido aceito" },
    { key: "in_preparation", label: "Em produção" },
    { key: "ready_for_pickup", label: "Pronto para retirada" },
    { key: "picked_up", label: "Retirado" },
  ],
};
