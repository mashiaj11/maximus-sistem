import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
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
  const { addItem, inc, items } = useCart();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [selections, setSelections] = useState<SelectedOptions>(() =>
    getDefaultSelections(product),
  );
  const total = useMemo(() => calculateUnitPrice(product, selections), [product, selections]);
  const errors = useMemo(() => getSelectionErrors(product, selections), [product, selections]);

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
                  toast.success(`${product.name} adicionado ao pedido`);
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
    toast.success(`${product.name} adicionado ao pedido`);
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
            className="h-full w-full p-4 transition-transform duration-300 group-hover:scale-110"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-bold leading-tight tracking-tight">{product.name}</h3>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">
          {product.description}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-lg font-extrabold text-primary">{formatPrice(product.price)}</span>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={resetForm}>
                <Plus className="mr-1 h-4 w-4" /> Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{product.name}</DialogTitle>
                <DialogDescription>
                  {product.description} • Base {formatPrice(product.price)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
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

              <DialogFooter>
                <Button
                  onClick={confirm}
                  className="w-full bg-gradient-primary font-bold"
                  size="lg"
                >
                  Adicionar ao pedido • {formatPrice(total)}
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
  const min = group.required ? (group.min ?? 1) : group.min;

  function setSingle(optionId: string) {
    onChange({ ...selections, [group.id]: [optionId] });
  }

  function toggleMultiple(optionId: string, checked: boolean) {
    if (checked && group.max && selected.length >= group.max) {
      return;
    }
    const next = checked ? [...selected, optionId] : selected.filter((id) => id !== optionId);
    onChange({ ...selections, [group.id]: next });
  }

  return (
    <fieldset className="space-y-3 rounded-xl border border-border bg-secondary/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <legend className="text-sm font-bold">{group.title}</legend>
          {min ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Escolha {min}
              {group.max ? ` até ${group.max}` : ""} opção.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">Opcional</p>
          )}
        </div>
        {group.required && (
          <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-primary">
            Obrigatório
          </span>
        )}
      </div>

      <div className="space-y-2">
        {group.options.map((option) => {
          const checked = selected.includes(option.id);
          const id = `${group.id}-${option.id}`;
          const disabled =
            group.type === "multiple" && !checked && !!group.max && selected.length >= group.max;

          return (
            <label
              key={option.id}
              htmlFor={id}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3 text-sm transition-colors hover:border-primary/70"
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
