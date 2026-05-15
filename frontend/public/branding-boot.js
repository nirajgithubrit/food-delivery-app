/**
 * Runs before Angular bootstraps: applies cached branding to the inline splash,
 * then fetches latest branding from the API.
 */
(function () {
  var STORAGE_KEY = "gg_branding_v1";
  var DEFAULT_ICON = "icons/icon-192x192.jpg";

  function apiBase() {
    var meta = document.querySelector('meta[name="gg-api-url"]');
    if (meta && meta.getAttribute("content")) {
      return meta.getAttribute("content").replace(/\/+$/, "");
    }
    var host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:3000/api";
    }
    return "https://gir-gamthi-online-order.onrender.com/api";
  }

  function applyToSplash(b) {
    if (!b || typeof b !== "object") return;
    var icon = b.icon192 || b.logoUrl || DEFAULT_ICON;
    var name = b.name || "";
    var img = document.querySelector("#app-boot-splash .boot-splash-logo");
    var title = document.querySelector("#app-boot-splash [data-boot-title]");
    if (img && icon) {
      img.src = icon;
      img.alt = name;
    }
    if (title && name) {
      title.textContent = name;
    }
    if (b.themeColor) {
      var theme = document.querySelector('meta[name="theme-color"]');
      if (theme) theme.setAttribute("content", b.themeColor);
    }
  }

  function persist(b) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
    } catch (e) {
      /* ignore */
    }
  }

  function unwrap(body) {
    if (body && body.success === true && body.data) return body.data;
    return body;
  }

  function fetchBranding() {
    var url = apiBase() + "/restaurant/branding";
    return fetch(url, { credentials: "omit", cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("branding fetch failed");
        return res.json();
      })
      .then(function (body) {
        var data = unwrap(body);
        if (data && data.name) {
          applyToSplash(data);
          persist(data);
        }
        return data;
      });
  }

  function run() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) applyToSplash(JSON.parse(raw));
    } catch (e) {
      /* ignore */
    }
    var p = fetchBranding();
    window.__ggBrandingReady = p.catch(function () {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
