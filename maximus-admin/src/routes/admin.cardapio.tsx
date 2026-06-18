import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { PageHeader } from "@/admin/components/AdminLayout";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatBRL, useAdmin } from "@/admin/store";
import type { Category, Product, ProductDraft, ProductOptionGroup } from "@/admin/data/types";

export const Route = createFileRoute("/admin/cardapio")({
  component: CardapioPage,
});

function emptyProduct(categoryId: string): ProductDraft {
  return {
    name: "",
    categoryId,
    price: 0,
    active: true,
    description: "",
    imageUrl: undefined,
    optionGroups: [],
    availableForDelivery: true,
    availableForPickup: true,
    availableForDineIn: true,
    dineInOnly: false,
  };
}

async function compressImage(file: File): Promise<Blob> {
  const supportedImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!supportedImageTypes.includes(file.type)) {
    throw new Error("Formato inválido. Use JPG, JPEG, PNG ou WEBP.");
  }

  if (file.size > 50 * 1024 * 1024) {
    throw new Error("O arquivo deve ter no máximo 50 MB.");
  }

  const bitmap = await createImageBitmap(file);
  const width = Math.min(bitmap.width, 1200);
  const height = Math.round((bitmap.height * width) / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas não disponível para compressão.");
  }

  context.drawImage(bitmap, 0, 0, width, height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Falha ao comprimir a imagem."));
        }
      },
      "image/webp",
      0.8,
    );
  });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Falha ao ler imagem comprimida."));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function generateBrowserSafeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function uploadProductImage(blob: Blob): Promise<string> {
  const bucketName = "products";

  if (!isSupabaseConfigured) {
    console.info("[Maximus upload] Supabase não configurado; salvando imagem como base64 local.");
    return blobToDataUrl(blob);
  }

  const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2);

  const fileName = `products/${uniqueId}.webp`;

  const supabase = getSupabaseClient();
  console.info("[Maximus upload] Iniciando upload", {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    bucketName,
    fileName,
    blobType: blob.type,
    blobSize: blob.size,
  });

  const { data, error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(fileName, blob, { contentType: "image/webp", upsert: true });

  console.info("[Maximus upload] Retorno completo do upload", {
    data,
    error: uploadError,
    errorMessage: uploadError?.message,
    errorStatusCode:
      uploadError && "statusCode" in uploadError ? uploadError.statusCode : undefined,
  });

  if (uploadError || !data) {
    throw new Error(uploadError?.message ?? "Falha ao enviar imagem para o Storage.");
  }

  const publicUrlData = supabase.storage.from(bucketName).getPublicUrl(data.path);
  console.info("[Maximus upload] Retorno URL pública", {
    data: publicUrlData,
  });

  if (!publicUrlData?.data?.publicUrl) {
    throw new Error("Falha ao obter URL pública da imagem.");
  }

  return publicUrlData.data.publicUrl;
}

function CardapioPage() {
  const {
    categories,
    allProducts,
    selectedUnit,
    selectedUnitId,
    addCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryForCurrentUnit,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleProduct,
    toggleProductForCurrentUnit,
  } = useAdmin();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [creatingProduct, setCreatingProduct] = useState<ProductDraft | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleteCategoryError, setDeleteCategoryError] = useState<string | null>(null);

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  const unitHasProduct = (product: Product) =>
    Boolean(selectedUnitId && (!product.unitIds || product.unitIds.includes(selectedUnitId)));
  const productActiveInUnit = (product: Product) =>
    selectedUnitId ? (product.activeByUnit?.[selectedUnitId] ?? unitHasProduct(product)) : false;

  function handleDeleteCategory(category: Category) {
    const categoryProducts = allProducts.filter((p) => p.categoryId === category.id);
    if (categoryProducts.length > 0) {
      setDeleteCategoryError(
        `Não é possível excluir esta categoria.\nExistem ${categoryProducts.length} produto(s) vinculado(s) a ela.\nRemova ou mova os produtos primeiro.`,
      );
      return;
    }
    setDeletingCategory(category);
  }

  async function confirmDeleteCategory(category: Category) {
    try {
      await deleteCategory(category.id);
      setDeletingCategory(null);
    } catch (error) {
      setDeleteCategoryError(
        error instanceof Error ? error.message : "Não foi possível excluir a categoria.",
      );
    }
  }

  return (
    <div>
      <PageHeader
        title="Cardápio"
        subtitle={`Categorias, produtos e acompanhamentos · ${selectedUnit?.name ?? "Unidade"}`}
        action={
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addCategory(newCategoryName);
              setNewCategoryName("");
            }}
          >
            <input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="Nova categoria"
              className="h-10 w-48 rounded-lg border border-input bg-background px-3 text-sm"
            />
            <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-extrabold text-primary-foreground">
              <Plus className="h-4 w-4" />
              Criar categoria
            </button>
          </form>
        }
      />

      <div className="space-y-4">
        {sortedCategories.map((category) => {
          const active = selectedUnitId ? category.activeByUnit[selectedUnitId] : false;
          const categoryProducts = allProducts
            .filter((product) => product.categoryId === category.id)
            .sort((a, b) => a.name.localeCompare(b.name));
          const availableCount = categoryProducts.filter(unitHasProduct).length;
          const isEditingCategory = editingCategory?.id === category.id;

          return (
            <section
              key={category.id}
              className={`rounded-xl border border-border bg-card p-5 ${active ? "" : "opacity-75"}`}
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                {isEditingCategory ? (
                  <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_120px_auto]">
                    <input
                      aria-label="Nome da categoria"
                      value={editingCategory.name}
                      onChange={(event) =>
                        setEditingCategory({ ...editingCategory, name: event.target.value })
                      }
                      className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                    />
                    <input
                      aria-label="Ordem da categoria"
                      type="number"
                      value={editingCategory.order}
                      onChange={(event) =>
                        setEditingCategory({
                          ...editingCategory,
                          order: Number(event.target.value),
                        })
                      }
                      className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          updateCategory(category.id, {
                            name: editingCategory.name,
                            order: editingCategory.order,
                          });
                          setEditingCategory(null);
                        }}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground"
                      >
                        <Check className="h-4 w-4" />
                        Salvar
                      </button>
                      <button
                        onClick={() => setEditingCategory(null)}
                        aria-label="Cancelar edição de categoria"
                        className="inline-flex h-10 items-center rounded-lg bg-secondary px-3"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black">{category.name}</h2>
                        <span className="rounded-md bg-secondary px-2 py-1 text-xs font-bold text-muted-foreground">
                          #{category.order}
                        </span>
                        {!active && (
                          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                            Indisponível nesta unidade
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {availableCount} de {categoryProducts.length} produtos disponíveis em{" "}
                        {selectedUnit?.name ?? "unidade"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => toggleCategoryForCurrentUnit(category.id)}
                        className={`rounded-lg px-3 py-2 text-xs font-bold ${
                          active
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {active ? "Categoria ativa" : "Categoria inativa"}
                      </button>
                      <button
                        onClick={() => setEditingCategory(category)}
                        className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-xs font-bold hover:bg-accent"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar categoria
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category)}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-500/15 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-500/25"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir categoria
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                {categoryProducts.map((product) => {
                  const available = unitHasProduct(product);
                  const activeInUnit = productActiveInUnit(product);
                  return (
                    <div
                      key={product.id}
                      className={`grid gap-3 rounded-lg border border-border bg-background p-3 md:grid-cols-[84px_1fr_auto] md:items-center ${
                        available ? "" : "opacity-65"
                      }`}
                    >
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary text-center text-xs text-muted-foreground">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="px-2 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                            Sem foto
                          </span>
                        )}
                      </div>

                      <div className="grid gap-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-extrabold">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {product.description || "Sem descrição"}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-primary">
                            {formatBRL(product.price)}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          <span
                            className={`rounded-md px-3 py-2 font-bold ${
                              available
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {available ? "Disponível" : "Indisponível"}
                          </span>
                          <span
                            className={`rounded-md px-3 py-2 font-bold ${
                              activeInUnit
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {activeInUnit ? "Ativo" : "Inativo"}
                          </span>
                          {product.dineInOnly ? (
                            <span className="rounded-md bg-primary/15 px-3 py-2 font-bold text-primary">
                              Somente local
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          onClick={() =>
                            setEditingProduct({
                              ...product,
                              active: productActiveInUnit(product),
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-2 text-xs font-bold hover:bg-accent"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          onClick={() => setDeletingProduct(product)}
                          className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-500/25"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button
                  onClick={() => setCreatingProduct(emptyProduct(category.id))}
                  className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-background px-4 py-3 text-sm font-extrabold text-primary hover:border-primary/50"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar produto em {category.name}
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {editingProduct && (
        <ProductEditor
          title="Editar produto"
          product={editingProduct}
          categories={categories}
          onCancel={() => setEditingProduct(null)}
          onSave={(product) => {
            updateProduct(editingProduct.id, product);
            setEditingProduct(null);
          }}
        />
      )}

      {creatingProduct && (
        <ProductEditor
          title="Criar produto"
          product={creatingProduct}
          categories={categories}
          onCancel={() => setCreatingProduct(null)}
          onSave={(product) => {
            addProduct(product);
            setCreatingProduct(null);
          }}
        />
      )}

      {deleteCategoryError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="admin-root w-full max-w-md rounded-xl border border-border bg-card p-6 font-sora">
            <h2 className="text-lg font-semibold mb-2 text-red-500">Não é possível excluir</h2>
            <p className="text-sm text-muted-foreground mb-6 whitespace-pre-line">
              {deleteCategoryError}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setDeleteCategoryError(null)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium hover:opacity-90"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="admin-root w-full max-w-md rounded-xl border border-border bg-card p-6 font-sora">
            <h2 className="text-lg font-semibold mb-2">Excluir categoria?</h2>
            <p className="text-sm text-muted-foreground mb-2">
              Você está prestes a remover <strong>{deletingCategory.name}</strong>.
            </p>
            <p className="text-xs text-red-500 font-medium mb-6">
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeletingCategory(null)}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                onClick={() => confirmDeleteCategory(deletingCategory)}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                Excluir categoria
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="admin-root w-full max-w-md rounded-xl border border-border bg-card p-6 font-sora">
            <h2 className="text-lg font-semibold mb-2">Excluir produto?</h2>
            <p className="text-sm text-muted-foreground mb-2">
              Você está prestes a remover <strong>{deletingProduct.name}</strong> do cardápio.
            </p>
            <p className="text-xs text-red-500 font-medium mb-6">
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeletingProduct(null)}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  deleteProduct(deletingProduct.id);
                  setDeletingProduct(null);
                }}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                Excluir produto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductEditor({
  title,
  product,
  categories,
  onCancel,
  onSave,
}: {
  title: string;
  product: Product | ProductDraft;
  categories: Category[];
  onCancel: () => void;
  onSave: (product: ProductDraft) => void;
}) {
  const [draft, setDraft] = useState<ProductDraft>({
    name: product.name,
    categoryId: product.categoryId,
    price: product.price,
    active: product.active,
    description: product.description ?? "",
    imageUrl: (product as Product).imageUrl ?? undefined,
    optionGroups: product.optionGroups ?? [],
    availableForDelivery: product.availableForDelivery ?? true,
    availableForPickup: product.availableForPickup ?? true,
    availableForDineIn: product.availableForDineIn ?? true,
    dineInOnly: product.dineInOnly ?? false,
  });
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleImageFile(file: File | null) {
    setImageError(null);
    if (!file) return;

    try {
      setImageUploading(true);
      const compressedBlob = await compressImage(file);
      const finalUrl = await uploadProductImage(compressedBlob);
      setDraft((prev) => ({ ...prev, imageUrl: finalUrl }));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : String(error));
    } finally {
      setImageUploading(false);
    }
  }

  function clearImage() {
    setImageError(null);
    setDraft((prev) => ({ ...prev, imageUrl: undefined }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function updateGroup(groupId: string, patch: Partial<ProductOptionGroup>) {
    setDraft((prev) => ({
      ...prev,
      optionGroups: (prev.optionGroups ?? []).map((group) =>
        group.id === groupId ? { ...group, ...patch } : group,
      ),
    }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="admin-root max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-card p-6 font-sora"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="product-name" className="mb-1 block text-sm text-muted-foreground">
              Nome
            </label>
            <input
              id="product-name"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="product-price" className="mb-1 block text-sm text-muted-foreground">
              Preço
            </label>
            <input
              id="product-price"
              type="number"
              min="0"
              step="0.1"
              value={draft.price}
              onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="product-category" className="mb-1 block text-sm text-muted-foreground">
              Categoria
            </label>
            <select
              id="product-category"
              value={draft.categoryId}
              onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="product-description"
              className="mb-1 block text-sm text-muted-foreground"
            >
              Descrição
            </label>
            <textarea
              id="product-description"
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2 rounded-xl border border-border bg-background/60 p-4">
            <h3 className="text-sm font-extrabold">Disponibilidade por consumo</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Produtos “somente local” aparecem apenas no QR de mesa/comer no local.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={draft.availableForDelivery !== false && !draft.dineInOnly}
                  disabled={draft.dineInOnly}
                  onChange={(event) =>
                    setDraft({ ...draft, availableForDelivery: event.target.checked })
                  }
                  className="accent-primary"
                />
                Delivery
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={draft.availableForPickup !== false && !draft.dineInOnly}
                  disabled={draft.dineInOnly}
                  onChange={(event) =>
                    setDraft({ ...draft, availableForPickup: event.target.checked })
                  }
                  className="accent-primary"
                />
                Retirada
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={draft.availableForDineIn !== false || draft.dineInOnly}
                  onChange={(event) =>
                    setDraft({ ...draft, availableForDineIn: event.target.checked })
                  }
                  className="accent-primary"
                />
                Consumo local
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary">
                <input
                  type="checkbox"
                  checked={draft.dineInOnly === true}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      dineInOnly: event.target.checked,
                      availableForDelivery: event.target.checked
                        ? false
                        : draft.availableForDelivery,
                      availableForPickup: event.target.checked ? false : draft.availableForPickup,
                      availableForDineIn: event.target.checked ? true : draft.availableForDineIn,
                    })
                  }
                  className="accent-primary"
                />
                Somente local
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-secondary/50 p-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
            <div>
              <h3 className="text-sm font-extrabold">Foto do produto</h3>
              <p className="text-xs text-muted-foreground">
                Envie JPG, JPEG, PNG ou WEBP de até 50 MB.
              </p>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                >
                  Trocar foto
                </button>
                <button
                  type="button"
                  onClick={clearImage}
                  className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold hover:bg-accent"
                >
                  Remover foto
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(event) => handleImageFile(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[120px_1fr] items-center">
            <div className="h-28 w-full overflow-hidden rounded-xl border border-border bg-background text-center text-xs text-muted-foreground">
              {draft.imageUrl ? (
                <img
                  src={draft.imageUrl}
                  alt={draft.name || "Foto do produto"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-2">
                  Sem foto selecionada
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                A imagem enviada será exibida no card do produto no Admin e, quando disponível, no
                site público.
              </p>
              {imageUploading ? (
                <p className="mt-2 text-sm text-primary">Upload em andamento...</p>
              ) : null}
              {imageError ? <p className="mt-2 text-sm text-destructive">{imageError}</p> : null}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3 rounded-lg border border-border bg-background/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold">Grupos de opções</h3>
              <p className="text-xs text-muted-foreground">
                Acompanhamentos, adicionais e escolhas do produto.
              </p>
            </div>
            <button
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  optionGroups: [
                    ...(prev.optionGroups ?? []),
                    {
                      id: `grupo-${Date.now()}`,
                      name: "Acompanhamentos",
                      type: "multiple",
                      required: true,
                      minChoices: 1,
                      maxChoices: 3,
                      choices: [],
                    },
                  ],
                }))
              }
              className="rounded-md bg-secondary px-3 py-1.5 text-xs font-bold hover:bg-accent"
            >
              Novo grupo
            </button>
          </div>

          {(draft.optionGroups ?? []).map((group) => (
            <div key={group.id} className="space-y-3 rounded-lg border border-border bg-card p-3">
              <div className="flex gap-2">
                <input
                  value={group.name}
                  onChange={(event) => updateGroup(group.id, { name: event.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Nome do grupo"
                />
                <button
                  onClick={() =>
                    setDraft({
                      ...draft,
                      optionGroups: (draft.optionGroups ?? []).filter(
                        (item) => item.id !== group.id,
                      ),
                    })
                  }
                  className="rounded-lg bg-secondary px-3 text-xs font-bold hover:bg-accent"
                >
                  Remover
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <select
                  aria-label="Tipo de grupo"
                  value={group.type}
                  onChange={(event) =>
                    updateGroup(group.id, {
                      type: event.target.value as ProductOptionGroup["type"],
                    })
                  }
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="multiple">Múltipla</option>
                  <option value="single">Única</option>
                </select>
                <label className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={group.required}
                    onChange={(event) => updateGroup(group.id, { required: event.target.checked })}
                    className="accent-primary"
                  />
                  Obrigatório
                </label>
                <input
                  type="number"
                  min="0"
                  value={group.minChoices}
                  onChange={(event) =>
                    updateGroup(group.id, { minChoices: Number(event.target.value) })
                  }
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Mín."
                />
                <input
                  type="number"
                  min="1"
                  value={group.maxChoices}
                  onChange={(event) =>
                    updateGroup(group.id, { maxChoices: Number(event.target.value) })
                  }
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Máx."
                />
              </div>

              <div className="space-y-2">
                {group.choices.map((choice) => (
                  <div key={choice.id} className="grid gap-2 sm:grid-cols-[1fr_110px_90px]">
                    <input
                      value={choice.name}
                      onChange={(event) =>
                        updateGroup(group.id, {
                          choices: group.choices.map((item) =>
                            item.id === choice.id ? { ...item, name: event.target.value } : item,
                          ),
                        })
                      }
                      className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Nome da opção"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={choice.priceDelta}
                      onChange={(event) =>
                        updateGroup(group.id, {
                          choices: group.choices.map((item) =>
                            item.id === choice.id
                              ? { ...item, priceDelta: Number(event.target.value) }
                              : item,
                          ),
                        })
                      }
                      className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Acréscimo"
                    />
                    <button
                      onClick={() =>
                        updateGroup(group.id, {
                          choices: group.choices.map((item) =>
                            item.id === choice.id ? { ...item, active: !item.active } : item,
                          ),
                        })
                      }
                      className={`rounded-lg px-3 py-2 text-xs font-bold ${
                        choice.active
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {choice.active ? "Ativa" : "Inativa"}
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    updateGroup(group.id, {
                      choices: [
                        ...group.choices,
                        {
                          id: `opcao-${Date.now()}`,
                          name: "Nova opção",
                          priceDelta: 0,
                          active: true,
                        },
                      ],
                    })
                  }
                  className="rounded-md bg-secondary px-3 py-1.5 text-xs font-bold hover:bg-accent"
                >
                  Adicionar opção
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={() =>
              onSave({
                ...draft,
                availableForDelivery: draft.dineInOnly
                  ? false
                  : draft.availableForDelivery !== false,
                availableForPickup: draft.dineInOnly ? false : draft.availableForPickup !== false,
                availableForDineIn: draft.dineInOnly ? true : draft.availableForDineIn !== false,
              })
            }
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
