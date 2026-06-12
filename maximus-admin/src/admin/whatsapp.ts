import type { AdminUnit, Order, OrderStatus, WhatsappMessageSettings } from "./data/types";

const MESSAGE_KEY_BY_STATUS: Partial<Record<OrderStatus, keyof WhatsappMessageSettings>> = {
  recebido: "receivedMessage",
  aceito: "acceptedMessage",
  em_producao: "productionMessage",
  pronto: "readyMessage",
  saiu_entrega: "outForDeliveryMessage",
  a_caminho: "driverOnWayMessage",
  perto_500m: "driverNearbyMessage",
  chegou: "deliveredMessage",
  entregue_mesa: "deliveredMessage",
  retirado: "deliveredMessage",
};

export function buildWhatsAppMessage(order: Order, status: OrderStatus, unit?: AdminUnit | null) {
  const settings = unit?.whatsappSettings;
  const key = MESSAGE_KEY_BY_STATUS[status];
  const template = key ? settings?.[key] : undefined;
  const fallback = `Pedido #${order.number}: ${status.replaceAll("_", " ")}.`;

  return String(template || fallback)
    .replaceAll("{{pedido}}", String(order.number))
    .replaceAll("{{cliente}}", order.customerName)
    .replaceAll("{{status}}", status);
}

export async function sendWhatsAppStatusMessage(
  order: Order,
  status: OrderStatus,
  unit?: AdminUnit | null,
) {
  const settings = unit?.whatsappSettings;
  if (!settings?.enabled) return;

  const provider = settings.provider ?? "none";
  const phone = order.customerPhone;
  const message = buildWhatsAppMessage(order, status, unit);

  if (!phone) {
    console.info("[Maximus][WhatsApp] Pedido sem telefone do cliente; envio ignorado.", {
      orderId: order.id,
      status,
    });
    return;
  }

  if (provider === "none" || !settings.apiUrl || !settings.apiKey) {
    console.info("[Maximus][WhatsApp] Modo simulado; mensagem nao enviada para API.", {
      provider,
      phone: normalizeWhatsAppPhone(phone),
      message,
      orderId: order.id,
      status,
    });
    return;
  }

  await sendWhatsAppMessage(phone, message, settings);
}

export async function sendWhatsAppMessage(
  phone: string,
  message: string,
  settings: WhatsappMessageSettings,
) {
  console.info("[Maximus][WhatsApp] Provider configurado; adapte o conector HTTP aqui.", {
    provider: settings.provider,
    apiUrl: settings.apiUrl,
    instanceId: settings.instanceId,
    phone: normalizeWhatsAppPhone(phone),
    message,
  });
}

export function normalizeWhatsAppPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}
