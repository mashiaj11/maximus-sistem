import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartItem, OrderInfo, Product } from "./types";
import type { SelectedOptions } from "./types";
import { buildCartItemId, calculateUnitPrice, getCustomizations } from "./cart-customization";

/* ----------------------------- Cart store ----------------------------- */

export interface OrderContextData {
  unit?: string;
  table?: string;
  mode?: "dine_in" | "delivery" | "pickup";
  source?: "qr" | "manual";
}

interface CartContextValue {
  items: CartItem[];
  orderContext: OrderContextData | null;
  setOrderContext: (context: OrderContextData) => void;
  clearOrderContext: () => void;
  getEffectiveOrderContext: (context?: OrderContextData | null) => OrderContextData | null;
  addItem: (product: Product, selections: SelectedOptions, note?: string) => void;
  updateItem: (itemId: string, selections: SelectedOptions, note?: string) => void;
  removeItem: (itemId: string) => void;
  inc: (itemId: string) => void;
  dec: (itemId: string) => void;
  updateNote: (itemId: string, note: string) => void;
  clearItems: () => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

const ORDER_CONTEXT_STORAGE_KEY = "maximus:order-context";

function normalizeOrderContext(context?: OrderContextData | null): OrderContextData | null {
  if (!context) return null;
  const unit = context.unit?.trim() || undefined;
  const table = context.table?.trim() || undefined;
  const mode = context.mode;
  if (!unit && !table && !mode) return null;
  return {
    ...(unit ? { unit } : {}),
    ...(table ? { table } : {}),
    ...(mode ? { mode } : {}),
    ...(context.source ? { source: context.source } : {}),
  };
}

function readStoredOrderContext(): OrderContextData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ORDER_CONTEXT_STORAGE_KEY);
    return normalizeOrderContext(raw ? (JSON.parse(raw) as OrderContextData) : null);
  } catch {
    return null;
  }
}

function writeStoredOrderContext(context: OrderContextData | null) {
  if (typeof window === "undefined") return;
  if (!context) {
    window.sessionStorage.removeItem(ORDER_CONTEXT_STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(ORDER_CONTEXT_STORAGE_KEY, JSON.stringify(context));
}

const CartContext = createContext<CartContextValue | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [orderContext, setStoredOrderContext] = useState<OrderContextData | null>(
    readStoredOrderContext,
  );

  const setOrderContext = useCallback((context: OrderContextData) => {
    setStoredOrderContext((prev) => {
      const next = normalizeOrderContext({ ...prev, ...context });
      writeStoredOrderContext(next);
      console.log("OrderContext salvo", next);
      return next;
    });
  }, []);

  const clearOrderContext = useCallback(() => {
    writeStoredOrderContext(null);
    setStoredOrderContext(null);
  }, []);

  const getEffectiveOrderContext = useCallback(
    (context?: OrderContextData | null) => normalizeOrderContext({ ...orderContext, ...context }),
    [orderContext],
  );

  const addItem = useCallback((product: Product, selections: SelectedOptions, note?: string) => {
    setItems((prev) => {
      const trimmedNote = note?.trim() || undefined;
      const id = buildCartItemId(product.id, selections, trimmedNote);
      const unitPrice = calculateUnitPrice(product, selections);
      const existing = prev.find((i) => i.id === id);

      if (existing) {
        return prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity + 1 } : i));
      }

      return [
        ...prev,
        {
          id,
          product,
          quantity: 1,
          basePrice: product.price,
          unitPrice,
          selections,
          customizations: getCustomizations(product, selections),
          note: trimmedNote,
        },
      ];
    });
  }, []);

  const updateItem = useCallback((itemId: string, selections: SelectedOptions, note?: string) => {
    setItems((prev) => {
      const current = prev.find((item) => item.id === itemId);
      if (!current) return prev;

      const trimmedNote = note?.trim() || undefined;
      const id = buildCartItemId(current.product.id, selections, trimmedNote);
      const unitPrice = calculateUnitPrice(current.product, selections);
      const updated: CartItem = {
        ...current,
        id,
        unitPrice,
        selections,
        customizations: getCustomizations(current.product, selections),
        note: trimmedNote,
      };
      const remaining = prev.filter((item) => item.id !== itemId);
      const duplicate = remaining.find((item) => item.id === id);

      if (duplicate) {
        return remaining.map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + updated.quantity } : item,
        );
      }

      return [...remaining, updated];
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  const inc = useCallback((itemId: string) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, quantity: i.quantity + 1 } : i)));
  }, []);

  const dec = useCallback((itemId: string) => {
    setItems((prev) =>
      prev
        .map((i) => (i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const updateNote = useCallback((itemId: string, note: string) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, note } : i)));
  }, []);

  const clearItems = useCallback(() => {
    setItems([]);
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    clearOrderContext();
  }, [clearOrderContext]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.unitPrice * i.quantity, 0), [items]);
  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  const placeOrder = useCallback(
    (info: OrderInfo) => {
      setOrder(info);
      setItems([]);
      clearOrderContext();
    },
    [clearOrderContext],
  );
  const clearOrder = useCallback(() => setOrder(null), []);

  const cartValue: CartContextValue = {
    items,
    orderContext,
    setOrderContext,
    clearOrderContext,
    getEffectiveOrderContext,
    addItem,
    updateItem,
    removeItem,
    inc,
    dec,
    updateNote,
    clearItems,
    clear,
    count,
    subtotal,
  };

  return (
    <CartContext.Provider value={cartValue}>
      <OrderContext.Provider value={{ order, placeOrder, clearOrder }}>
        {children}
      </OrderContext.Provider>
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within StoreProvider");
  return ctx;
}

/* ----------------------------- Order store ---------------------------- */

interface OrderContextValue {
  order: OrderInfo | null;
  placeOrder: (info: OrderInfo) => void;
  clearOrder: () => void;
}

const OrderContext = createContext<OrderContextValue | null>(null);

export function useOrder() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrder must be used within StoreProvider");
  return ctx;
}
