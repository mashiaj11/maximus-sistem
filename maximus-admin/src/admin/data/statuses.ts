import type { OrderStatus, OrderType } from "./types";

// Fluxo de status por tipo de pedido.
export const STATUS_FLOW: Record<OrderType, OrderStatus[]> = {
  delivery: ["received", "accepted", "in_preparation", "ready", "out_for_delivery", "delivered"],
  mesa: ["received", "accepted", "in_preparation", "ready", "delivered_to_table"],
  levar: ["received", "accepted", "in_preparation", "ready_for_pickup", "picked_up"],
  balcao: ["received", "accepted", "in_preparation", "ready_for_pickup", "picked_up"],
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Pedido recebido",
  accepted: "Pedido aceito",
  in_preparation: "Em produção",
  ready: "Pedido pronto",
  ready_for_pickup: "Pronto para retirada",
  out_for_delivery: "Saiu para entrega",
  driver_on_way: "Entregador a caminho",
  driver_nearby: "Entregador a 500 metros",
  arrived: "Pedido chegou",
  delivered: "Entregue",
  picked_up: "Retirado",
  delivered_to_table: "Entregue na mesa",
  cancelled: "Cancelado",
};

export const TYPE_LABELS: Record<OrderType, string> = {
  delivery: "Delivery",
  mesa: "Mesa",
  levar: "Levar",
  balcao: "Balcão",
};

// Status considerados "ativos" (em andamento).
export const FINAL_STATUSES: OrderStatus[] = [
  "delivered",
  "delivered_to_table",
  "picked_up",
  "cancelled",
];

export function getNextStatus(type: OrderType, current: OrderStatus): OrderStatus | null {
  const flow = STATUS_FLOW[type];
  const idx = flow.indexOf(current);
  if (idx === -1 || idx >= flow.length - 1) return null;
  return flow[idx + 1];
}

export function isFinalStatus(status: OrderStatus): boolean {
  return FINAL_STATUSES.includes(status);
}
