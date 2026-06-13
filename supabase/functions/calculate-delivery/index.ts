const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DeliveryRequest = {
  delivery_lat?: number | string | null;
  delivery_lng?: number | string | null;
  delivery_address?: string | null;
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
    delivery_rules?: Array<{
      id?: string | null;
      max_distance_km?: number | string | null;
      estimated_minutes?: number | string | null;
      delivery_fee?: number | string | null;
      active?: boolean | null;
    }> | null;
  }> | null;
};

type UnitPayload = NonNullable<DeliveryRequest["units"]>[number];

const DISTANCE_MULTIPLIER = 1.35;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

function errorResponse(error: string, details?: unknown) {
  return jsonResponse({ ok: false, error, details: details ?? null }, 200);
}

function asNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
    Math.sin(latDistance / 2) ** 2 +
    Math.cos(toRadians(origin.latitude)) *
      Math.cos(toRadians(destination.latitude)) *
      Math.sin(lonDistance / 2) ** 2;
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getActiveRange(unit: UnitPayload, distanceKm: number) {
  const activeRules = (unit.delivery_rules ?? [])
    .filter((rule) => rule.active !== false)
    .map((rule) => ({
      id: clean(rule.id) || null,
      maxDistanceKm: asNumber(rule.max_distance_km),
      estimatedMinutes: asNumber(rule.estimated_minutes),
      deliveryFee: asNumber(rule.delivery_fee),
    }))
    .filter(
      (
        rule,
      ): rule is {
        id: string | null;
        maxDistanceKm: number;
        estimatedMinutes: number;
        deliveryFee: number;
      } =>
        rule.maxDistanceKm != null &&
        rule.estimatedMinutes != null &&
        rule.deliveryFee != null,
    )
    .sort((a, b) => a.maxDistanceKm - b.maxDistanceKm);

  return activeRules.find((rule) => distanceKm <= rule.maxDistanceKm) ?? null;
}

function hasActiveRanges(unit: UnitPayload) {
  return Boolean(
    (unit.delivery_rules ?? []).some((rule) => rule.active !== false),
  );
}

function calculateFallbackFee(
  unit: UnitPayload,
  distanceKm: number,
  subtotal: number,
) {
  const baseFee = asNumber(unit.base_delivery_fee) ?? 0;
  const perKm = asNumber(unit.delivery_fee_per_km) ?? 0;
  const freeDeliveryFrom = asNumber(unit.free_delivery_from) ?? 0;
  if (freeDeliveryFrom > 0 && subtotal >= freeDeliveryFrom) return 0;
  return Number((baseFee + distanceKm * perKm).toFixed(2));
}

function calculateBestUnit(
  units: UnitPayload[],
  destination: { latitude: number; longitude: number },
  subtotal: number,
) {
  const openUnits = units.filter((unit) => unit.is_open !== false);
  if (!openUnits.length) {
    return { error: "Nenhuma unidade aberta atende este local de entrega." };
  }

  const candidates = [];
  for (const unit of openUnits) {
    const latitude = asNumber(unit.latitude);
    const longitude = asNumber(unit.longitude);
    if (latitude == null || longitude == null || !unit.id) continue;

    const straightDistanceKm = Number(
      getStraightDistanceKm({ latitude, longitude }, destination).toFixed(2),
    );
    const distanceKm = Number(
      (straightDistanceKm * DISTANCE_MULTIPLIER).toFixed(2),
    );
    const maxDistanceKm = asNumber(unit.max_delivery_distance_km) ?? 0;
    const minimumOrderValue = asNumber(unit.minimum_order_value) ?? 0;
    const range = getActiveRange(unit, distanceKm);

    if (hasActiveRanges(unit) && !range) {
      candidates.push({
        unit,
        straightDistanceKm,
        distanceKm,
        maxDistanceKm,
        minimumOrderValue,
        deliveryFee: null,
        estimatedMinutes: null,
        deliveryRangeId: null,
        blockedByRange: true,
      });
      continue;
    }

    const deliveryFee = range
      ? range.deliveryFee
      : calculateFallbackFee(unit, distanceKm, subtotal);

    candidates.push({
      unit,
      straightDistanceKm,
      distanceKm,
      maxDistanceKm,
      minimumOrderValue,
      deliveryFee,
      estimatedMinutes: range?.estimatedMinutes ?? null,
      deliveryRangeId: range?.id ?? null,
      blockedByRange: false,
    });
  }

  candidates.sort((a, b) => a.distanceKm - b.distanceKm);
  const nearest = candidates[0];
  if (!nearest) {
    return { error: "Nenhuma unidade aberta atende este local de entrega." };
  }
  if (nearest.maxDistanceKm > 0 && nearest.distanceKm > nearest.maxDistanceKm) {
    return { error: "Este local está fora da área de entrega." };
  }
  if (nearest.blockedByRange || nearest.deliveryFee == null) {
    return { error: "Este endereço está fora da área de entrega." };
  }

  return {
    unit: nearest.unit,
    straightDistanceKm: nearest.straightDistanceKm,
    distanceKm: nearest.distanceKm,
    durationMinutes: nearest.estimatedMinutes,
    deliveryFee: nearest.deliveryFee,
    deliveryRangeId: nearest.deliveryRangeId,
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
    const payload = (await req.json()) as DeliveryRequest;
    const subtotal = asNumber(payload.subtotal) ?? 0;
    const deliveryLat = asNumber(payload.delivery_lat);
    const deliveryLng = asNumber(payload.delivery_lng);

    console.info("[calculate-delivery] payload", {
      hasUnits: Boolean(payload.units?.length),
      hasCoordinates: deliveryLat != null && deliveryLng != null,
      deliveryLat,
      deliveryLng,
      subtotal,
      rawAddress: clean(payload.delivery_address) || null,
      method: "coordinates_haversine",
    });

    if (deliveryLat == null || deliveryLng == null) {
      return errorResponse(
        "Confirme o local da entrega pelo GPS ou marque no mapa.",
      );
    }

    if (!payload.units?.length) {
      return errorResponse("Nenhuma unidade enviada para calcular entrega.");
    }

    const best = calculateBestUnit(
      payload.units,
      { latitude: deliveryLat, longitude: deliveryLng },
      subtotal,
    );
    if ("error" in best) return errorResponse(best.error);

    console.info("[calculate-delivery] resultado", {
      method: "coordinates_haversine",
      deliveryLat,
      deliveryLng,
      unitId: best.unit.id,
      unitName: best.unit.name ?? "",
      straightDistanceKm: best.straightDistanceKm,
      distanceMultiplier: DISTANCE_MULTIPLIER,
      distanceKm: best.distanceKm,
      deliveryFee: best.deliveryFee,
      deliveryRangeId: best.deliveryRangeId,
    });

    return jsonResponse({
      ok: true,
      delivery_lat: deliveryLat,
      delivery_lng: deliveryLng,
      raw_address: clean(payload.delivery_address) || null,
      unit_id: best.unit.id,
      unit_name: best.unit.name ?? "",
      straight_distance_km: best.straightDistanceKm,
      distance_multiplier: DISTANCE_MULTIPLIER,
      distance_km: best.distanceKm,
      duration_minutes: best.durationMinutes,
      delivery_fee: best.deliveryFee,
      delivery_range_id: best.deliveryRangeId,
      minimum_order_value: best.minimumOrderValue,
      total: best.total,
      error: null,
    });
  } catch (error) {
    console.error("[calculate-delivery] erro", error);
    return errorResponse(
      "Erro ao calcular entrega. Tente novamente.",
      error instanceof Error ? error.message : String(error),
    );
  }
});
