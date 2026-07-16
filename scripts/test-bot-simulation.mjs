const phone = "93984057229";
const instance = "maximus";

const sessions = new Map();
const processed = new Set();
const statusSent = new Set();

function key() {
  return `${instance}:${phone}`;
}

function handleMessage(messageId, text, pushName = "Cliente Maximus") {
  const dedupeKey = `${instance}:${messageId}`;
  if (processed.has(dedupeKey)) {
    return { processed: false, duplicate: true, reply: null };
  }
  processed.add(dedupeKey);

  const current = sessions.get(key()) ?? {
    name: pushName.split(/\s+/)[0],
    greeted: false,
    lastMessageId: null,
    state: "idle",
    summary: "",
  };

  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const replies = [];
  if (!current.greeted) {
    replies.push(`Boa noite, ${current.name}!`);
    current.greeted = true;
  }
  if (normalized.includes("cardapio")) {
    replies.push("Segue o cardapio pelo site da Maximus. Posso te ajudar a encontrar hamburguers, bebidas ou petiscos.");
    current.state = "menu";
  } else if (normalized.includes("horario")) {
    replies.push("Vou conferir o horario da unidade antes de confirmar.");
    current.state = "business_hours";
  } else if (normalized.includes("taxa") || normalized.includes("entrega")) {
    replies.push("A taxa depende do endereco ou zona de entrega. Me informe o bairro para confirmar.");
    current.state = "delivery_fee";
  } else {
    replies.push("Certo, continuo por aqui acompanhando sua solicitacao.");
  }

  current.lastMessageId = messageId;
  current.summary = `${current.summary} cliente: ${text}; bot: ${replies.join(" ")}`.slice(-500);
  current.expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  sessions.set(key(), current);

  return { processed: true, duplicate: false, reply: replies.join("\n\n"), session: current };
}

function finishOrder(orderId, status) {
  const sendKey = `${orderId}:${status}:${phone}`;
  if (statusSent.has(sendKey)) return { sent: false, duplicate: true };
  statusSent.add(sendKey);
  if (["delivered", "delivered_to_table", "picked_up", "cancelled"].includes(status)) {
    sessions.delete(key());
  }
  return { sent: true, duplicate: false, sessionClosed: !sessions.has(key()) };
}

const checks = [];
checks.push(["primeira saudacao", handleMessage("msg-001", "Oi, quero ver o cardapio").reply]);
checks.push(["continua sem nova saudacao", handleMessage("msg-002", "Qual o horario?").reply]);
checks.push(["taxa de entrega", handleMessage("msg-003", "Qual a taxa de entrega?").reply]);
checks.push(["mensagem duplicada", JSON.stringify(handleMessage("msg-003", "Qual a taxa de entrega?"))]);
checks.push(["message_id duplicado", JSON.stringify(handleMessage("msg-003", "Outra mensagem com mesmo id"))]);
checks.push(["mudanca de status", JSON.stringify(finishOrder("pedido-001", "out_for_delivery"))]);
checks.push(["pedido finalizado", JSON.stringify(finishOrder("pedido-001", "delivered"))]);
checks.push(["sem looping finalizado", JSON.stringify(finishOrder("pedido-001", "delivered"))]);
checks.push(["memoria encerrada", String(!sessions.has(key()))]);

for (const [label, value] of checks) {
  console.log(`${label}: ${value}`);
}
