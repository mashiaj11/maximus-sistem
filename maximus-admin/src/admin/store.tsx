import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { UNITS } from "./data/units";
import {
  assignSupabaseDeliveryDriver,
  completeSupabaseDeliveryByDriver,
  deleteSupabaseCategory,
  deleteSupabaseCourier,
  deleteSupabaseDeliveryNeighborhoodRule,
  deleteSupabaseDeliveryRule,
  deleteSupabaseProduct,
  insertSupabaseCategory,
  insertSupabaseCourier,
  insertSupabaseDeliveryNeighborhoodRule,
  insertSupabaseDeliveryRule,
  insertSupabaseProduct,
  insertSupabaseTable,
  loadSupabaseAdminData,
  setSupabaseCategoryActive,
  setSupabaseProductAvailable,
  updateSupabaseCategory,
  updateSupabaseCourier,
  updateSupabaseDriverLocation,
  updateSupabaseDeliveryNeighborhoodRule,
  updateSupabaseDeliveryRule,
  updateSupabaseOrderKitchenPrintStatus,
  updateSupabaseOrderPayment,
  updateSupabaseOrderStatus,
  updateSupabaseProduct,
  updateSupabaseTable,
  updateSupabaseUnit,
  upsertSupabaseAdminSettings,
  validateSupabaseAdminPin,
  loginSupabaseDriver,
  resetSupabaseOperationalData,
  startSupabaseDeliveryNavigation,
  type OperationalResetScope,
} from "./supabase-data";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { printKitchenOrder } from "./printing";
import { sendWhatsAppStatusMessage } from "./whatsapp";
import type {
  AdminUser,
  AdminUnit,
  BusinessHour,
  Category,
  Courier,
  CourierStatus,
  DriverPanelSettings,
  DeliveryNeighborhoodRule,
  DeliveryRule,
  DeliverySettlement,
  DeliverySettlementDriver,
  KitchenPrintSettings,
  Order,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductDraft,
  RestaurantTable,
  TableStatus,
  UnitId,
  WhatsappMessageSettings,
} from "./data/types";
import { getNextStatus, isFinalStatus } from "./data/statuses";

type StatusChangeSource = "admin" | "driver";

interface AdminContextValue {
  units: AdminUnit[];
  selectedUnit: AdminUnit | null;
  selectedUnitId: UnitId | null;
  authError: string | null;
  dataError: string | null;
  isLoading: boolean;
  selectUnit: (unitId: UnitId, pin?: string) => Promise<boolean>;
  clearSelectedUnit: () => void;
  orders: Order[];
  allOrders: Order[];
  products: Product[];
  allProducts: Product[];
  categories: Category[];
  tables: RestaurantTable[];
  couriers: Courier[];
  allCouriers: Courier[];
  deliveryRules: DeliveryRule[];
  deliveryNeighborhoodRules: DeliveryNeighborhoodRule[];
  deliverySettlements: DeliverySettlement[];
  users: AdminUser[];
  reloadData: () => Promise<void>;
  validateDriverLogin: (username: string, pin: string) => Promise<string | null>;
  resetOperationalData: (scope: OperationalResetScope) => Promise<void>;
  updateUnit: (
    patch: Partial<
      Pick<
        AdminUnit,
        | "name"
        | "phone"
        | "address"
        | "latitude"
        | "longitude"
        | "isOpen"
        | "theme"
        | "accessPin"
        | "kitchenPrintSettings"
        | "whatsappSettings"
        | "driverPanelSettings"
        | "minimumOrderValue"
        | "baseDeliveryFee"
        | "deliveryFeePerKm"
        | "maxDeliveryDistanceKm"
        | "freeDeliveryFrom"
      >
    > & { businessHours?: BusinessHour[] },
  ) => Promise<void>;
  updateStatus: (orderId: string, status: OrderStatus, source?: StatusChangeSource) => void;
  advanceStatus: (orderId: string) => void;
  assignDeliveryCourier: (orderId: string, courierId: string) => void;
  updateDriverLocation: (orderId: string, latitude: number, longitude: number) => void;
  startDeliveryNavigation: (orderId: string) => void;
  completeDeliveryByDriver: (orderId: string, paymentConfirmed: boolean) => void;
  setPayment: (orderId: string, status: PaymentStatus, source?: StatusChangeSource) => void;
  toggleProduct: (productId: string) => void;
  updateProduct: (productId: string, patch: Partial<Product>) => void;
  addProduct: (data: ProductDraft) => void;
  deleteProduct: (productId: string) => void;
  toggleProductForCurrentUnit: (productId: string) => void;
  addCategory: (name: string) => void;
  updateCategory: (categoryId: string, patch: Partial<Pick<Category, "name" | "order">>) => void;
  deleteCategory: (categoryId: string) => void;
  toggleCategoryForCurrentUnit: (categoryId: string) => void;
  addTable: () => void;
  updateTable: (
    tableId: string,
    patch: Partial<Pick<RestaurantTable, "status" | "active">>,
  ) => void;
  toggleTable: (tableId: string) => void;
  deleteTable: (tableId: string) => void;
  addCourier: (
    data: Pick<Courier, "name" | "phone" | "status"> & { username?: string; accessPin?: string },
  ) => Promise<void>;
  updateCourier: (
    courierId: string,
    patch: Partial<
      Pick<Courier, "name" | "phone" | "status" | "active" | "username" | "accessPin">
    >,
  ) => Promise<void>;
  toggleCourier: (courierId: string) => Promise<void>;
  deleteCourier: (courierId: string) => Promise<void>;
  addDeliveryRule: () => void;
  updateDeliveryRule: (
    ruleId: string,
    patch: Partial<
      Pick<DeliveryRule, "maxDistanceKm" | "estimatedMinutes" | "deliveryFee" | "isActive">
    >,
  ) => void;
  removeDeliveryRule: (ruleId: string) => void;
  toggleDeliveryRule: (ruleId: string) => void;
  saveDeliveryRules: () => void;
  addDeliveryNeighborhoodRule: () => void;
  updateDeliveryNeighborhoodRule: (
    ruleId: string,
    patch: Partial<
      Pick<
        DeliveryNeighborhoodRule,
        "neighborhood" | "estimatedMinutes" | "deliveryFee" | "isActive"
      >
    >,
  ) => void;
  removeDeliveryNeighborhoodRule: (ruleId: string) => void;
  toggleDeliveryNeighborhoodRule: (ruleId: string) => void;
  saveDeliveryNeighborhoodRules: () => void;
  saveDeliverySettlement: (drivers: DeliverySettlementDriver[]) => void;
  addUser: (data: Pick<AdminUser, "name" | "contact" | "role">) => void;
  updateUser: (
    userId: string,
    patch: Partial<Pick<AdminUser, "name" | "contact" | "role" | "active">>,
  ) => void;
  toggleUser: (userId: string) => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

const DEFAULT_KITCHEN_PRINT_SETTINGS: KitchenPrintSettings = {
  autoPrintEnabled: false,
  printerName: "Cozinha",
  printerIp: "",
  printerPort: 9100,
  printerType: "escpos",
  copies: 1,
};

const DEFAULT_WHATSAPP_SETTINGS: WhatsappMessageSettings = {
  enabled: false,
  officialNumber: "(93) 984057229",
  receivedMessage: "Recebemos seu pedido na Maximus. Em breve nossa equipe vai confirmar.",
  acceptedMessage: "Seu pedido foi aceito e já entrou no fluxo da Maximus.",
  productionMessage: "Seu pedido está em produção.",
  readyMessage: "Seu pedido está pronto.",
  outForDeliveryMessage: "Seu pedido saiu para entrega.",
  deliveredMessage: "Pedido entregue. Obrigado por comprar com a Maximus.",
};

const DEFAULT_DRIVER_PANEL_SETTINGS: DriverPanelSettings = {
  enabled: false,
};

const LOCAL_STORAGE_KEYS = {
  sessionUnitId: "maximus-admin-session-unit",
};

const LEGACY_LOCAL_STORAGE_KEYS = [
  "maximus-admin-orders",
  "maximus-admin-products",
  "maximus-admin-categories",
  "maximus-admin-units",
  "maximus-admin-couriers",
  "maximus-admin-tables",
  "maximus-admin-settings",
  "maximus-admin-dashboard",
  "local-orders",
  "admin-settings",
  "teste-supabase",
];

function readLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function cleanupLegacyOperationalStorage() {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_LOCAL_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}

function buildTableLink(unitId: UnitId, number: number) {
  return `/menu?unidade=${unitId}&mesa=${String(number).padStart(2, "0")}`;
}

function buildTable(unitId: UnitId, number: number): RestaurantTable {
  const publicUrl = buildTableLink(unitId, number);
  return {
    id: `${unitId}-mesa-${String(number).padStart(2, "0")}-${Date.now()}`,
    unitId,
    number,
    status: "livre",
    active: true,
    menuLink: publicUrl,
    publicUrl,
    qrCodeData: publicUrl,
    createdAt: new Date().toISOString(),
  };
}

function isToday(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function getDistanceKm(originLat: number, originLng: number, targetLat: number, targetLng: number) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(targetLat - originLat);
  const dLng = toRadians(targetLng - originLng);
  const lat1 = toRadians(originLat);
  const lat2 = toRadians(targetLat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function resolveDeliveryPayout(order: Order, rules: DeliveryRule[]): number {
  const explicitValue =
    order.driverEarnedValue ??
    order.driver_earned_value ??
    order.deliveryPayoutAmount ??
    order.deliveryFeeSnapshot ??
    order.delivery_fee_snapshot ??
    order.deliveryFee ??
    order.delivery_fee ??
    order.courierFee;
  if (Number.isFinite(explicitValue)) return Math.max(0, explicitValue ?? 0);

  const unitRules = rules
    .filter((rule) => rule.unitId === order.unitId && rule.isActive)
    .sort((a, b) => a.maxDistanceKm - b.maxDistanceKm);

  if (Number.isFinite(order.deliveryDistanceKm)) {
    const matchedRule = unitRules.find(
      (rule) => rule.maxDistanceKm >= (order.deliveryDistanceKm ?? 0),
    );
    if (matchedRule) return matchedRule.deliveryFee;
  }

  return unitRules[0]?.deliveryFee ?? 0;
}

function normalizeKitchenPrintSettings(settings?: KitchenPrintSettings): KitchenPrintSettings {
  return {
    ...DEFAULT_KITCHEN_PRINT_SETTINGS,
    ...settings,
    printerPort: Math.max(
      1,
      Number(settings?.printerPort ?? DEFAULT_KITCHEN_PRINT_SETTINGS.printerPort),
    ),
    copies: Math.max(1, Number(settings?.copies ?? DEFAULT_KITCHEN_PRINT_SETTINGS.copies)),
  };
}

function normalizeUnit(unit: AdminUnit): AdminUnit {
  const fallback = UNITS.find((item) => item.id === unit.id);
  return {
    ...unit,
    latitude: Number.isFinite(unit.latitude) ? unit.latitude : (fallback?.latitude ?? 0),
    longitude: Number.isFinite(unit.longitude) ? unit.longitude : (fallback?.longitude ?? 0),
    isOpen: typeof unit.isOpen === "boolean" ? unit.isOpen : (fallback?.isOpen ?? true),
    accessPin: unit.accessPin ?? fallback?.accessPin ?? "1234",
    kitchenPrintSettings: normalizeKitchenPrintSettings(
      unit.kitchenPrintSettings ?? fallback?.kitchenPrintSettings,
    ),
    whatsappSettings: {
      ...DEFAULT_WHATSAPP_SETTINGS,
      ...fallback?.whatsappSettings,
      ...unit.whatsappSettings,
      officialNumber:
        unit.whatsappSettings?.officialNumber ??
        fallback?.whatsappSettings?.officialNumber ??
        unit.phone,
    },
    driverPanelSettings: {
      ...DEFAULT_DRIVER_PANEL_SETTINGS,
      ...fallback?.driverPanelSettings,
      ...unit.driverPanelSettings,
    },
    minimumOrderValue: Number(unit.minimumOrderValue ?? fallback?.minimumOrderValue ?? 0),
    baseDeliveryFee: Number(unit.baseDeliveryFee ?? fallback?.baseDeliveryFee ?? 0),
    deliveryFeePerKm: Number(unit.deliveryFeePerKm ?? fallback?.deliveryFeePerKm ?? 0),
    maxDeliveryDistanceKm: Number(
      unit.maxDeliveryDistanceKm ?? fallback?.maxDeliveryDistanceKm ?? 0,
    ),
    freeDeliveryFrom: Number(unit.freeDeliveryFrom ?? fallback?.freeDeliveryFrom ?? 0),
  };
}

function normalizeUnits(units: AdminUnit[]): AdminUnit[] {
  return units.map(normalizeUnit);
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [selectedUnitId, setSelectedUnitId] = useState<UnitId | null>(() =>
    readLocalStorage<UnitId | null>(LOCAL_STORAGE_KEYS.sessionUnitId, null),
  );
  const [authError, setAuthError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(
    isSupabaseConfigured ? null : "Supabase não configurado.",
  );
  const [isLoading, setIsLoading] = useState<boolean>(isSupabaseConfigured);
  const [allUnits, setUnits] = useState<AdminUnit[]>([]);
  const [allOrders, setOrders] = useState<Order[]>([]);
  const [allProducts, setProducts] = useState<Product[]>([]);
  const [allCategories, setCategories] = useState<Category[]>([]);
  const [allTables, setTables] = useState<RestaurantTable[]>([]);
  const [allCouriers, setCouriers] = useState<Courier[]>([]);
  const [allDeliveryRules, setDeliveryRules] = useState<DeliveryRule[]>([]);
  const [allDeliveryNeighborhoodRules, setDeliveryNeighborhoodRules] = useState<
    DeliveryNeighborhoodRule[]
  >([]);
  const [allDeliverySettlements, setDeliverySettlements] = useState<DeliverySettlement[]>([]);
  const [allUsers] = useState<AdminUser[]>([]);

  const loadAdminData = useCallback(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      setDataError("Supabase não configurado.");
      return Promise.resolve();
    }

    setIsLoading(true);
    return loadSupabaseAdminData()
      .then((data) => {
        setDataError(null);
        setUnits(normalizeUnits(data.units));
        setSelectedUnitId((current) =>
          current && data.units.some((unit) => unit.id === current) ? current : null,
        );
        setOrders(data.orders);
        setCategories(data.categories);
        setProducts(data.products);
        setTables(data.tables);
        setCouriers(data.couriers);
        setDeliveryRules(data.deliveryRules);
        setDeliveryNeighborhoodRules(data.deliveryNeighborhoodRules ?? []);
      })
      .catch((error) => {
        console.error("[Maximus][Supabase] Falha ao carregar dados do admin", error);
        setUnits([]);
        setSelectedUnitId(null);
        setOrders([]);
        setCategories([]);
        setProducts([]);
        setTables([]);
        setCouriers([]);
        setDeliveryRules([]);
        setDeliveryNeighborhoodRules([]);
        setDataError(
          error instanceof Error ? error.message : "Falha ao carregar dados do Supabase.",
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    cleanupLegacyOperationalStorage();
    loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = getSupabaseClient()
      .channel("admin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        loadAdminData(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () =>
        loadAdminData(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () =>
        loadAdminData(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () =>
        loadAdminData(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "store_tables" }, () =>
        loadAdminData(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_drivers" }, () =>
        loadAdminData(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_fee_rules" }, () =>
        loadAdminData(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_settings" }, () =>
        loadAdminData(),
      )
      .subscribe();

    return () => {
      getSupabaseClient().removeChannel(channel);
    };
  }, [loadAdminData]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const poll = window.setInterval(() => {
      loadAdminData();
    }, 10000);
    return () => window.clearInterval(poll);
  }, [loadAdminData]);

  useEffect(() => {
    writeLocalStorage(LOCAL_STORAGE_KEYS.sessionUnitId, selectedUnitId);
  }, [selectedUnitId]);

  const value = useMemo<AdminContextValue>(() => {
    const selectedUnit = allUnits.find((unit) => unit.id === selectedUnitId) ?? null;
    const orders = selectedUnitId
      ? allOrders.filter((order) => order.unitId === selectedUnitId)
      : [];
    const products = selectedUnitId
      ? allProducts.filter(
          (product) => !product.unitIds || product.unitIds.includes(selectedUnitId),
        )
      : [];
    const tables = selectedUnitId
      ? allTables.filter((table) => table.unitId === selectedUnitId)
      : [];
    const couriers = selectedUnitId
      ? allCouriers.filter((courier) => courier.unitId === selectedUnitId)
      : [];
    const deliverySettlements = selectedUnitId
      ? allDeliverySettlements
          .filter((settlement) => settlement.unitId === selectedUnitId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      : [];
    const users = selectedUnitId ? allUsers.filter((user) => user.unitId === selectedUnitId) : [];
    const deliveryRules = selectedUnitId
      ? allDeliveryRules
          .filter((rule) => rule.unitId === selectedUnitId)
          .sort((a, b) => a.maxDistanceKm - b.maxDistanceKm)
      : [];
    const deliveryNeighborhoodRules = selectedUnitId
      ? allDeliveryNeighborhoodRules
          .filter((rule) => rule.unitId === selectedUnitId)
          .sort((a, b) => a.neighborhood.localeCompare(b.neighborhood))
      : [];
    const triggerKitchenPrint = (order: Order) => {
      const settings = normalizeKitchenPrintSettings(
        allUnits.find((unit) => unit.id === order.unitId)?.kitchenPrintSettings,
      );

      if (!settings.autoPrintEnabled) {
        setOrders((prev) =>
          prev.map((item) =>
            item.id === order.id ? { ...item, kitchenPrintStatus: "disabled" } : item,
          ),
        );
        if (isSupabaseConfigured) {
          updateSupabaseOrderKitchenPrintStatus(order.id, "disabled").catch((error) => {
            console.error("[Maximus][Supabase] Falha ao atualizar status de impressao", error);
          });
        }
        return;
      }

      setOrders((prev) =>
        prev.map((item) =>
          item.id === order.id ? { ...item, kitchenPrintStatus: "pending" } : item,
        ),
      );
      if (isSupabaseConfigured) {
        updateSupabaseOrderKitchenPrintStatus(order.id, "pending").catch((error) => {
          console.error("[Maximus][Supabase] Falha ao atualizar status de impressao", error);
        });
      }

      printKitchenOrder(order)
        .then(() => {
          const printedAt = new Date().toISOString();
          setOrders((prev) =>
            prev.map((item) =>
              item.id === order.id
                ? { ...item, kitchenPrintStatus: "printed", kitchenPrintedAt: printedAt }
                : item,
            ),
          );
          if (isSupabaseConfigured) {
            updateSupabaseOrderKitchenPrintStatus(order.id, "printed", printedAt).catch((error) => {
              console.error("[Maximus][Supabase] Falha ao confirmar impressao", error);
            });
          }
        })
        .catch((error) => {
          console.error("[Maximus][KitchenPrint] Falha ao imprimir comanda", error);
          setOrders((prev) =>
            prev.map((item) =>
              item.id === order.id ? { ...item, kitchenPrintStatus: "error" } : item,
            ),
          );
          if (isSupabaseConfigured) {
            updateSupabaseOrderKitchenPrintStatus(order.id, "error").catch((supabaseError) => {
              console.error(
                "[Maximus][Supabase] Falha ao registrar erro de impressao",
                supabaseError,
              );
            });
          }
        });
    };

    const notifyWhatsApp = (order: Order, status: OrderStatus) => {
      const unit = allUnits.find((item) => item.id === order.unitId) ?? selectedUnit;
      sendWhatsAppStatusMessage(order, status, unit).catch((error) => {
        console.error("[Maximus][WhatsApp] Falha ao processar mensagem", error);
      });
    };

    return {
      units: allUnits,
      selectedUnit,
      selectedUnitId,
      authError,
      dataError,
      isLoading,
      reloadData: loadAdminData,
      validateDriverLogin: async (username, pin) => {
        if (!isSupabaseConfigured) {
          const driver = allCouriers.find(
            (courier) =>
              courier.username === username &&
              courier.accessPin === pin &&
              courier.active &&
              courier.status !== "inativo",
          );
          return driver?.id ?? null;
        }
        return loginSupabaseDriver(username, pin);
      },
      resetOperationalData: async (scope) => {
        await resetSupabaseOperationalData(scope);
        await loadAdminData();
      },
      selectUnit: async (unitId, pin) => {
        const unit = allUnits.find((item) => item.id === unitId);
        if (!unit) {
          setAuthError("Unidade não encontrada.");
          return false;
        }
        const valid = isSupabaseConfigured
          ? await validateSupabaseAdminPin(unitId, pin ?? "")
          : !unit.accessPin || unit.accessPin === pin;
        if (!valid) {
          setAuthError("Senha numérica inválida para esta unidade.");
          return false;
        }
        setAuthError(null);
        setSelectedUnitId(unitId);
        return true;
      },
      clearSelectedUnit: () => {
        setSelectedUnitId(null);
        setAuthError(null);
      },
      orders,
      allOrders,
      products,
      allProducts,
      categories: allCategories,
      tables,
      couriers,
      allCouriers,
      deliveryRules,
      deliveryNeighborhoodRules,
      deliverySettlements,
      users,
      updateUnit: async (patch) => {
        if (!selectedUnitId) return;
        const nextUnit = allUnits.find((unit) => unit.id === selectedUnitId);
        if (!nextUnit) return;
        const persistedUnit = normalizeUnit({ ...nextUnit, ...patch });
        setUnits((prev) => prev.map((unit) => (unit.id === selectedUnitId ? persistedUnit : unit)));
        if (isSupabaseConfigured) {
          try {
            await updateSupabaseUnit(selectedUnitId, patch);
            await upsertSupabaseAdminSettings(persistedUnit);
            await loadAdminData();
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao atualizar unidade", error);
            setUnits((prev) => prev.map((unit) => (unit.id === selectedUnitId ? nextUnit : unit)));
            throw error;
          }
        }
      },
      updateStatus: (orderId, status) => {
        const order = allOrders.find((item) => item.id === orderId);
        if (!order) return;
        const finished = isFinalStatus(status);
        const delivered = status === "delivered";
        const deliveredAt = finished ? new Date().toISOString() : undefined;
        const nextOrder = {
          ...order,
          status,
          deliveryStatus: status,
          ...(deliveredAt ? { deliveredAt } : {}),
        };
        const driverId = order.deliveryDriverId ?? order.courierId;

        setOrders((prev) => prev.map((item) => (item.id === orderId ? nextOrder : item)));
        if (isSupabaseConfigured) {
          updateSupabaseOrderStatus(orderId, status, deliveredAt).catch((error) => {
            console.error("[Maximus][Supabase] Falha ao atualizar pedido", error);
          });
        }
        if (delivered && driverId) {
          setCouriers((couriers) =>
            couriers.map((courier) =>
              courier.id === driverId
                ? { ...courier, status: "disponivel", active: true }
                : courier,
            ),
          );
          if (isSupabaseConfigured) {
            updateSupabaseCourier(driverId, { status: "disponivel", active: true }).catch(
              (error) => {
                console.error("[Maximus][Supabase] Falha ao liberar entregador", error);
              },
            );
          }
        }
        if (status === "in_preparation") triggerKitchenPrint(nextOrder);
        notifyWhatsApp(nextOrder, status);
      },
      advanceStatus: (orderId) => {
        const order = allOrders.find((item) => item.id === orderId);
        if (!order) return;
        const next = getNextStatus(order.type, order.status);
        if (!next) return;
        const finished = isFinalStatus(next);
        const delivered = next === "delivered";
        const deliveredAt = finished ? new Date().toISOString() : undefined;
        const nextOrder = {
          ...order,
          status: next,
          deliveryStatus: next,
          ...(deliveredAt ? { deliveredAt } : {}),
        };
        const driverId = order.deliveryDriverId ?? order.courierId;

        setOrders((prev) => prev.map((item) => (item.id === orderId ? nextOrder : item)));
        if (isSupabaseConfigured) {
          updateSupabaseOrderStatus(orderId, next, deliveredAt).catch((error) => {
            console.error("[Maximus][Supabase] Falha ao avancar pedido", error);
          });
        }
        if (delivered && driverId) {
          setCouriers((couriers) =>
            couriers.map((courier) =>
              courier.id === driverId
                ? { ...courier, status: "disponivel", active: true }
                : courier,
            ),
          );
          if (isSupabaseConfigured) {
            updateSupabaseCourier(driverId, { status: "disponivel", active: true }).catch(
              (error) => {
                console.error("[Maximus][Supabase] Falha ao liberar entregador", error);
              },
            );
          }
        }
        if (next === "in_preparation") triggerKitchenPrint(nextOrder);
        notifyWhatsApp(nextOrder, next);
      },
      assignDeliveryCourier: (orderId, courierId) => {
        const courier = allCouriers.find((item) => item.id === courierId);
        if (!courier || !courier.active || courier.status !== "disponivel") return;
        const order = allOrders.find((item) => item.id === orderId);
        if (!order || order.paymentStatus !== "confirmed") return;
        const payoutAmount = resolveDeliveryPayout(order, allDeliveryRules);
        const now = new Date().toISOString();
        let assignedOrder: Order | null = null;
        setOrders((prev) =>
          prev.map((order) => {
            if (order.id !== orderId) return order;
            assignedOrder = {
              ...order,
              status: "out_for_delivery",
              deliveryStatus: "out_for_delivery",
              courierId: courier.id,
              courierName: courier.name,
              deliveryDriverId: courier.id,
              deliveryDriverName: courier.name,
              driver_id: courier.id,
              driver_name: courier.name,
              deliveryFee: order.deliveryFee ?? payoutAmount,
              deliveryPayoutAmount: payoutAmount,
              driverEarnedValue: payoutAmount,
              driver_earned_value: payoutAmount,
              outForDeliveryAt: now,
            };
            return assignedOrder;
          }),
        );
        setCouriers((prev) =>
          prev.map((item) =>
            item.id === courierId ? { ...item, status: "em_entrega", active: true } : item,
          ),
        );
        if (isSupabaseConfigured) {
          assignSupabaseDeliveryDriver(orderId, courier, payoutAmount, now).catch((error) => {
            console.error("[Maximus][Supabase] Falha ao atribuir entregador", error);
          });
        }
      },
      setPayment: (orderId, paymentStatus) => {
        const order = allOrders.find((item) => item.id === orderId);
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, paymentStatus } : o)));
        if (isSupabaseConfigured && order) {
          updateSupabaseOrderPayment(order, paymentStatus).catch((error) => {
            console.error("[Maximus][Supabase] Falha ao atualizar pagamento", error);
          });
        }
      },
      updateDriverLocation: (orderId, latitude, longitude) => {
        const order = allOrders.find((item) => item.id === orderId);
        const deliveryLat = order?.deliveryLat ?? order?.delivery_lat;
        const deliveryLng = order?.deliveryLng ?? order?.delivery_lng;
        const canMoveToNearby =
          order?.status === "out_for_delivery" || order?.status === "driver_on_way";
        const distanceToCustomer =
          deliveryLat != null && deliveryLng != null
            ? getDistanceKm(latitude, longitude, deliveryLat, deliveryLng)
            : null;
        const nextStatus: OrderStatus =
          canMoveToNearby && distanceToCustomer != null && distanceToCustomer <= 0.5
            ? "driver_nearby"
            : "driver_on_way";
        console.info("[Maximus][driver-location]", {
          pedido: orderId,
          latitudeEntregador: latitude,
          longitudeEntregador: longitude,
          latitudeDestino: deliveryLat,
          longitudeDestino: deliveryLng,
          distanciaAteDestinoKm: distanceToCustomer,
          metodo: "watchPosition",
          proximoStatus: nextStatus,
        });
        const patch = {
          driverLat: latitude,
          driverLng: longitude,
          driver_lat: latitude,
          driver_lng: longitude,
          deliveryStatus: nextStatus,
          status: nextStatus,
        };
        setOrders((prev) =>
          prev.map((order) => (order.id === orderId ? { ...order, ...patch } : order)),
        );
        if (isSupabaseConfigured) {
          updateSupabaseDriverLocation(orderId, latitude, longitude, nextStatus).catch((error) => {
            console.error("[Maximus][Supabase] Falha ao atualizar GPS do entregador", error);
          });
        }
        if (order && order.status !== nextStatus) {
          notifyWhatsApp({ ...order, ...patch }, nextStatus);
        }
      },
      startDeliveryNavigation: (orderId) => {
        const order = allOrders.find((item) => item.id === orderId);
        if (!order) return;
        const now = new Date().toISOString();
        const shouldMoveOut = order.status === "ready" || order.status === "ready_for_pickup";
        const patch: Partial<Order> = {
          navigationStartedAt: now,
          navigation_started_at: now,
          ...(shouldMoveOut
            ? {
                status: "out_for_delivery",
                deliveryStatus: "out_for_delivery",
                outForDeliveryAt: order.outForDeliveryAt ?? now,
              }
            : {}),
        };
        setOrders((prev) =>
          prev.map((item) => (item.id === orderId ? { ...item, ...patch } : item)),
        );
        if (isSupabaseConfigured) {
          startSupabaseDeliveryNavigation(order, now).catch((error) => {
            console.error("[Maximus][Supabase] Falha ao registrar navegacao", error);
          });
        }
        if (shouldMoveOut) notifyWhatsApp({ ...order, ...patch }, "out_for_delivery");
      },
      completeDeliveryByDriver: (orderId, paymentConfirmed) => {
        const order = allOrders.find((item) => item.id === orderId);
        if (!order || order.delivery_completed_by_driver) return;
        const now = new Date().toISOString();
        const driverId = order.deliveryDriverId ?? order.courierId ?? order.driver_id;
        const driver = allCouriers.find((courier) => courier.id === driverId);
        const nextOrder: Order = {
          ...order,
          status: "delivered",
          deliveryStatus: "delivered",
          deliveredAt: now,
          delivered_at: now,
          paymentStatus: paymentConfirmed ? "confirmed" : order.paymentStatus,
          payment_confirmed: paymentConfirmed || order.paymentStatus === "confirmed",
          delivery_completed_by_driver: true,
          deliveryDriverId: driverId,
          courierId: driverId,
          deliveryDriverName: order.deliveryDriverName ?? order.courierName ?? driver?.name,
          courierName: order.courierName ?? order.deliveryDriverName ?? driver?.name,
          driver_id: driverId,
          driver_name:
            order.driver_name ?? order.deliveryDriverName ?? order.courierName ?? driver?.name,
        };
        setOrders((prev) => prev.map((item) => (item.id === orderId ? nextOrder : item)));
        if (driverId) {
          setCouriers((couriers) =>
            couriers.map((courier) =>
              courier.id === driverId
                ? { ...courier, status: "disponivel", active: true }
                : courier,
            ),
          );
        }
        if (isSupabaseConfigured) {
          completeSupabaseDeliveryByDriver(order, paymentConfirmed, now).catch((error) => {
            console.error("[Maximus][Supabase] Falha ao finalizar entrega", error);
          });
        }
        notifyWhatsApp(nextOrder, "delivered");
      },
      toggleProduct: async (productId) => {
        const product = allProducts.find((item) => item.id === productId);
        if (!product) return;
        const active = !product.active;
        setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, active } : p)));
        if (isSupabaseConfigured) {
          try {
            await setSupabaseProductAvailable(productId, active);
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao alternar produto", error);
          }
        }
      },
      updateProduct: async (productId, patch) => {
        setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, ...patch } : p)));
        if (isSupabaseConfigured) {
          try {
            await updateSupabaseProduct(productId, patch);
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao atualizar produto", error);
          }
        }
      },
      addProduct: async (data) => {
        if (!selectedUnitId) return;
        const cleanName = data.name.trim();
        if (!cleanName) return;
        if (isSupabaseConfigured) {
          try {
            const product = await insertSupabaseProduct(selectedUnitId, {
              ...data,
              name: cleanName,
            });
            setProducts((prev) => [...prev, product]);
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao criar produto", error);
          }
          return;
        }
        setProducts((prev) => [
          ...prev,
          {
            ...data,
            id: `prod-${Date.now()}`,
            name: cleanName,
            description: data.description?.trim(),
            imageUrl: data.imageUrl,
            unitIds: [selectedUnitId],
          },
        ]);
      },
      deleteProduct: async (productId) => {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        if (isSupabaseConfigured) {
          try {
            await deleteSupabaseProduct(productId);
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao excluir produto", error);
          }
        }
      },
      toggleProductForCurrentUnit: async (productId) => {
        if (!selectedUnitId) return;
        const product = allProducts.find((item) => item.id === productId);
        if (isSupabaseConfigured && product?.unitIds?.includes(selectedUnitId)) {
          const active = !product.active;
          setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, active } : p)));
          try {
            await setSupabaseProductAvailable(productId, active);
          } catch (error) {
            console.error(
              "[Maximus][Supabase] Falha ao alternar disponibilidade do produto",
              error,
            );
          }
          return;
        }
        setProducts((prev) =>
          prev.map((p) => {
            if (p.id !== productId) return p;
            const unitIds = p.unitIds ?? allUnits.map((unit) => unit.id);
            const nextUnitIds = unitIds.includes(selectedUnitId)
              ? unitIds.filter((id) => id !== selectedUnitId)
              : [...unitIds, selectedUnitId];
            return { ...p, unitIds: nextUnitIds };
          }),
        );
      },
      addCategory: async (name) => {
        if (!selectedUnitId) return;
        const cleanName = name.trim();
        if (!cleanName) return;
        if (isSupabaseConfigured) {
          try {
            const category = await insertSupabaseCategory(cleanName, allCategories.length + 1);
            setCategories((prev) => [...prev, category]);
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao criar categoria", error);
          }
          return;
        }
        setCategories((prev) => [
          ...prev,
          {
            id: `cat-${Date.now()}`,
            name: cleanName,
            order: prev.length + 1,
            activeByUnit: {
              "maximus-01": selectedUnitId === "maximus-01",
              "maximus-02": selectedUnitId === "maximus-02",
            },
          },
        ]);
      },
      updateCategory: async (categoryId, patch) => {
        setCategories((prev) =>
          prev.map((category) =>
            category.id === categoryId ? { ...category, ...patch } : category,
          ),
        );
        if (isSupabaseConfigured) {
          try {
            await updateSupabaseCategory(categoryId, patch);
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao atualizar categoria", error);
          }
        }
      },
      deleteCategory: async (categoryId) => {
        setCategories((prev) => prev.filter((c) => c.id !== categoryId));
        if (isSupabaseConfigured) {
          try {
            await deleteSupabaseCategory(categoryId);
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao excluir categoria", error);
          }
        }
      },
      toggleCategoryForCurrentUnit: async (categoryId) => {
        if (!selectedUnitId) return;
        const category = allCategories.find((item) => item.id === categoryId);
        const nextActive = !category?.activeByUnit[selectedUnitId];
        setCategories((prev) =>
          prev.map((category) =>
            category.id === categoryId
              ? {
                  ...category,
                  activeByUnit: {
                    ...category.activeByUnit,
                    [selectedUnitId]: !category.activeByUnit[selectedUnitId],
                  },
                }
              : category,
          ),
        );
        if (isSupabaseConfigured) {
          try {
            await setSupabaseCategoryActive(categoryId, nextActive);
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao alternar categoria", error);
          }
        }
      },
      addTable: async () => {
        if (!selectedUnitId) return;
        const unitTables = allTables.filter((table) => table.unitId === selectedUnitId);
        const number = unitTables.length
          ? Math.max(...unitTables.map((table) => table.number)) + 1
          : 1;
        if (isSupabaseConfigured) {
          if (allTables.some((table) => table.unitId === selectedUnitId && table.number === number))
            return;
          try {
            const table = await insertSupabaseTable(selectedUnitId, number);
            setTables((prev) => [...prev, table]);
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao criar mesa", error);
          }
          return;
        }
        setTables((prev) =>
          prev.some((table) => table.unitId === selectedUnitId && table.number === number)
            ? prev
            : [...prev, buildTable(selectedUnitId, number)],
        );
      },
      updateTable: async (tableId, patch) => {
        setTables((prev) =>
          prev.map((table) => (table.id === tableId ? { ...table, ...patch } : table)),
        );
        if (isSupabaseConfigured) {
          try {
            await updateSupabaseTable(tableId, patch);
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao atualizar mesa", error);
          }
        }
      },
      deleteTable: async (tableId) => {
        setTables((prev) => prev.filter((table) => table.id !== tableId));
        if (isSupabaseConfigured) {
          try {
            await updateSupabaseTable(tableId, { active: false });
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao inativar mesa", error);
          }
        }
      },
      toggleTable: async (tableId) => {
        const table = allTables.find((item) => item.id === tableId);
        if (!table) return;
        const active = !table.active;
        setTables((prev) =>
          prev.map((table) => (table.id === tableId ? { ...table, active } : table)),
        );
        if (isSupabaseConfigured) {
          try {
            await updateSupabaseTable(tableId, { active });
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao alternar mesa", error);
          }
        }
      },
      addCourier: async (data) => {
        if (!selectedUnitId) return;
        if (isSupabaseConfigured) {
          try {
            const courier = await insertSupabaseCourier(selectedUnitId, data);
            setCouriers((prev) => [...prev, courier]);
            await loadAdminData();
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao criar entregador", error);
            throw error;
          }
          return;
        }
        setCouriers((prev) => [
          ...prev,
          {
            id: `courier-${Date.now()}`,
            unitId: selectedUnitId,
            name: data.name.trim(),
            phone: data.phone.trim(),
            status: data.status,
            active: data.status !== "inativo",
          },
        ]);
      },
      updateCourier: async (courierId, patch) => {
        const previous = allCouriers;
        setCouriers((prev) =>
          prev.map((courier) =>
            courier.id === courierId
              ? {
                  ...courier,
                  ...patch,
                  active: patch.status === "inativo" ? false : (patch.active ?? courier.active),
                }
              : courier,
          ),
        );
        if (isSupabaseConfigured) {
          try {
            await updateSupabaseCourier(courierId, patch);
            await loadAdminData();
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao atualizar entregador", error);
            setCouriers(previous);
            throw error;
          }
        }
      },
      toggleCourier: async (courierId) => {
        const courier = allCouriers.find((item) => item.id === courierId);
        if (!courier) return;
        const patch = {
          active: !courier.active,
          status: courier.active ? ("inativo" as CourierStatus) : ("disponivel" as CourierStatus),
        };
        const previous = allCouriers;
        setCouriers((prev) =>
          prev.map((courier) =>
            courier.id === courierId
              ? {
                  ...courier,
                  ...patch,
                }
              : courier,
          ),
        );
        if (isSupabaseConfigured) {
          try {
            await updateSupabaseCourier(courierId, patch);
            await loadAdminData();
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao alternar entregador", error);
            setCouriers(previous);
            throw error;
          }
        }
      },
      deleteCourier: async (courierId) => {
        const hasDeliveries = allOrders.some(
          (order) =>
            order.type === "delivery" &&
            (order.deliveryDriverId ?? order.courierId ?? order.driver_id) === courierId,
        );
        const previous = allCouriers;
        setCouriers((prev) => prev.filter((courier) => courier.id !== courierId));
        if (isSupabaseConfigured) {
          try {
            if (hasDeliveries) {
              await deleteSupabaseCourier(courierId);
            } else {
              await deleteSupabaseCourier(courierId);
            }
            await loadAdminData();
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao excluir entregador", error);
            setCouriers(previous);
            throw error;
          }
        }
      },
      addDeliveryRule: async () => {
        if (!selectedUnitId) return;
        const unitRules = allDeliveryRules.filter((rule) => rule.unitId === selectedUnitId);
        const nextDistance = unitRules.length
          ? Math.max(...unitRules.map((rule) => rule.maxDistanceKm)) + 0.5
          : 0.5;
        const rule = {
          unitId: selectedUnitId,
          maxDistanceKm: Number(nextDistance.toFixed(1)),
          estimatedMinutes: 60,
          deliveryFee: 0,
          isActive: true,
        };
        if (isSupabaseConfigured) {
          try {
            const saved = await insertSupabaseDeliveryRule(selectedUnitId, rule);
            setDeliveryRules((prev) => [...prev, saved]);
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao criar regra de entrega", error);
          }
          return;
        }
        setDeliveryRules((prev) => {
          return [
            ...prev,
            {
              id: `${selectedUnitId}-delivery-${Date.now()}`,
              ...rule,
            },
          ];
        });
      },
      updateDeliveryRule: async (ruleId, patch) => {
        setDeliveryRules((prev) =>
          prev.map((rule) =>
            rule.id === ruleId
              ? {
                  ...rule,
                  ...patch,
                }
              : rule,
          ),
        );
        if (isSupabaseConfigured) {
          try {
            await updateSupabaseDeliveryRule(ruleId, patch);
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao atualizar regra de entrega", error);
          }
        }
      },
      removeDeliveryRule: async (ruleId) => {
        setDeliveryRules((prev) => prev.filter((rule) => rule.id !== ruleId));
        if (isSupabaseConfigured) {
          try {
            await deleteSupabaseDeliveryRule(ruleId);
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao remover regra de entrega", error);
          }
        }
      },
      toggleDeliveryRule: async (ruleId) => {
        const rule = allDeliveryRules.find((item) => item.id === ruleId);
        if (!rule) return;
        const isActive = !rule.isActive;
        setDeliveryRules((prev) =>
          prev.map((rule) => (rule.id === ruleId ? { ...rule, isActive } : rule)),
        );
        if (isSupabaseConfigured) {
          try {
            await updateSupabaseDeliveryRule(ruleId, { isActive });
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao alternar regra de entrega", error);
          }
        }
      },
      saveDeliveryRules: async () => {
        if (isSupabaseConfigured) {
          try {
            await Promise.all(
              allDeliveryRules.map((rule) =>
                updateSupabaseDeliveryRule(rule.id, {
                  maxDistanceKm: rule.maxDistanceKm,
                  estimatedMinutes: rule.estimatedMinutes,
                  deliveryFee: rule.deliveryFee,
                  isActive: rule.isActive,
                }),
              ),
            );
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao salvar regras de entrega", error);
          }
          return;
        }
      },
      addDeliveryNeighborhoodRule: async () => {
        if (!selectedUnitId) return;
        const rule = {
          unitId: selectedUnitId,
          neighborhood: "",
          estimatedMinutes: 60,
          deliveryFee: 0,
          isActive: true,
        };
        if (isSupabaseConfigured) {
          try {
            const saved = await insertSupabaseDeliveryNeighborhoodRule(selectedUnitId, rule);
            setDeliveryNeighborhoodRules((prev) => [...prev, saved]);
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao criar taxa por bairro", error);
          }
          return;
        }
        setDeliveryNeighborhoodRules((prev) => [
          ...prev,
          { id: `${selectedUnitId}-neighborhood-${Date.now()}`, ...rule },
        ]);
      },
      updateDeliveryNeighborhoodRule: async (ruleId, patch) => {
        setDeliveryNeighborhoodRules((prev) =>
          prev.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
        );
        if (isSupabaseConfigured) {
          try {
            await updateSupabaseDeliveryNeighborhoodRule(ruleId, patch);
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao atualizar taxa por bairro", error);
          }
        }
      },
      removeDeliveryNeighborhoodRule: async (ruleId) => {
        setDeliveryNeighborhoodRules((prev) => prev.filter((rule) => rule.id !== ruleId));
        if (isSupabaseConfigured) {
          try {
            await deleteSupabaseDeliveryNeighborhoodRule(ruleId);
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao remover taxa por bairro", error);
          }
        }
      },
      toggleDeliveryNeighborhoodRule: async (ruleId) => {
        const rule = allDeliveryNeighborhoodRules.find((item) => item.id === ruleId);
        if (!rule) return;
        const isActive = !rule.isActive;
        setDeliveryNeighborhoodRules((prev) =>
          prev.map((item) => (item.id === ruleId ? { ...item, isActive } : item)),
        );
        if (isSupabaseConfigured) {
          try {
            await updateSupabaseDeliveryNeighborhoodRule(ruleId, { isActive });
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao alternar taxa por bairro", error);
          }
        }
      },
      saveDeliveryNeighborhoodRules: async () => {
        if (isSupabaseConfigured) {
          try {
            await Promise.all(
              allDeliveryNeighborhoodRules.map((rule) =>
                updateSupabaseDeliveryNeighborhoodRule(rule.id, {
                  neighborhood: rule.neighborhood,
                  estimatedMinutes: rule.estimatedMinutes,
                  deliveryFee: rule.deliveryFee,
                  isActive: rule.isActive,
                }),
              ),
            );
          } catch (error) {
            console.error("[Maximus][Supabase] Falha ao salvar taxas por bairro", error);
          }
        }
      },
      saveDeliverySettlement: (drivers) => {
        if (!selectedUnitId) return;
        const cleanDrivers = drivers
          .map((driver) => ({
            ...driver,
            deliveriesCount: Math.max(0, driver.deliveriesCount),
            totalAmount: Math.max(0, driver.totalAmount),
          }))
          .filter((driver) => driver.deliveriesCount > 0 || driver.totalAmount > 0);
        const now = new Date().toISOString();
        setDeliverySettlements((prev) => [
          {
            id: `${selectedUnitId}-settlement-${Date.now()}`,
            unitId: selectedUnitId,
            settlementDate: now.slice(0, 10),
            drivers: cleanDrivers,
            totalDeliveries: cleanDrivers.reduce((sum, driver) => sum + driver.deliveriesCount, 0),
            totalAmount: cleanDrivers.reduce((sum, driver) => sum + driver.totalAmount, 0),
            status: "paid",
            createdAt: now,
            updatedAt: now,
          },
          ...prev,
        ]);
      },
      addUser: () => {
        console.warn("[Maximus][Supabase] Cadastro de usuários aguarda tabela/perfis no Supabase.");
      },
      updateUser: () => {
        console.warn(
          "[Maximus][Supabase] Atualização de usuários aguarda tabela/perfis no Supabase.",
        );
      },
      toggleUser: () => {
        console.warn(
          "[Maximus][Supabase] Alternância de usuários aguarda tabela/perfis no Supabase.",
        );
      },
    };
  }, [
    allCategories,
    allCouriers,
    allDeliveryNeighborhoodRules,
    allDeliveryRules,
    allDeliverySettlements,
    allOrders,
    allProducts,
    allTables,
    allUnits,
    allUsers,
    authError,
    dataError,
    isLoading,
    selectedUnitId,
  ]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin deve ser usado dentro de AdminProvider");
  return ctx;
}

export function useDashboardStats(orders: Order[]) {
  return useMemo(() => {
    const active = orders.filter((o) => !isFinalStatus(o.status));
    const finished = orders.filter((o) => isFinalStatus(o.status));
    const awaitingPayment = orders.filter((o) => o.paymentStatus === "customer_reported_paid");
    const salesToday = orders.reduce((sum, o) => sum + o.total, 0);
    const deliveryFees = orders.reduce(
      (sum, o) => sum + (o.deliveryFeeSnapshot ?? o.delivery_fee_snapshot ?? o.deliveryFee ?? 0),
      0,
    );
    const driverPayout = orders.reduce((sum, o) => sum + resolveDeliveryPayout(o, []), 0);
    const ticket = orders.length ? salesToday / orders.length : 0;

    const counts = new Map<string, number>();
    for (const o of orders) {
      for (const it of o.items) {
        counts.set(it.name, (counts.get(it.name) ?? 0) + it.quantity);
      }
    }
    const topProducts = [...counts.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      salesToday,
      activeCount: active.length,
      finishedCount: finished.length,
      ticket,
      deliveryFees,
      driverPayout,
      awaitingPaymentCount: awaitingPayment.length,
      topProducts,
    };
  }, [orders]);
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function elapsedMinutes(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

export function formatElapsed(iso: string): string {
  const minutes = elapsedMinutes(iso);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export type UrgencyLevel = "normal" | "attention" | "late";

export function getUrgencyLevel(iso: string): UrgencyLevel {
  const minutes = elapsedMinutes(iso);
  if (minutes > 20) return "late";
  if (minutes >= 10) return "attention";
  return "normal";
}

export function itemCount(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

export function isPaymentPending(order: Order): boolean {
  return order.paymentMethod === "pix_app" && order.paymentStatus === "customer_reported_paid";
}

export function isPaymentBlocked(order: Order): boolean {
  return order.paymentStatus !== "confirmed";
}

export function getReadyStatus(type: OrderType): OrderStatus {
  return type === "delivery" || type === "mesa" ? "ready" : "ready_for_pickup";
}

export function orderLocation(order: Order): string {
  if (order.type === "mesa" && order.tableNumber != null)
    return `Mesa ${String(order.tableNumber).padStart(2, "0")}`;
  if (order.type === "delivery") return "Delivery";
  if (order.type === "levar") return "Levar";
  return "Balcão";
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix_app: "Pix app",
  pix_balcao: "Pix balcão",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
};
