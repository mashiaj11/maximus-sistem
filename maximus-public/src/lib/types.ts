export type FoodVariant = "burger" | "churrasco" | "petiscos" | "bebidas" | "chopp" | "plate";

export type OptionGroupType = "single" | "multiple";

export interface ProductOption {
  id: string;
  label: string;
  price?: number;
}

export interface ProductOptionGroup {
  id: string;
  title: string;
  type: OptionGroupType;
  required?: boolean;
  min?: number;
  max?: number;
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
  label: "Casa" | "Trabalho" | "Outro";
  street: string;
  number: string;
  neighborhood: string;
  complement?: string;
  reference?: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CustomerOrderItem {
  name: string;
  quantity: number;
  total: number;
}

export interface CustomerOrderHistory {
  id: string;
  number: string;
  date: number;
  items: CustomerOrderItem[];
  total: number;
  mode: OrderTrackMode;
  status: string;
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
    | "pending_on_delivery";
  paymentMethod?: "pix_app" | "pix_entrega" | "cartao" | "dinheiro";
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
    { key: "driver_on_way", label: "Entregador a caminho" },
    { key: "driver_nearby", label: "Entregador a 500 metros" },
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
