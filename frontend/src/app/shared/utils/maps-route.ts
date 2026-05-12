/**
 * iOS “Add to Home Screen” PWAs often miss the first `DirectionsRenderer` paint when the
 * renderer initializes after `importLibrary('routes')`. Drawing `overview_path` with
 * `map-polyline` matches what Directions already computed and is reliable on WKWebView.
 */
export function isIosStandaloneWebApp(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent;
  const isIos =
    /iPhone|iPod/i.test(ua) ||
    /iPad/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  return isIos && standalone;
}

export function directionsOverviewToPath(
  result: google.maps.DirectionsResult | null | undefined,
): google.maps.LatLngLiteral[] {
  const path = result?.routes?.[0]?.overview_path;
  if (!path?.length) return [];
  return path.map((p) => ({ lat: p.lat(), lng: p.lng() }));
}
