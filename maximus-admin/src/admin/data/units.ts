import type {
  AdminUnit,
  DriverPanelSettings,
  KitchenPrintSettings,
  WhatsappMessageSettings,
} from "./types";

const emptyHours: AdminUnit["businessHours"] = [
  { day: "segunda", open: false, periods: [] },
  { day: "terca", open: false, periods: [] },
  { day: "quarta", open: false, periods: [] },
  { day: "quinta", open: false, periods: [] },
  { day: "sexta", open: false, periods: [] },
  { day: "sabado", open: false, periods: [] },
  { day: "domingo", open: false, periods: [] },
];

const defaultKitchenPrintSettings: KitchenPrintSettings = {
  autoPrintEnabled: false,
  printerName: "Cozinha",
  printerIp: "",
  printerPort: 9100,
  printerType: "escpos",
  copies: 1,
};

const defaultWhatsappSettings: WhatsappMessageSettings = {
  enabled: false,
  officialNumber: "(93) 984057229",
  receivedMessage: "Recebemos seu pedido na Maximus. Em breve nossa equipe vai confirmar.",
  acceptedMessage: "Seu pedido foi aceito e já entrou no fluxo da Maximus.",
  productionMessage: "Seu pedido está em produção.",
  readyMessage: "Seu pedido está pronto.",
  outForDeliveryMessage: "Seu pedido saiu para entrega.",
  deliveredMessage: "Pedido entregue. Obrigado por comprar com a Maximus.",
};

const defaultDriverPanelSettings: DriverPanelSettings = {
  enabled: false,
};

export const UNITS: AdminUnit[] = [
  {
    id: "maximus-01",
    name: "Maximus Santíssimo",
    phone: "(93) 984057229",
    address: "Av. Altamira, 188 - Santíssimo, Santarém - PA, 68010-510",
    latitude: -2.4314308,
    longitude: -54.7090428,
    isOpen: true,
    businessHours: emptyHours,
    theme: "light",
    accessPin: "0101",
    kitchenPrintSettings: defaultKitchenPrintSettings,
    whatsappSettings: defaultWhatsappSettings,
    driverPanelSettings: defaultDriverPanelSettings,
  },
  {
    id: "maximus-02",
    name: "Maximus 02",
    phone: "(93) 984193005",
    address: "Av. Sérgio Henn, 1 - Floresta, Santarém - PA, 68025-000",
    latitude: -2.4544953,
    longitude: -54.7148729,
    isOpen: true,
    businessHours: emptyHours,
    theme: "light",
    accessPin: "0202",
    kitchenPrintSettings: defaultKitchenPrintSettings,
    whatsappSettings: { ...defaultWhatsappSettings, officialNumber: "(93) 984193005" },
    driverPanelSettings: defaultDriverPanelSettings,
  },
];
