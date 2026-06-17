import { TYPE_LABELS } from "./data/statuses";
import type {
  AdminUnit,
  KitchenPrintSettings,
  Order,
  PaymentMethod,
  PaymentStatus,
} from "./data/types";

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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function orderLocation(order: Order): string {
  if (order.type === "mesa" && order.tableNumber != null)
    return `Mesa ${String(order.tableNumber).padStart(2, "0")}`;
  if (order.type === "delivery") return order.address ?? "Delivery sem endereço";
  if (order.type === "levar") return "Retirada / levar";
  return "Balcão";
}

function receiptDeliveryAddress(order: Order) {
  return (
    order.customerAddressText ??
    order.address ??
    [
      order.address_street,
      order.address_number,
      order.address_neighborhood,
      order.address_complement ? `Compl.: ${order.address_complement}` : null,
      order.address_reference ? `Ref.: ${order.address_reference}` : null,
    ]
      .filter(Boolean)
      .join(", ")
  );
}

function orderReceiptConsumptionLabel(order: Order) {
  if (order.type === "delivery") return "Delivery";
  if (order.type === "mesa") return "Comer no local";
  if (order.type === "levar") return "Retirada";
  return "Balcão";
}

function buildOrderReceipt(order: Order, unit?: AdminUnit | null): string {
  const itemRows = order.items
    .map((item) => {
      const itemSubtotal = item.quantity * item.unitPrice;
      const customizations = item.customizations.length
        ? `<div class="muted small">${item.customizations.map(escapeHtml).join(" · ")}</div>`
        : "";
      const notes = item.notes
        ? `<div class="muted small">Obs: ${escapeHtml(item.notes)}</div>`
        : "";
      return `
        <tr>
          <td>
            <strong>${escapeHtml(item.name)}</strong>
            ${customizations}
            ${notes}
          </td>
          <td class="num">${item.quantity}</td>
          <td class="num">${formatBRL(item.unitPrice)}</td>
          <td class="num">${formatBRL(itemSubtotal)}</td>
        </tr>
      `;
    })
    .join("");
  const subtotal = order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const deliveryFee =
    order.deliveryFeeSnapshot ??
    order.delivery_fee_snapshot ??
    order.deliveryFee ??
    order.delivery_fee ??
    0;
  const discounts = Math.max(0, subtotal + deliveryFee - order.total);
  const payment = PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod;
  const paymentStatus = PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus;
  const consumption = orderReceiptConsumptionLabel(order);
  const deliveryAddress = order.type === "delivery" ? receiptDeliveryAddress(order) : "";
  const table = order.type === "mesa" && order.tableNumber != null ? orderLocation(order) : "";
  const cnpj = unit?.cnpj?.trim();

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Comprovante do Pedido #${order.number}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f4f4f4;
      color: #111;
      font-family: Arial, sans-serif;
      font-size: 12px;
    }
    main {
      width: min(190mm, calc(100% - 24px));
      margin: 12px auto;
      background: #fff;
      padding: 14mm;
    }
    .brand {
      display: flex;
      gap: 12px;
      align-items: center;
      border-bottom: 2px solid #111;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .brand img { width: 68px; max-height: 52px; object-fit: contain; }
    h1 { margin: 0; font-size: 22px; }
    h2 { margin: 14px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; }
    p { margin: 2px 0; }
    .muted { color: #555; }
    .small { font-size: 10px; margin-top: 2px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px dashed #bbb;
      padding: 5px 0;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th, td { border-bottom: 1px solid #ddd; padding: 7px 4px; text-align: left; vertical-align: top; }
    th { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; }
    .num { text-align: right; white-space: nowrap; }
    .totals { margin-left: auto; width: min(280px, 100%); }
    .total { font-size: 16px; font-weight: 800; border-bottom: 2px solid #111; }
    .footer {
      margin-top: 18px;
      border-top: 2px solid #111;
      padding-top: 10px;
      text-align: center;
      font-weight: 700;
    }
    .future-fiscal { display: none; }
    @page { size: auto; margin: 8mm; }
    @media print {
      body { background: #fff; }
      main { width: 100%; margin: 0; padding: 0; }
    }
    @media print and (max-width: 90mm) {
      main { width: 80mm; font-size: 11px; }
      .brand img { width: 44px; }
      .grid { grid-template-columns: 1fr; }
      th, td { padding: 5px 2px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="brand">
      <img src="${logoUrl}" alt="Maximus" />
      <div>
        <h1>Comprovante do Pedido</h1>
        <p><strong>${escapeHtml(unit?.name ?? "Maximus")}</strong></p>
        ${unit?.address ? `<p class="muted">${escapeHtml(unit.address)}</p>` : ""}
        ${unit?.phone ? `<p class="muted">Telefone/WhatsApp: ${escapeHtml(unit.phone)}</p>` : ""}
        ${cnpj ? `<p class="muted">CNPJ: ${escapeHtml(cnpj)}</p>` : ""}
      </div>
    </section>

    <section class="grid">
      <div><strong>Número do pedido</strong><p>#${order.number}</p></div>
      <div><strong>Data e hora</strong><p>${escapeHtml(formatDateTime(order.createdAt))}</p></div>
      <div><strong>Cliente</strong><p>${escapeHtml(order.customerName || "Não informado")}</p></div>
      <div><strong>Telefone</strong><p>${escapeHtml(order.customerPhone || "Não informado")}</p></div>
      <div><strong>Forma de consumo</strong><p>${escapeHtml(consumption)}</p></div>
      <div><strong>Status do pedido</strong><p>${escapeHtml(TYPE_LABELS[order.type])} · ${escapeHtml(order.status)}</p></div>
      ${deliveryAddress ? `<div><strong>Endereço de entrega</strong><p>${escapeHtml(deliveryAddress)}</p></div>` : ""}
      ${table ? `<div><strong>Mesa</strong><p>${escapeHtml(table)}</p></div>` : ""}
    </section>

    <section>
      <h2>Itens do pedido</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th class="num">Qtd.</th>
            <th class="num">Unitário</th>
            <th class="num">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemRows || `<tr><td colspan="4">Sem itens.</td></tr>`}</tbody>
      </table>
    </section>

    <section class="totals">
      <div class="row"><strong>Subtotal</strong><span>${formatBRL(subtotal)}</span></div>
      <div class="row"><strong>Taxa de entrega</strong><span>${formatBRL(deliveryFee)}</span></div>
      <div class="row"><strong>Descontos</strong><span>${formatBRL(discounts)}</span></div>
      <div class="row total"><strong>Total pago</strong><span>${formatBRL(order.total)}</span></div>
      <div class="row"><strong>Pagamento</strong><span>${escapeHtml(payment)}</span></div>
      <div class="row"><strong>Status do pagamento</strong><span>${escapeHtml(paymentStatus)}</span></div>
    </section>

    ${order.notes ? `<section><h2>Observações</h2><p>${escapeHtml(order.notes)}</p></section>` : ""}

    <section class="future-fiscal" aria-hidden="true">
      <!-- Preparado para futura NFC-e/NF-e: chave de acesso, QR Code fiscal e XML. -->
    </section>

    <footer class="footer">
      <p>Comprovante sem valor fiscal.</p>
      <p>Documento emitido apenas para conferência e ressarcimento.</p>
    </footer>
  </main>
  <script>
    window.addEventListener("load", () => {
      window.focus();
      window.print();
    });
  </script>
</body>
</html>`;
}

export function openOrderReceiptPrintWindow() {
  const url = "about:blank";
  const printWindow = window.open(url, "_blank", "width=900,height=700");
  console.log("[PRINT] URL:", url);
  console.log("[PRINT] WINDOW:", printWindow);
  return printWindow;
}

export function printOrderReceipt(
  order: Order,
  unit?: AdminUnit | null,
  printWindow = openOrderReceiptPrintWindow(),
) {
  if (!printWindow) {
    throw new Error("Não foi possível abrir a janela de impressão.");
  }
  printWindow.document.open();
  printWindow.document.write(buildOrderReceipt(order, unit));
  printWindow.document.close();
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
