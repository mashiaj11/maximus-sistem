import { TYPE_LABELS } from "./data/statuses";
import type { KitchenPrintSettings, Order, PaymentMethod, PaymentStatus } from "./data/types";

const logoUrl = "/branding/maximus-logo.png";

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix_app: "Pix pelo app",
  pix_balcao: "Pix no balcão",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendente",
  customer_reported_paid: "Pagamento informado",
  confirmed: "Confirmado",
  rejected: "Recusado",
};

export interface KitchenTicketPayload {
  orderId: string;
  number: number;
  type: string;
  location: string;
  customerName: string;
  createdAt: string;
  items: Array<{
    quantity: number;
    name: string;
    unitPrice: number;
    customizations: string[];
    notes?: string;
  }>;
  notes?: string;
  payment: string;
  paymentStatus: string;
  total: number;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function orderLocation(order: Order): string {
  if (order.type === "mesa" && order.tableNumber != null)
    return `Mesa ${String(order.tableNumber).padStart(2, "0")}`;
  if (order.type === "delivery") return order.address ?? "Delivery sem endereço";
  if (order.type === "levar") return "Retirada / levar";
  return "Balcão";
}

export function buildKitchenTicket(order: Order): string {
  const payload = buildKitchenTicketPayload(order);
  const itemRows = payload.items
    .map((item) => {
      const customizations = item.customizations.length
        ? `<ul>${item.customizations.map((customization) => `<li>${escapeHtml(customization)}</li>`).join("")}</ul>`
        : '<p class="muted">Sem acompanhamentos/adicionais.</p>';
      const notes = item.notes ? `<p class="item-note">Obs: ${escapeHtml(item.notes)}</p>` : "";
      return `
        <section class="item">
          <div class="item-head">
            <strong>${item.quantity}x ${escapeHtml(item.name)}</strong>
            <span>${formatBRL(item.quantity * item.unitPrice)}</span>
          </div>
          <p class="label">Acompanhamentos / adicionais</p>
          ${customizations}
          ${notes}
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Comanda #${payload.number}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #fff;
      color: #111;
      font-family: Arial, sans-serif;
      font-size: 13px;
    }
    main {
      width: 80mm;
      max-width: 100%;
      padding: 12px;
    }
    h1 {
      margin: 0;
      font-size: 24px;
      letter-spacing: 0;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 2px solid #111;
      margin-bottom: 10px;
      padding-bottom: 8px;
    }
    .brand img {
      width: 34px;
      height: 34px;
      object-fit: contain;
    }
    .brand strong {
      display: block;
      font-size: 15px;
      text-transform: uppercase;
    }
    .brand span {
      display: block;
      color: #555;
      font-size: 11px;
    }
    .muted { color: #555; }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px dashed #aaa;
      padding: 5px 0;
    }
    .section {
      border-top: 2px solid #111;
      margin-top: 10px;
      padding-top: 8px;
    }
    .item {
      border-bottom: 1px dashed #aaa;
      padding: 8px 0;
    }
    .item-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 14px;
    }
    .label {
      margin: 6px 0 2px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    ul {
      margin: 0;
      padding-left: 18px;
    }
    .item-note,
    .order-note {
      border: 1px solid #111;
      margin: 8px 0 0;
      padding: 6px;
      font-weight: 700;
    }
    .total {
      font-size: 18px;
      font-weight: 800;
    }
    @media print {
      body { width: 80mm; }
      main { width: 80mm; }
    }
  </style>
</head>
<body>
  <main>
    <div class="brand">
      <img src="${logoUrl}" alt="Maximus" />
      <div>
        <strong>Maximus Hamburgueria</strong>
        <span>Comanda da cozinha</span>
      </div>
    </div>
    <h1>Pedido #${payload.number}</h1>
    <div class="row"><strong>Tipo</strong><span>${escapeHtml(payload.type)}</span></div>
    <div class="row"><strong>Local</strong><span>${escapeHtml(payload.location)}</span></div>
    <div class="row"><strong>Cliente</strong><span>${escapeHtml(payload.customerName)}</span></div>
    <div class="row"><strong>Horário</strong><span>${escapeHtml(formatTime(payload.createdAt))}</span></div>

    <div class="section">
      <strong>Itens</strong>
      ${itemRows}
    </div>

    ${
      payload.notes
        ? `<div class="section"><strong>Observações do pedido</strong><p class="order-note">${escapeHtml(payload.notes)}</p></div>`
        : ""
    }

    <div class="section">
      <div class="row"><strong>Pagamento</strong><span>${escapeHtml(payload.payment)}</span></div>
      <div class="row"><strong>Status</strong><span>${escapeHtml(payload.paymentStatus)}</span></div>
      <div class="row total"><strong>Total</strong><span>${formatBRL(payload.total)}</span></div>
    </div>
  </main>
</body>
</html>`;
}

export async function printKitchenOrder(order: Order): Promise<{ ok: true }> {
  const payload = buildKitchenTicketPayload(order);
  console.log("[Maximus][KitchenPrint] Envio local da comanda", {
    payload,
    ticketHtml: buildKitchenTicket(order),
  });
  await new Promise((resolve) => window.setTimeout(resolve, 250));
  return { ok: true };
}

export async function printKitchenTest(settings: KitchenPrintSettings): Promise<{ ok: true }> {
  console.log("[Maximus][KitchenPrint] Teste local de impressão", {
    printerName: settings.printerName,
    printerIp: settings.printerIp,
    printerPort: settings.printerPort,
    printerType: settings.printerType,
    copies: settings.copies,
    autoPrintEnabled: settings.autoPrintEnabled,
  });
  await new Promise((resolve) => window.setTimeout(resolve, 250));
  return { ok: true };
}

function buildKitchenTicketPayload(order: Order): KitchenTicketPayload {
  return {
    orderId: order.id,
    number: order.number,
    type: TYPE_LABELS[order.type],
    location: orderLocation(order),
    customerName: order.customerName,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      quantity: item.quantity,
      name: item.name,
      unitPrice: item.unitPrice,
      customizations: item.customizations,
      notes: item.notes,
    })),
    notes: order.notes,
    payment: PAYMENT_METHOD_LABELS[order.paymentMethod],
    paymentStatus: PAYMENT_STATUS_LABELS[order.paymentStatus],
    total: order.total,
  };
}
