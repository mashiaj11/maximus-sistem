import type { RestaurantTable } from "./types";

export const TABLES: RestaurantTable[] = [];

export const TABLE_STATUS_LABELS: Record<RestaurantTable["status"], string> = {
  livre: "Livre",
  ocupada: "Ocupada",
  pedido_ativo: "Pedido ativo",
};
