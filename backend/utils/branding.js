const config = require("../config");
const Restaurant = require("../models/restaurant");

const DEFAULT_THEME_COLOR = "#f97316";
const PWA_ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

function cloudinarySized(url, size) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (!raw.includes("res.cloudinary.com") || !raw.includes("/upload/")) {
    return raw;
  }
  const transform = `w_${size},h_${size},c_fill,f_auto,q_auto`;
  return raw.replace("/upload/", `/upload/${transform}/`);
}

function shortName(name) {
  const n = String(name || "").trim();
  if (!n) return "Food";
  return n.length <= 12 ? n : `${n.slice(0, 11)}…`;
}

function staticIconUrl(size) {
  const origin =
    config.publicWebOrigin || config.allowedOrigins[0] || "http://localhost:4200";
  return `${origin}/icons/icon-${size}x${size}.jpg`;
}

async function getBrandingSnapshot() {
  const r = await Restaurant.findOne({ isActive: { $ne: false } })
    .sort({ createdAt: 1 })
    .lean();

  const name = r?.name || config.restaurant.name || "Food Delivery";
  const logoUrl = String(r?.logoUrl || "").trim();

  const icons = {};
  for (const size of PWA_ICON_SIZES) {
    icons[size] = logoUrl ? cloudinarySized(logoUrl, size) : staticIconUrl(size);
  }

  return {
    name,
    shortName: shortName(name),
    logoUrl,
    themeColor: DEFAULT_THEME_COLOR,
    icons,
    icon192: icons[192],
    icon512: icons[512],
  };
}

function buildWebManifest(branding) {
  const icons = PWA_ICON_SIZES.map((size) => ({
    src: branding.icons[size],
    sizes: `${size}x${size}`,
    type: "image/png",
    purpose: "maskable any",
  }));

  return {
    name: branding.name,
    short_name: branding.shortName,
    theme_color: branding.themeColor,
    background_color: "#fafafa",
    display: "standalone",
    scope: "./",
    start_url: "./",
    icons,
  };
}

module.exports = {
  DEFAULT_THEME_COLOR,
  PWA_ICON_SIZES,
  cloudinarySized,
  getBrandingSnapshot,
  buildWebManifest,
  staticIconUrl,
};
