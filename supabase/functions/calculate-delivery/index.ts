const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DeliveryRequest = {
  unit_lat?: number | string | null;
  unit_lng?: number | string | null;
  unit_id?: string | null;
  unit_name?: string | null;
  delivery_lat?: number | string | null;
  delivery_lng?: number | string | null;
  delivery_address?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  subtotal?: number | string | null;
  units?: Array<{
    id?: string | null;
    name?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
    is_open?: boolean | null;
    minimum_order_value?: number | string | null;
    base_delivery_fee?: number | string | null;
    delivery_fee_per_km?: number | string | null;
    max_delivery_distance_km?: number | string | null;
    free_delivery_from?: number | string | null;
  }> | null;
};

type DeliveryUnitPayload = NonNullable<DeliveryRequest["units"]>[number];

type OrsFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    label?: string;
    name?: string;
    confidence?: number;
    layer?: string;
  };
};

const SANTAREM_FOCUS = {
  latitude: -2.443,
  longitude: -54.712,
  radiusKm: 50,
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

function errorResponse(error: string) {
  return jsonResponse({ ok: false, error });
}

function asNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stateName(value: string) {
  return !value || value.toUpperCase() === "PA" ? "Pará" : value;
}

function getStraightDistanceKm(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latDistance = toRadians(destination.latitude - origin.latitude);
  const lonDistance = toRadians(destination.longitude - origin.longitude);
  const a =
    Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
    Math.cos(toRadians(origin.latitude)) *
      Math.cos(toRadians(destination.latitude)) *
      Math.sin(lonDistance / 2) *
      Math.sin(lonDistance / 2);
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function buildAddressAttempts(payload: DeliveryRequest) {
  const street = clean(payload.street);
  const number = clean(payload.number);
  const neighborhood = clean(payload.neighborhood);
  const city = clean(payload.city) || "Santarém";
  const state = stateName(clean(payload.state));
  const zip = clean(payload.zip);
  const deliveryAddress = clean(payload.delivery_address);
  const fullAddress = [street, number, neighborhood, city, state, "Brasil"]
    .filter(Boolean)
    .join(", ");

  return [
    deliveryAddress
      ? { reason: "delivery_address", query: deliveryAddress }
      : null,
    fullAddress ? { reason: "endereco_completo", query: fullAddress } : null,
    zip
      ? {
          reason: "com_cep",
          query: [street, number, neighborhood, city, state, zip, "Brasil"]
            .filter(Boolean)
            .join(", "),
        }
      : null,
    street && number
      ? {
          reason: "sem_bairro",
          query: [street, number, city, state, "Brasil"]
            .filter(Boolean)
            .join(", "),
        }
      : null,
    street
      ? {
          reason: "sem_numero",
          query: [street, neighborhood, city, state, "Brasil"]
            .filter(Boolean)
            .join(", "),
        }
      : null,
  ].filter((attempt): attempt is { reason: string; query: string } =>
    Boolean(attempt?.query),
  );
}

async function geocodeAddress(apiKey: string, payload: DeliveryRequest) {
  const attempts = buildAddressAttempts(payload);
  console.info("[calculate-delivery][geocode] tentativas", attempts);

  for (const attempt of attempts) {
    const url = new URL("https://api.openrouteservice.org/geocode/search");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("text", attempt.query);
    url.searchParams.set("boundary.country", "BR");
    url.searchParams.set(
      "boundary.circle.lat",
      String(SANTAREM_FOCUS.latitude),
    );
    url.searchParams.set(
      "boundary.circle.lon",
      String(SANTAREM_FOCUS.longitude),
    );
    url.searchParams.set(
      "boundary.circle.radius",
      String(SANTAREM_FOCUS.radiusKm),
    );
    url.searchParams.set("focus.point.lat", String(SANTAREM_FOCUS.latitude));
    url.searchParams.set("focus.point.lon", String(SANTAREM_FOCUS.longitude));
    url.searchParams.set("size", "3");

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    const result = await response.json();
    console.info("[calculate-delivery][geocode] resposta", {
      reason: attempt.reason,
      query: attempt.query,
      status: response.status,
      result,
    });

    if (!response.ok) {
      throw new Error(`OpenRouteService geocode falhou: ${response.status}`);
    }

    const feature = (result.features as OrsFeature[] | undefined)?.find(
      (candidate) => {
        const [longitude, latitude] = candidate.geometry?.coordinates ?? [];
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
          return false;
        return (
          getStraightDistanceKm(SANTAREM_FOCUS, { latitude, longitude }) <=
          SANTAREM_FOCUS.radiusKm
        );
      },
    );

    const [longitude, latitude] = feature?.geometry?.coordinates ?? [];
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return {
        latitude,
        longitude,
        rawAddress:
          feature?.properties?.label ??
          feature?.properties?.name ??
          attempt.query,
      };
    }
  }

  return null;
}

async function calculateRoute(
  apiKey: string,
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
) {
  const url = new URL(
    "https://api.openrouteservice.org/v2/directions/driving-car",
  );
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("start", `${origin.longitude},${origin.latitude}`);
  url.searchParams.set(
    "end",
    `${destination.longitude},${destination.latitude}`,
  );

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  const result = await response.json();
  console.info("[calculate-delivery][directions] resposta", {
    status: response.status,
    origin,
    destination,
    result,
  });

  if (!response.ok) {
    throw new Error(`OpenRouteService directions falhou: ${response.status}`);
  }

  const summary =
    result.features?.[0]?.properties?.summary ?? result.routes?.[0]?.summary;
  const distanceMeters = Number(summary?.distance);
  if (!Number.isFinite(distanceMeters)) {
    throw new Error("OpenRouteService não retornou distância da rota.");
  }

  return {
    distanceKm: Number((distanceMeters / 1000).toFixed(2)),
    durationMinutes: Number.isFinite(summary?.duration)
      ? Number((Number(summary.duration) / 60).toFixed(0))
      : null,
  };
}

function calculateFee(
  unit: DeliveryUnitPayload,
  distanceKm: number,
  subtotal: number,
) {
  const baseFee = asNumber(unit.base_delivery_fee) ?? 0;
  const perKm = asNumber(unit.delivery_fee_per_km) ?? 0;
  const freeDeliveryFrom = asNumber(unit.free_delivery_from) ?? 0;
  if (freeDeliveryFrom > 0 && subtotal >= freeDeliveryFrom) return 0;
  return Number((baseFee + distanceKm * perKm).toFixed(2));
}

async function calculateBestUnit(
  apiKey: string,
  units: DeliveryUnitPayload[],
  destination: { latitude: number; longitude: number },
  subtotal: number,
) {
  const openUnits = units.filter((unit) => unit.is_open !== false);
  if (!openUnits.length) {
    return { error: "Nenhuma unidade aberta atende este endereço." };
  }

  const candidates = await Promise.all(
    openUnits.map(async (unit) => {
      const latitude = asNumber(unit.latitude);
      const longitude = asNumber(unit.longitude);
      if (latitude == null || longitude == null || !unit.id) return null;
      const route = await calculateRoute(
        apiKey,
        { latitude, longitude },
        destination,
      );
      const maxDistanceKm = asNumber(unit.max_delivery_distance_km) ?? 0;
      const minimumOrderValue = asNumber(unit.minimum_order_value) ?? 0;
      const deliveryFee = calculateFee(unit, route.distanceKm, subtotal);
      return {
        unit,
        route,
        maxDistanceKm,
        minimumOrderValue,
        deliveryFee,
      };
    }),
  );
  const validCandidates = candidates
    .filter((candidate): candidate is NonNullable<typeof candidate> =>
      Boolean(candidate),
    )
    .sort((a, b) => a.route.distanceKm - b.route.distanceKm);

  const nearest = validCandidates[0];
  if (!nearest)
    return { error: "Nenhuma unidade aberta atende este endereço." };
  if (
    nearest.maxDistanceKm > 0 &&
    nearest.route.distanceKm > nearest.maxDistanceKm
  ) {
    return { error: "Este endereço está fora da área de entrega." };
  }

  return {
    unit: nearest.unit,
    distanceKm: nearest.route.distanceKm,
    durationMinutes: nearest.route.durationMinutes,
    deliveryFee: nearest.deliveryFee,
    minimumOrderValue: nearest.minimumOrderValue,
    total: Number((subtotal + nearest.deliveryFee).toFixed(2)),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Método não permitido.");
  }

  try {
    const apiKey = Deno.env.get("OPENROUTESERVICE_API_KEY");
    if (!apiKey) {
      return errorResponse(
        "OPENROUTESERVICE_API_KEY não configurada no Supabase.",
      );
    }

    const payload = (await req.json()) as DeliveryRequest;
    const subtotal = asNumber(payload.subtotal) ?? 0;

    let deliveryLat = asNumber(payload.delivery_lat);
    let deliveryLng = asNumber(payload.delivery_lng);
    let rawAddress = clean(payload.delivery_address) || null;

    if (deliveryLat == null || deliveryLng == null) {
      const geocoded = await geocodeAddress(apiKey, payload);
      if (!geocoded) {
        return errorResponse("Não conseguimos localizar este endereço.");
      }
      deliveryLat = geocoded.latitude;
      deliveryLng = geocoded.longitude;
      rawAddress = geocoded.rawAddress;
    }

    if (payload.units?.length) {
      const best = await calculateBestUnit(
        apiKey,
        payload.units,
        { latitude: deliveryLat, longitude: deliveryLng },
        subtotal,
      );
      if ("error" in best) return errorResponse(best.error);
      return jsonResponse({
        ok: true,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
        unit_id: best.unit.id,
        unit_name: best.unit.name ?? "",
        distance_km: best.distanceKm,
        duration_minutes: best.durationMinutes,
        delivery_fee: best.deliveryFee,
        minimum_order_value: best.minimumOrderValue,
        total: best.total,
        raw_address: rawAddress,
        error: null,
      });
    }

    const unitLat = asNumber(payload.unit_lat);
    const unitLng = asNumber(payload.unit_lng);
    if (unitLat == null || unitLng == null) {
      return errorResponse("Coordenadas da unidade inválidas.");
    }

    const route = await calculateRoute(
      apiKey,
      { latitude: unitLat, longitude: unitLng },
      { latitude: deliveryLat, longitude: deliveryLng },
    );

    return jsonResponse({
      ok: true,
      delivery_lat: deliveryLat,
      delivery_lng: deliveryLng,
      unit_id: payload.unit_id ?? null,
      unit_name: payload.unit_name ?? null,
      distance_km: route.distanceKm,
      duration_minutes: route.durationMinutes,
      delivery_fee: null,
      minimum_order_value: null,
      total: null,
      raw_address: rawAddress,
      error: null,
    });
  } catch (error) {
    console.error("[calculate-delivery] erro", error);
    return errorResponse(
      error instanceof Error
        ? error.message
        : "Erro ao calcular entrega. Tente novamente.",
    );
  }
});
