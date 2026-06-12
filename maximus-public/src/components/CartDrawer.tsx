import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Minus, Pencil, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FoodArt } from "./FoodArt";
import { OptionGroupField } from "./ProductCard";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/store";
import { calculateUnitPrice, getSelectionErrors } from "@/lib/cart-customization";
import type { CartItem, SelectedOptions } from "@/lib/types";

export function CartDrawer({
  checkoutSearch,
}: {
  checkoutSearch?: { mesa?: string; unidade?: string };
}) {
  const { items, inc, dec, removeItem, subtotal, count } = useCart();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    function openCart() {
      setOpen(true);
    }

    window.addEventListener("maximus:open-cart", openCart);
    return () => window.removeEventListener("maximus:open-cart", openCart);
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="relative" aria-label="Abrir sacola">
          <ShoppingBag className="h-5 w-5" />
          <span className="ml-2 hidden sm:inline">Ver sacola</span>
          {count > 0 && (
            <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">
              {count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ver sacola</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <ShoppingBag className="h-10 w-10" />
            <p>Sua sacola está vazia.</p>
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto py-2">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                <div className="h-14 w-14 shrink-0 rounded-lg bg-gradient-hero p-1">
                  <FoodArt variant={item.product.svg} />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-tight">{item.product.name}</p>
                    <div className="flex items-center gap-2">
                      <EditCartItemDialog item={item} />
                      <button onClick={() => removeItem(item.id)} aria-label="Remover">
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Qtd: {item.quantity} • Unitário: {formatPrice(item.unitPrice)}
                  </p>
                  {item.customizations.length > 0 && (
                    <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                      {item.customizations.map((group) => (
                        <div key={group.groupId}>
                          <p className="font-bold text-foreground/80">{group.groupTitle}</p>
                          {group.options.map((option) => (
                            <p key={option.id}>
                              ✓ {option.label}
                              {!!option.price && (
                                <span className="text-primary"> +{formatPrice(option.price)}</span>
                              )}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  {item.note && (
                    <div className="mt-1.5 text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground/80">Obs:</p>
                      <p className="italic">“{item.note}”</p>
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => dec(item.id)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => inc(item.id)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="font-bold text-primary">
                      {formatPrice(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <SheetFooter className="border-t border-border pt-4">
          <div className="w-full space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-lg font-extrabold">
              <span>Total</span>
              <span className="text-primary">{formatPrice(subtotal)}</span>
            </div>
            {items.length === 0 ? (
              <Button disabled className="w-full bg-gradient-primary font-bold" size="lg">
                Finalizar pedido
              </Button>
            ) : (
              <Button asChild className="w-full bg-gradient-primary font-bold" size="lg">
                <Link to="/checkout" search={checkoutSearch ?? {}}>
                  Finalizar pedido
                </Link>
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
      {count > 0 && pathname === "/menu" && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:hidden">
          <Button
            type="button"
            size="lg"
            onClick={() => setOpen(true)}
            className="pointer-events-auto mx-auto flex w-full max-w-md bg-[#FF3D00] font-extrabold uppercase tracking-[0.04em] text-black shadow-[0_8px_24px_rgba(255,61,0,0.22)] hover:bg-[#FF3D00]/90"
          >
            VER SACOLA • {count} {count === 1 ? "ITEM" : "ITENS"} • {formatPrice(subtotal)}
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function EditCartItemDialog({ item }: { item: CartItem }) {
  const { updateItem } = useCart();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(item.note ?? "");
  const [selections, setSelections] = useState<SelectedOptions>(item.selections);
  const total = useMemo(
    () => calculateUnitPrice(item.product, selections),
    [item.product, selections],
  );
  const errors = useMemo(
    () => getSelectionErrors(item.product, selections),
    [item.product, selections],
  );

  function openEditor() {
    setSelections(item.selections);
    setNote(item.note ?? "");
    setOpen(true);
  }

  function save() {
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    updateItem(item.id, selections, note);
    toast.success(`${item.product.name} atualizado`);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button onClick={openEditor} aria-label="Editar item">
        <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
      </button>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar {item.product.name}</DialogTitle>
          <DialogDescription>
            Ajuste acompanhamentos, adicionais e observações antes de finalizar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {(item.product.optionGroups ?? []).map((group) => (
            <OptionGroupField
              key={group.id}
              group={group}
              selections={selections}
              onChange={setSelections}
            />
          ))}

          <div className="space-y-2 rounded-xl border border-border bg-secondary/50 p-4">
            <label className="text-sm font-bold">Observações</label>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex: sem molho, carne bem passada, embalar separado..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} className="w-full bg-gradient-primary font-bold" size="lg">
            Salvar alterações • {formatPrice(total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
