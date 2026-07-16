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
  botEnabled: false,
  officialNumber: "",
};

const defaultDriverPanelSettings: DriverPanelSettings = {
  enabled: false,
};

export const UNITS: AdminUnit[] = [
  {
    id: "maximus-01",
    name: "Maximus Santíssimo",
    phone: "",
    address: "Av. Altamira, 188 - Santíssimo, Santarém - PA, 68010-510",
    latitude: -2.4314308,
    longitude: -54.7090428,
    isOpen: true,
    businessHours: emptyHours,
    theme: "light",
    kitchenPrintSettings: defaultKitchenPrintSettings,
    whatsappSettings: defaultWhatsappSettings,
    driverPanelSettings: defaultDriverPanelSettings,
  },
];
