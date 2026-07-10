export type GoogleMapsLatLng = { latitude: number; longitude: number };

export type NormalizedGoogleAddress = {
  formattedAddress: string;
  street: string;
  number: string;
  neighborhood: string;
  areaCandidates: string[];
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
};

type GoogleMapsWindow = Window & {
  __maximusGoogleMapsInit?: () => void;
  gm_authFailure?: () => void;
  google?: {
    maps: {
      Map: new (element: HTMLElement, options: Record<string, unknown>) => unknown;
      Marker: new (options: Record<string, unknown>) => {
        setPosition: (position: { lat: number; lng: number }) => void;
        addListener: (eventName: string, callback: (...args: unknown[]) => void) => void;
      };
      Geocoder: new () => {
        geocode: (
          request: Record<string, unknown>,
          callback: (results: GoogleGeocoderResult[] | null, status: string) => void,
        ) => void;
      };
      event: {
        clearInstanceListeners: (instance: unknown) => void;
      };
    };
  };
};

type GoogleGeocoderResult = {
  formatted_address?: string;
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
  };
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
};

let mapsPromise: Promise<void> | null = null;
const googleMapsAuthError =
  "Google Maps recusou a chave. Verifique se a Maps JavaScript API está ativa, com faturamento habilitado e se localhost/127.0.0.1 estão liberados nos referers.";

export function getGoogleMapsApiKey() {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
}

export function loadGoogleMapsScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("Mapa indisponível."));
  if ((window as GoogleMapsWindow).google?.maps) return Promise.resolve();
  const key = getGoogleMapsApiKey();
  if (!key) return Promise.reject(new Error("Chave do Google Maps não configurada."));
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps]");
    if (existing) {
      if ((window as GoogleMapsWindow).google?.maps) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar Google Maps.")), {
        once: true,
      });
      return;
    }

    const mapsWindow = window as GoogleMapsWindow;
    const previousAuthFailure = mapsWindow.gm_authFailure;
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      delete mapsWindow.__maximusGoogleMapsInit;
      mapsWindow.gm_authFailure = previousAuthFailure;
      callback();
    };
    const timeout = window.setTimeout(() => {
      finish(() => reject(new Error("Tempo esgotado ao carregar Google Maps.")));
    }, 15000);

    mapsWindow.__maximusGoogleMapsInit = () => {
      finish(() => resolve());
    };
    mapsWindow.gm_authFailure = () => {
      previousAuthFailure?.();
      finish(() => reject(new Error(googleMapsAuthError)));
    };

    const script = document.createElement("script");
    script.dataset.googleMaps = "true";
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key,
    )}&callback=__maximusGoogleMapsInit&loading=async&v=weekly`;
    script.onerror = () => {
      finish(() => reject(new Error("Falha ao carregar Google Maps.")));
    };
    document.head.appendChild(script);
  });

  return mapsPromise;
}

export async function geocodeAddress(address: string) {
  await loadGoogleMapsScript();
  return geocode({ address });
}

export async function reverseGeocodeLatLng(latitude: number, longitude: number) {
  await loadGoogleMapsScript();
  return geocode({ location: { lat: latitude, lng: longitude } });
}

export function getCurrentLocation(): Promise<GoogleMapsLatLng> {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("Geolocalização indisponível neste navegador."));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => reject(new Error("Não conseguimos acessar sua localização.")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  });
}

export function normalizeAddressComponents(result: GoogleGeocoderResult): NormalizedGoogleAddress {
  const get = (...types: string[]) => {
    const component = result.address_components?.find((item) =>
      types.some((type) => item.types.includes(type)),
    );
    return component?.long_name ?? "";
  };
  const candidates = [
    "neighborhood",
    "sublocality",
    "sublocality_level_1",
    "sublocality_level_2",
    "administrative_area_level_4",
    "administrative_area_level_3",
    "administrative_area_level_2",
    "locality",
  ]
    .map((type) => get(type))
    .filter((value, index, list): value is string => Boolean(value && list.indexOf(value) === index));
  const location = result.geometry?.location;
  return {
    formattedAddress: result.formatted_address ?? "",
    street: get("route"),
    number: get("street_number"),
    neighborhood: candidates[0] ?? "",
    areaCandidates: candidates,
    city: get("administrative_area_level_2", "locality"),
    state: get("administrative_area_level_1"),
    postalCode: get("postal_code"),
    latitude: location?.lat() ?? 0,
    longitude: location?.lng() ?? 0,
  };
}

async function geocode(request: Record<string, unknown>) {
  const maps = (window as GoogleMapsWindow).google?.maps;
  if (!maps) throw new Error("Google Maps não carregado.");
  const geocoder = new maps.Geocoder();
  return new Promise<NormalizedGoogleAddress | null>((resolve, reject) => {
    geocoder.geocode(request, (results, status) => {
      if (status !== "OK") {
        if (status === "ZERO_RESULTS") resolve(null);
        else reject(new Error("Não foi possível buscar o endereço."));
        return;
      }
      const first = results?.[0];
      resolve(first ? normalizeAddressComponents(first) : null);
    });
  });
}

export function getGoogleMaps() {
  return (window as GoogleMapsWindow).google?.maps;
}
