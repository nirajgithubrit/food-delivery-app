/**
 * After `ng build`, inject the correct API base into index.html for branding-boot.js.
 * Usage: node scripts/write-gg-api-meta.mjs production|dev
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PROFILES = {
  production: "https://gir-gamthi-online-order.onrender.com/api",
  dev: "https://food-delivery-app-dev.onrender.com/api",
};

const profile = process.argv[2] || "production";
const apiUrl = (process.env.GG_API_URL || PROFILES[profile] || PROFILES.production).replace(
  /\/+$/,
  "",
);

const indexPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../dist/frontend/browser/index.html",
);

if (!existsSync(indexPath)) {
  console.error("[write-gg-api-meta] Missing:", indexPath);
  process.exit(1);
}

let html = readFileSync(indexPath, "utf8");

const runtimeSnippet = `<script>window.__GG_API_BASE__="${apiUrl}";</script>`;
if (html.includes("window.__GG_API_BASE__")) {
  html = html.replace(
    /<script>window\.__GG_API_BASE__="[^"]*";<\/script>/,
    runtimeSnippet,
  );
} else {
  html = html.replace(
    '<script src="branding-boot.js"></script>',
    `${runtimeSnippet}\n    <script src="branding-boot.js"></script>`,
  );
}

if (html.includes('name="gg-api-url"')) {
  html = html.replace(
    /<meta name="gg-api-url"[^>]*\/?>/,
    `<meta name="gg-api-url" content="${apiUrl}"/>`,
  );
} else {
  html = html.replace(
    "<head>",
    `<head>\n    <meta name="gg-api-url" content="${apiUrl}"/>`,
  );
}

writeFileSync(indexPath, html);
console.log("[write-gg-api-meta]", profile, "→", apiUrl);
