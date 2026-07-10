import { useMemo, useState } from "react";
import { ArrowLeft, Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FoodArt } from "./FoodArt";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/store";
import {
  buildCartItemId,
  calculateUnitPrice,
  formatOptionPrice,
  getDefaultSelections,
  getSelectionErrors,
} from "@/lib/cart-customization";
import type { Product, ProductOptionGroup, SelectedOptions } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const { addItem, dec, inc, items } = useCart();
  const [open, setOpen] = useState(false);
  const [addedOpen, setAddedOpen] = useState(false);
  const [note, setNote] = useState("");
  const [selections, setSelections] = useState<SelectedOptions>(() =>
    getDefaultSelections(product),
  );
  const [addedItemId, setAddedItemId] = useState<string | null>(null);
  const total = useMemo(() => calculateUnitPrice(product, selections), [product, selections]);
  const errors = useMemo(() => getSelectionErrors(product, selections), [product, selections]);
  const addedItem = items.find((item) => item.id === addedItemId);

  function resetForm() {
    setSelections(getDefaultSelections(product));
    setNote("");
  }

  function confirm() {
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    const trimmedNote = note.trim() || undefined;
    const cartItemId = buildCartItemId(product.id, selections, trimmedNote);
    const existing = items.find((item) => item.id === cartItemId);

    if (existing) {
      toast.custom(
        (toastId) => (
          <div className="w-[min(92vw,380px)] rounded-xl border border-border bg-card p-4 shadow-xl">
            <p className="font-bold">Este item já está no seu pedido.</p>
            <p className="mt-1 text-sm text-muted-foreground">Deseja adicionar mais uma unidade?</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                size="sm"
                onClick={() => {
                  inc(existing.id);
                  toast.dismiss(toastId);
                  setAddedItemId(existing.id);
                  setAddedOpen(true);
                  resetForm();
                  setOpen(false);
                }}
              >
                Adicionar mais 1
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  toast.dismiss(toastId);
                  setOpen(false);
                  window.dispatchEvent(new CustomEvent("maximus:open-cart"));
                }}
              >
                Ver sacola
              </Button>
            </div>
          </div>
        ),
        { duration: 8000 },
      );
      return;
    }

    addItem(product, selections, note);
    setAddedItemId(cartItemId);
    setAddedOpen(true);
    resetForm();
    setOpen(false);
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/70">
      <div className="aspect-square w-full overflow-hidden border-b border-border bg-secondary">
        {product.imageUrl || product.image_url ? (
          <img
            src={product.imageUrl ?? product.image_url}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <FoodArt
            variant={product.svg}
            className="h-full w-full p-2 transition-transform duration-300 group-hover:scale-110 sm:p-4"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col p-2 sm:p-4">
        <h3 className="line-clamp-2 min-h-8 text-xs font-bold leading-4 tracking-tight sm:min-h-0 sm:text-base sm:leading-tight">
          {product.name}
        </h3>
        {product.description && (
          <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-muted-foreground sm:flex-1 sm:text-sm">
            {product.description}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-1.5 sm:mt-3 sm:gap-2">
          <span className="truncate text-xs font-extrabold text-primary sm:text-lg">
            {formatPrice(product.price)}
          </span>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                onClick={resetForm}
                className="h-7 min-w-7 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-sm"
                aria-label={`Adicionar ${product.name}`}
              >
                <Plus className="h-3.5 w-3.5 sm:mr-1 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Adicionar</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92svh] overflow-y-auto p-0 sm:max-w-2xl">
              <DialogHeader className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3 text-left">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <ArrowLeft className="h-4 w-4" /> Detalhes do produto
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Escolha adicionais e observações do produto.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 px-4 pb-2">
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="aspect-[16/10] bg-secondary">
                    {product.imageUrl || product.image_url ? (
                      <img
                        src={product.imageUrl ?? product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FoodArt variant={product.svg} className="h-full w-full p-6" />
                    )}
                  </div>
                  <div className="p-4">
                    <h2 className="text-xl font-black">{product.name}</h2>
                    <p className="mt-1 text-lg font-extrabold text-primary">
                      {formatPrice(product.price)}
                    </p>
                    {product.description && (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {product.description}
                      </p>
                    )}
                  </div>
                </div>
                {(product.optionGroups ?? []).map((group) => (
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
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ex: sem molho, carne bem passada, embalar separado..."
                  />
                </div>
              </div>

              <DialogFooter className="sticky bottom-0 border-t border-border bg-background p-4">
                <div className="w-full space-y-2">
                  {errors[0] && (
                    <p className="text-center text-xs font-semibold text-destructive">
                      {errors[0]}
                    </p>
                  )}
                  <Button
                    onClick={confirm}
                    className="w-full bg-gradient-primary font-bold"
                    size="lg"
                    disabled={errors.length > 0}
                  >
                    Avançar • {formatPrice(total)}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={addedOpen} onOpenChange={setAddedOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{product.name} adicionado ao carrinho!</DialogTitle>
                <DialogDescription>
                  Revise a quantidade ou avance para finalizar o pedido.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="font-black">{product.name}</p>
                {addedItem?.note && (
                  <p className="mt-2 text-sm text-muted-foreground">Obs.: {addedItem.note}</p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-bold text-muted-foreground">Quantidade</span>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      disabled={!addedItem}
                      onClick={() => addedItem && inc(addedItem.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <span className="w-6 text-center font-black">{addedItem?.quantity ?? 1}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      disabled={!addedItem}
                      onClick={() => addedItem && dec(addedItem.id)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAddedOpen(false);
                    setOpen(false);
                  }}
                >
                  Continuar comprando
                </Button>
                <Button
                  type="button"
                  className="bg-gradient-primary font-bold"
                  onClick={() => {
                    setAddedOpen(false);
                    window.dispatchEvent(new CustomEvent("maximus:open-cart"));
                  }}
                >
                  <ShoppingBag className="mr-2 h-4 w-4" /> Avançar para o carrinho
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

export function OptionGroupField({
  group,
  selections,
  onChange,
}: {
  group: ProductOptionGroup;
  selections: SelectedOptions;
  onChange: (selections: SelectedOptions) => void;
}) {
  const selected = selections[group.id] ?? [];
  const min =
    group.required || group.decisionRequired ? Math.max(group.min ?? 1, 1) : (group.min ?? 0);
  const max = group.max ?? (group.type === "single" ? 1 : undefined);
  const ruleText =
    min > 0 && max === 1
      ? "Escolha 1 opção"
      : max
        ? `Escolha até ${max} itens`
        : "Escolha quantos quiser";

  function setSingle(optionId: string) {
    onChange({ ...selections, [group.id]: [optionId] });
  }

  function toggleMultiple(optionId: string, checked: boolean) {
    if (checked && max && selected.length >= max) {
      return;
    }
    const next = checked ? [...selected, optionId] : selected.filter((id) => id !== optionId);
    onChange({ ...selections, [group.id]: next });
  }

  return (
    <fieldset className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-3 bg-secondary/70 p-4">
        <div>
          <legend className="text-sm font-bold">{group.title}</legend>
          <p className="mt-0.5 text-xs text-muted-foreground">{min ? ruleText : "Opcional"}</p>
        </div>
        <div className="flex items-center gap-2">
          {(group.required || group.decisionRequired) && <Badge>Obrigatório</Badge>}
          <span className="rounded-full bg-background px-2 py-1 text-xs font-black">
            {selected.length}/{max ?? selected.length}
          </span>
        </div>
      </div>

      <div className="divide-y divide-border">
        {group.options.map((option) => {
          const checked = selected.includes(option.id);
          const id = `${group.id}-${option.id}`;
          const disabled =
            group.type === "multiple" && !checked && !!group.max && selected.length >= group.max;

          return (
            <label
              key={option.id}
              htmlFor={id}
              className="flex cursor-pointer items-center justify-between gap-3 bg-card px-4 py-3 text-sm transition-colors hover:bg-secondary/50"
            >
              <span className="flex items-center gap-3">
                <input
                  id={id}
                  type={group.type === "single" ? "radio" : "checkbox"}
                  name={group.id}
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) =>
                    group.type === "single"
                      ? setSingle(option.id)
                      : toggleMultiple(option.id, event.target.checked)
                  }
                  className="h-4 w-4 accent-primary"
                />
                {option.label}
              </span>
              {!!option.price && (
                <span className="font-bold text-primary">
                  {formatOptionPrice(option).replace(option.label, "")}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
