const Restaurant = require("../models/restaurant");
const config = require("../config");

/**
 * Primary restaurant for single-tenant customer orders.
 * Prefers first active row in Mongo; falls back to legacy env config.
 */
async function getPrimaryRestaurantSnapshot() {
  const r = await Restaurant.findOne({ isActive: { $ne: false } })
    .sort({ createdAt: 1 })
    .lean();

  if (r) {
    return {
      id: r._id,
      lat: r.location?.lat ?? config.restaurant.lat,
      lng: r.location?.lng ?? config.restaurant.lng,
      name: r.name,
      phone: r.contactPhone || config.restaurant.phone,
    };
  }

  return {
    id: null,
    lat: config.restaurant.lat,
    lng: config.restaurant.lng,
    name: config.restaurant.name,
    phone: config.restaurant.phone,
  };
}

module.exports = { getPrimaryRestaurantSnapshot };
