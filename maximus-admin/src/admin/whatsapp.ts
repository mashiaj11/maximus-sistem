import { getSupabaseClient } from "@/lib/supabase";
import type { Order, OrderStatus } from "./data/types";

export async function sendWhatsAppStatusMessage(order: Order, status: OrderStatus) {
  await invokeOrderWhatsAppNotification(order.id, status);
}

export async function invokeOrderWhatsAppNotification(orderId: string, status: OrderStatus) {
  const { error } = await getSupabaseClient().functions.invoke("send-order-whatsapp", {
    body: { orderId, status },
  });
  if (error) throw new Error(error.message);
}
