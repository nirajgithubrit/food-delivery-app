/**
 * Normalize customer delivery address from place-order payload.
 * @param {unknown} raw
 */
function normalizeDeliveryAddressInput(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const fullAddress = String(o.fullAddress ?? "").trim();
  const latitude = Number(o.latitude);
  const longitude = Number(o.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  if (fullAddress.length < 5) return null;

  const at = String(o.addressType ?? "other").toLowerCase();
  const addressType = ["home", "office", "other"].includes(at) ? at : "other";

  const landmark = o.landmark != null ? String(o.landmark).trim().slice(0, 200) : "";
  const city = o.city != null ? String(o.city).trim().slice(0, 120) : "";
  const state = o.state != null ? String(o.state).trim().slice(0, 120) : "";
  const pincode = o.pincode != null ? String(o.pincode).trim().slice(0, 20) : "";

  return {
    fullAddress: fullAddress.slice(0, 500),
    latitude,
    longitude,
    ...(landmark ? { landmark } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(pincode ? { pincode } : {}),
    addressType,
  };
}

/**
 * Minimal deliveryAddress when only legacy `location` is sent.
 * @param {{ lat: number; lng: number }} loc
 */
function deliveryAddressFromLegacyLocation(loc) {
  return {
    fullAddress: "Delivery location",
    latitude: loc.lat,
    longitude: loc.lng,
    addressType: "other",
  };
}

module.exports = { normalizeDeliveryAddressInput, deliveryAddressFromLegacyLocation };
