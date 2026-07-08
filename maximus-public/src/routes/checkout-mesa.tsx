import { useEffect, useId, useState, type HTMLAttributes } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckoutShell, BigOption } from "@/components/checkout/CheckoutShell";
import { useCart, useOrder } from "@/lib/store";
import { formatPrice } from "@/lib/format";
import { normalizeMesa } from "@/lib/utils";
import type { OrderInfo, OrderTrackMode } from "@/lib/types";
import {
  findCustomerByPhone,
  getCurrentCustomer,
  getSavedCustomerProfile,
  saveCustomer,
  saveSavedCustomerProfile,
} from "@/lib/customer";
import { createOrderInSupabase, findPublicTable, loadPublicMenu } from "@/lib/supabase-data";
import type { GeoUnit } from "@/lib/geo";

interface CheckoutMesaSearch {
  mesa?: string;
  table?: string;
  unidade?: string;
  unit?: string;
  mode?: string;
}

export const Route = createFileRoute("/checkout-mesa")({
  validateSearch: (s: Record<string, unknown>): CheckoutMesaSearch => {
    const table = normalizeMesa(s.mesa ?? s.table ?? s.table_number);
    const unit =
      typeof s.unidade === "string"
        ? s.unidade
        : typeof s.unit === "string"
          ? s.unit
          : typeof s.unit_id === "string"
            ? s.unit_id
            : typeof s.unit_slug === "string"
              ? s.unit_slug
              : undefined;
    return {
      mesa: table,
      table,
      unidade: unit,
      unit,
      mode: typeof s.mode === "string" ? s.mode : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Finalizar pedido — Maximus" },
      { name: "description", content: "Finalize seu pedido de mesa na Maximus." },
    ],
  }),
  component: CheckoutMesaPage,
});

type Step =
  | "choice"
  | "contact"
  | "payment"
  | "payDelivery"
  | "payCash"
  | "payCard"
  | "payPix"
  | "payApp";

type MesaConsumptionMode = "dine_in" | "pickup";

function normalizeTableNumber(value?: string) {
  return value ? String(Number(value)).padStart(2, "0") : "";
}

// ─── Page ────────────────────────────────────────────────────────────────────

function CheckoutMesaPage() {
  const { mesa, table: tableParam, unidade, unit } = Route.useSearch();
  const navigate = useNavigate();
  const { items, subtotal, count, orderContext } = useCart();
  const { placeOrder } = useOrder();

  // URL params from the scanned QR take priority over any previous session context.
  const effectiveUnit = unidade ?? unit ?? orderContext?.unit;
  const effectiveTable = mesa ?? tableParam ?? orderContext?.table;
  const displayMesa = normalizeTableNumber(effectiveTable);
  const selectedUnitSlug = effectiveUnit;

  // Form state
  const [step, setStep] = useState<Step>("choice");
  const [consumptionMode, setConsumptionMode] = useState<MesaConsumptionMode>("dine_in");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [needChange, setNeedChange] = useState(false);
  const [changeFor, setChangeFor] = useState("");
  const [units, setUnits] = useState<GeoUnit[]>([]);
  const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);
  const allUnitsClosed = units.length > 0 && units.every((item) => !item.isOpen);

  // ── Bootstrap customer profile ──────────────────────────────────────────
  useEffect(() => {
    const local = getSavedCustomerProfile();
    if (local) {
      setHasSavedProfile(true);
      setName(local.name);
      setPhone(local.phone);
      setPrivacyConsent(true);
    }
    getCurrentCustomer()
      .then((c) => {
        if (!c) return;
        setHasSavedProfile(true);
        setName(c.name);
        setPhone(c.phone);
      })
      .catch(() => undefined);
  }, []);

  // ── Auto-fill by phone ───────────────────────────────────────────────────
  useEffect(() => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) return;
    const timeout = window.setTimeout(() => {
      findCustomerByPhone(phone)
        .then((c) => {
          if (!c) return;
          setName((n) => n || c.name);
        })
        .catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [phone]);

  // ── Load units (to resolve unit id/slug for order submission) ───────────
  useEffect(() => {
    if (!selectedUnitSlug) {
      setUnits([]);
      return;
    }
    loadPublicMenu(selectedUnitSlug, "dine_in")
      .then((data) => setUnits(data.units))
      .catch(() => undefined);
  }, [selectedUnitSlug]);

  if (!effectiveTable) {
    return (
      <div className="min-h-screen">
        <MesaCheckoutHeader unit={effectiveUnit} />
        <CheckoutShell title="Mesa não identificada">
          <div className="space-y-4">
            <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
              Mesa não identificada. Escaneie novamente o QR Code.
            </p>
          </div>
        </CheckoutShell>
      </div>
    );
  }

  if (!effectiveUnit) {
    return (
      <div className="min-h-screen">
        <MesaCheckoutHeader table={displayMesa} />
        <CheckoutShell title="Unidade não identificada">
          <div className="space-y-4">
            <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
              Unidade não identificada. Escaneie novamente o QR Code da mesa.
            </p>
          </div>
        </CheckoutShell>
      </div>
    );
  }

  // ── Empty cart guard ─────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="min-h-screen">
        <MesaCheckoutHeader unit={effectiveUnit} table={displayMesa} />
        <CheckoutShell title="Meu pedido está vazio">
          <Button
            className="w-full bg-gradient-primary font-bold"
            onClick={() =>
              navigate({
                to: "/mesa",
                search: {
                  ...(effectiveUnit ? { unit: effectiveUnit } : {}),
                  ...(effectiveTable ? { table: effectiveTable } : {}),
                },
              })
            }
          >
            Voltar ao cardápio da mesa
          </Button>
        </CheckoutShell>
      </div>
    );
  }

  if (allUnitsClosed) {
    return (
      <div className="min-h-screen">
        <MesaCheckoutHeader unit={effectiveUnit} table={displayMesa} />
        <CheckoutShell title="Estamos fechados agora">
          <div className="space-y-4">
            <p className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm font-semibold text-muted-foreground">
              O checkout está indisponível porque todas as unidades estão fechadas no momento.
            </p>
            <Button
              className="w-full bg-gradient-primary font-bold"
              onClick={() => navigate({ to: "/onde-estamos" })}
            >
              Ver unidades e horários
            </Button>
          </div>
        </CheckoutShell>
      </div>
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function persistCustomer() {
    if (!name.trim() || !phone.trim()) return null;
    if (!hasSavedProfile && !privacyConsent) {
      toast.error("Para continuar, aceite os termos de uso e a política de privacidade.");
      return null;
    }
    const customer = await saveCustomer({ name, phone });
    setHasSavedProfile(true);
    saveSavedCustomerProfile({
      name: customer.name,
      phone: customer.phone,
      customer_id: customer.id,
    });
    return customer;
  }

  async function finalize(
    selectedConsumptionMode: MesaConsumptionMode,
    extra?: {
      paymentStatus?: OrderInfo["paymentStatus"];
      paymentMethod?: OrderInfo["paymentMethod"];
    },
  ) {
    if (submitting) return;
    if (units.length > 0 && units.every((item) => !item.isOpen)) {
      toast.error("Todas as unidades estão fechadas no momento.");
      return;
    }
    setSubmitting(true);

    try {
      const customer = await persistCustomer();

      const unit = units.find((u) => u.slug === selectedUnitSlug || u.id === selectedUnitSlug);

      if (!unit) {
        toast.error("Não foi possível identificar a unidade do pedido.");
        setSubmitting(false);
        return;
      }
      if (!unit.isOpen) {
        toast.error("A unidade selecionada está fechada no momento.");
        setSubmitting(false);
        return;
      }

      const orderMode: OrderTrackMode = selectedConsumptionMode === "dine_in" ? "mesa" : "retirada";

      // Resolve table id only for dine-in orders. Takeaway orders keep the QR unit but do not
      // attach a table to the order.
      let tableId: string | null = null;
      if (selectedConsumptionMode === "dine_in") {
        const publicTable = await findPublicTable(unit.slug, effectiveTable);
        tableId = publicTable?.id ?? null;
        if (!tableId) {
          toast.error("Mesa não encontrada no Supabase. Escaneie novamente o QR Code.");
          setSubmitting(false);
          return;
        }
      }

      const draft: Omit<OrderInfo, "id" | "createdAt"> = {
        mode: orderMode,
        total: subtotal,
        paymentStatus: extra?.paymentStatus,
        paymentMethod: extra?.paymentMethod,
        table: selectedConsumptionMode === "dine_in" ? displayMesa || effectiveTable : undefined,
        customerName: name || undefined,
        customerPhone: customer?.phone ?? phone,
        customerId: customer?.id,
        recipientName: undefined,
        recipientPhone: undefined,
        recipientNotes: undefined,
        address: undefined,
        items: items.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          total: item.unitPrice * item.quantity,
        })),
        unitId: unit.id,
        unitSlug: unit.slug,
        unitName: unit.name,
        unitLat: unit.latitude,
        unitLng: unit.longitude,
        deliveryDistanceKm: null,
        deliveryFee: 0,
        deliveryRangeId: null,
        minimumOrderValue: 0,
        deliveryLat: undefined,
        deliveryLng: undefined,
        deliveryLocationSource: "manual_unavailable",
        geocodingStatus: "not_needed",
        customerLat: undefined,
        customerLng: undefined,
        customerAddressText: undefined,
      };

      const saved = await createOrderInSupabase({
        order: draft,
        cartItems: items,
        customerId: customer?.id,
        addressId: undefined,
        unitId: unit.id,
        tableId,
        deliveryFee: 0,
        deliveryDistanceKm: null,
        deliveryRangeId: null,
      });

      const order: OrderInfo = {
        ...draft,
        id: saved.id,
        total: saved.total,
        createdAt: saved.createdAt,
      };

      placeOrder(order);
      setSubmittedOrderId(order.id);

      if (customer) {
        saveSavedCustomerProfile({
          name: customer.name,
          phone: customer.phone,
          customer_id: customer.id,
        });
      }

      if (extra?.paymentStatus === "customer_reported_paid") {
        toast.success("Pedido enviado. Pagamento aguardando confirmação da Maximus.");
      } else {
        toast.success("Pedido enviado!");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o pedido.");
    } finally {
      setSubmitting(false);
    }
  }

  function copyPix(amount: number) {
    const code = `00020126360014BR.GOV.BCB.PIX0114maximus@pix.com.br5204000053039865406${amount
      .toFixed(2)
      .replace(".", "")}5802BR5907Maximus6009SAO PAULO62070503***6304ABCD`;
    if (!navigator.clipboard) {
      toast.error("Seu navegador não permite copiar o Pix automaticamente.");
      return;
    }
    navigator.clipboard
      .writeText(code)
      .then(() => toast.success("Código Pix copiado com o valor!"))
      .catch(() => toast.error("Não foi possível copiar o Pix."));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (submittedOrderId) {
    return (
      <div className="min-h-screen">
        <MesaCheckoutHeader unit={effectiveUnit} table={displayMesa} />
        <CheckoutShell title="Pedido enviado">
          <div className="space-y-4">
            <section className="rounded-2xl border border-primary/30 bg-primary/10 p-5 text-sm">
              <p className="font-extrabold text-primary">Seu pedido foi enviado para a Maximus.</p>
              <p className="mt-2 text-muted-foreground">
                Aguarde o atendimento da unidade. Pedido #{submittedOrderId.slice(0, 8)}.
              </p>
            </section>
            <Button
              className="w-full bg-gradient-primary font-bold"
              onClick={() =>
                navigate({
                  to: "/mesa",
                  search: {
                    ...(effectiveUnit ? { unit: effectiveUnit } : {}),
                    ...(effectiveTable ? { table: effectiveTable } : {}),
                  },
                })
              }
            >
              Voltar ao cardápio da mesa
            </Button>
          </div>
        </CheckoutShell>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <MesaCheckoutHeader unit={effectiveUnit} table={displayMesa} />

      {/* Order summary bar */}
      <div className="mx-auto max-w-lg px-4 pt-6">
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {count} {count === 1 ? "item" : "itens"} no pedido
          </span>
          <span className="font-bold text-primary">{formatPrice(subtotal)}</span>
        </div>
      </div>

      {/* ── STEP: CHOICE ── */}
      {step === "choice" && (
        <CheckoutShell
          title={`Pedido — Mesa ${displayMesa}`}
          subtitle={`Unidade: ${selectedUnitSlug}`}
        >
          <div className="space-y-4">
            <p className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm font-bold text-primary">
              Mesa {displayMesa} identificada pelo QR Code
            </p>
            <section className="rounded-2xl border border-border bg-card p-4 text-sm">
              <h2 className="font-extrabold">Resumo do pedido</h2>
              <ul className="mt-3 space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">
                      {item.quantity}x {item.product.name}
                      {item.note && (
                        <span className="block text-xs italic text-muted-foreground/70">
                          Obs: {item.note}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-bold">
                      {formatPrice(item.unitPrice * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-between border-t border-border pt-3 font-black text-primary">
                <span>Total</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
            </section>
            <BigOption
              label="Comer no local"
              description={`Serviremos o pedido na Mesa ${displayMesa}.`}
              onClick={() => {
                setConsumptionMode("dine_in");
                setStep("contact");
              }}
            />
            <BigOption
              label="Levar para casa"
              description="Prepararemos para retirada, sem rota ou dados extras."
              onClick={() => {
                setConsumptionMode("pickup");
                setStep("contact");
              }}
            />
          </div>
        </CheckoutShell>
      )}

      {/* ── STEP: CONTACT ── */}
      {step === "contact" && (
        <CheckoutShell
          title={consumptionMode === "dine_in" ? `Comer na Mesa ${displayMesa}` : "Levar para casa"}
          subtitle={
            consumptionMode === "dine_in"
              ? "Preencha seus dados para enviar o pedido para a mesa."
              : "Preencha seus dados para retirar e levar."
          }
          onBack={() => setStep("choice")}
        >
          <div className="space-y-4">
            {/* Mesa badge */}
            {displayMesa && (
              <p className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm font-bold text-primary">
                Mesa {displayMesa} identificada
              </p>
            )}

            {/* Item summary */}
            <section className="rounded-2xl border border-border bg-card p-4 text-sm">
              <h2 className="font-extrabold">Resumo do pedido</h2>
              <ul className="mt-3 space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">
                      {item.quantity}x {item.product.name}
                      {item.note && (
                        <span className="block italic text-xs text-muted-foreground/70">
                          Obs: {item.note}
                        </span>
                      )}
                    </span>
                    <span className="font-bold shrink-0">
                      {formatPrice(item.unitPrice * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-between border-t border-border pt-3 font-black text-primary">
                <span>Total</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
            </section>

            {/* Contact fields */}
            <Field label="Nome" value={name} onChange={setName} autoComplete="name" />
            <Field
              label="Telefone"
              value={phone}
              onChange={setPhone}
              type="tel"
              autoComplete="tel"
            />

            {!hasSavedProfile && (
              <ConsentCheckbox checked={privacyConsent} onCheckedChange={setPrivacyConsent} />
            )}

            <Button
              className="w-full bg-gradient-primary font-bold"
              size="lg"
              disabled={!name.trim() || !phone.trim() || (!hasSavedProfile && !privacyConsent)}
              onClick={() => setStep("payment")}
            >
              Continuar para pagamento
            </Button>
          </div>
        </CheckoutShell>
      )}

      {/* ── STEP: PAYMENT METHOD ── */}
      {step === "payment" && (
        <CheckoutShell
          title="Como você quer pagar?"
          subtitle={`Total: ${formatPrice(subtotal)}`}
          onBack={() => setStep("contact")}
        >
          <div className="space-y-3">
            <BigOption
              label="Pagar no local"
              description={
                consumptionMode === "dine_in"
                  ? "Dinheiro, cartão ou Pix no atendimento."
                  : "Dinheiro, cartão ou Pix na retirada."
              }
              onClick={() => setStep("payDelivery")}
            />
            <BigOption
              label="Pagar pelo app"
              description="Pague agora via Pix."
              onClick={() => setStep("payApp")}
            />
          </div>
        </CheckoutShell>
      )}

      {/* ── STEP: PAY AT TABLE — choose method ── */}
      {step === "payDelivery" && (
        <CheckoutShell title="Escolha a forma de pagamento" onBack={() => setStep("payment")}>
          <div className="space-y-3">
            <BigOption label="Dinheiro" onClick={() => setStep("payCash")} />
            <BigOption label="Cartão" onClick={() => setStep("payCard")} />
            <BigOption label="Pix" onClick={() => setStep("payPix")} />
          </div>
        </CheckoutShell>
      )}

      {/* ── STEP: PAY CASH ── */}
      {step === "payCash" && (
        <CheckoutShell title="Pagamento em dinheiro" onBack={() => setStep("payDelivery")}>
          <MesaReviewSummary
            customerName={name}
            customerPhone={phone}
            mesa={consumptionMode === "dine_in" ? displayMesa : ""}
            consumptionLabel={consumptionMode === "dine_in" ? "Comer no local" : "Levar para casa"}
            paymentLabel="Dinheiro"
            total={subtotal}
            items={items}
          />
          <label className="mt-4 flex items-center gap-2 text-sm">
            <Checkbox checked={needChange} onCheckedChange={(c) => setNeedChange(!!c)} />
            Preciso de troco
          </label>
          {needChange && (
            <div className="mt-4">
              <Field
                label="Troco para quanto?"
                value={changeFor}
                onChange={setChangeFor}
                type="number"
              />
            </div>
          )}
          <Button
            className="mt-6 w-full bg-gradient-primary font-bold"
            size="lg"
            disabled={submitting || (needChange && (!changeFor || Number(changeFor) <= subtotal))}
            onClick={() =>
              finalize(consumptionMode, {
                paymentStatus: "pending_on_delivery",
                paymentMethod: "dinheiro",
              })
            }
          >
            {submitting ? "Enviando..." : "Confirmar pedido"}
          </Button>
        </CheckoutShell>
      )}

      {/* ── STEP: PAY CARD ── */}
      {step === "payCard" && (
        <CheckoutShell
          title="Pagamento no cartão"
          subtitle="Selecione o tipo"
          onBack={() => setStep("payDelivery")}
        >
          <MesaReviewSummary
            customerName={name}
            customerPhone={phone}
            mesa={consumptionMode === "dine_in" ? displayMesa : ""}
            consumptionLabel={consumptionMode === "dine_in" ? "Comer no local" : "Levar para casa"}
            paymentLabel="Cartão"
            total={subtotal}
            items={items}
          />
          <div className="mt-4 space-y-3">
            <BigOption
              label="Crédito"
              onClick={() =>
                finalize(consumptionMode, {
                  paymentStatus: "pending_on_delivery",
                  paymentMethod: "cartao",
                })
              }
            />
            <BigOption
              label="Débito"
              onClick={() =>
                finalize(consumptionMode, {
                  paymentStatus: "pending_on_delivery",
                  paymentMethod: "cartao",
                })
              }
            />
          </div>
        </CheckoutShell>
      )}

      {/* ── STEP: PIX AT TABLE ── */}
      {step === "payPix" && (
        <CheckoutShell title="Pix no local" onBack={() => setStep("payDelivery")}>
          <MesaReviewSummary
            customerName={name}
            customerPhone={phone}
            mesa={consumptionMode === "dine_in" ? displayMesa : ""}
            consumptionLabel={consumptionMode === "dine_in" ? "Comer no local" : "Levar para casa"}
            paymentLabel="Pix no local"
            total={subtotal}
            items={items}
          />
          <p className="mt-4 text-muted-foreground">
            {consumptionMode === "dine_in"
              ? "O pagamento via Pix será feito no atendimento do local."
              : "O pagamento via Pix será feito na retirada."}
          </p>
          <Button
            className="mt-6 w-full bg-gradient-primary font-bold"
            size="lg"
            disabled={submitting}
            onClick={() =>
              finalize(consumptionMode, {
                paymentStatus: "pending_on_delivery",
                paymentMethod: "pix_entrega",
              })
            }
          >
            {submitting ? "Enviando..." : "Confirmar pedido"}
          </Button>
        </CheckoutShell>
      )}

      {/* ── STEP: PIX APP ── */}
      {step === "payApp" && (
        <CheckoutShell title="Pagar pelo app (Pix)" onBack={() => setStep("payment")}>
          <MesaReviewSummary
            customerName={name}
            customerPhone={phone}
            mesa={consumptionMode === "dine_in" ? displayMesa : ""}
            consumptionLabel={consumptionMode === "dine_in" ? "Comer no local" : "Levar para casa"}
            paymentLabel="Pix pelo app"
            total={subtotal}
            items={items}
          />
          <div className="mt-4 rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Chave Pix Maximus</p>
            <p className="font-bold">maximus@pix.com.br</p>
          </div>
          <Button
            variant="outline"
            className="mt-4 w-full"
            size="lg"
            onClick={() => copyPix(subtotal)}
          >
            <Copy className="mr-2 h-4 w-4" /> Copiar Pix com valor
          </Button>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Copie o código Pix, cole no seu banco e avise a Maximus após enviar o pagamento.
          </p>
          <Button
            className="mt-6 w-full bg-gradient-primary font-bold"
            size="lg"
            disabled={submitting}
            onClick={() =>
              finalize(consumptionMode, {
                paymentStatus: "customer_reported_paid",
                paymentMethod: "pix_app",
              })
            }
          >
            <Check className="mr-2 h-4 w-4" />
            {submitting ? "Enviando..." : "Já paguei — confirmar pedido"}
          </Button>
          <p className="mt-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
            Seu pedido será enviado com pagamento aguardando confirmação da Maximus.
          </p>
        </CheckoutShell>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MesaReviewSummary({
  customerName,
  customerPhone,
  mesa,
  consumptionLabel,
  paymentLabel,
  total,
  items,
}: {
  customerName: string;
  customerPhone: string;
  mesa: string;
  consumptionLabel: string;
  paymentLabel: string;
  total: number;
  items: Array<{
    id: string;
    product: { name: string };
    quantity: number;
    unitPrice: number;
    note?: string;
  }>;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 text-sm">
      <h3 className="font-extrabold">Confirmação do pedido</h3>
      <div className="mt-3 space-y-2">
        <SummaryRow label="Consumo" value={consumptionLabel} />
        {mesa && <SummaryRow label="Mesa" value={`Mesa ${mesa}`} />}
        <SummaryRow label="Cliente" value={customerName || "Não informado"} />
        {customerPhone && <SummaryRow label="Telefone" value={customerPhone} />}
        <div className="my-2 border-t border-border" />
        {items.map((item) => (
          <SummaryRow
            key={item.id}
            label={`${item.quantity}x ${item.product.name}`}
            value={formatPrice(item.unitPrice * item.quantity)}
          />
        ))}
        <div className="my-2 border-t border-border" />
        <SummaryRow label="Total" value={formatPrice(total)} strong />
        <SummaryRow label="Pagamento" value={paymentLabel} />
      </div>
    </section>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-black text-primary" : "font-bold"}>{value}</span>
    </div>
  );
}

function MesaCheckoutHeader({ unit, table }: { unit?: string; table?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Logo />
        <div className="text-right text-xs font-bold uppercase tracking-[0.12em] text-primary">
          {unit && <p>{unit}</p>}
          {table && <p>Mesa {table}</p>}
        </div>
      </div>
    </header>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ConsentCheckbox({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(Boolean(value))} />
      <span>
        Li e aceito os{" "}
        <a href="/termos" className="font-bold text-primary underline">
          Termos de uso
        </a>{" "}
        e a{" "}
        <a href="/privacidade" className="font-bold text-primary underline">
          Política de privacidade
        </a>
        .
      </span>
    </label>
  );
}
