import type {
  CartCustomization,
  Product,
  ProductOption,
  ProductOptionGroup,
  SelectedOptions,
} from "./types";

export function getDefaultSelections(product: Product): SelectedOptions {
  const selections: SelectedOptions = {};

  for (const group of product.optionGroups ?? []) {
    selections[group.id] = [];
  }

  return selections;
}

export function getSelectedOptions(group: ProductOptionGroup, selections: SelectedOptions) {
  const selectedIds = new Set(selections[group.id] ?? []);
  return group.options.filter((option) => selectedIds.has(option.id));
}

export function getCustomizations(
  product: Product,
  selections: SelectedOptions,
): CartCustomization[] {
  return (product.optionGroups ?? [])
    .map((group) => ({
      groupId: group.id,
      groupTitle: group.title,
      type: group.type,
      options: getSelectedOptions(group, selections),
    }))
    .filter((group) => group.options.length > 0);
}

export function calculateUnitPrice(product: Product, selections: SelectedOptions): number {
  return (product.optionGroups ?? []).reduce((total, group) => {
    return (
      total +
      getSelectedOptions(group, selections).reduce((sum, option) => sum + (option.price ?? 0), 0)
    );
  }, product.price);
}

export function getSelectionErrors(product: Product, selections: SelectedOptions): string[] {
  return (product.optionGroups ?? []).flatMap((group) => {
    const count = selections[group.id]?.length ?? 0;
    const min = group.required || group.decisionRequired ? Math.max(group.min ?? 1, 1) : (group.min ?? 0);

    if (count < min) {
      return [`Escolha uma opção em ${group.title} para continuar.`];
    }
    if (group.max && count > group.max)
      return [`Selecione no máximo ${group.max} em ${group.title}.`];
    return [];
  });
}

export function buildCartItemId(
  productId: string,
  selections: SelectedOptions,
  note?: string,
): string {
  const normalizedSelections = Object.keys(selections)
    .sort()
    .map((groupId) => [groupId, [...(selections[groupId] ?? [])].sort()]);

  return JSON.stringify({
    productId,
    selections: normalizedSelections,
    note: note?.trim() ?? "",
  });
}

export function formatOptionPrice(option: ProductOption): string {
  if (!option.price) return option.label;
  return `${option.label} (+${option.price.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })})`;
}
