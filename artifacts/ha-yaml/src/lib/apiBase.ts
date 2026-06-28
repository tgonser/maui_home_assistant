/**
 * Returns the base URL for the add-on's own Express API.
 *
 * In HA add-on mode the page is served under an ingress path like
 * /api/hassio_ingress/wall_kiosk/. import.meta.env.BASE_URL is baked in at
 * build time (usually "/") and does NOT reflect the runtime ingress prefix.
 * The server injects window.__HA_INGRESS_BASE__ with the real prefix so
 * API calls are routed through the ingress proxy correctly.
 *
 * In Replit dev mode __HA_INGRESS_BASE__ is undefined and BASE_URL is the
 * artifact's dev path (e.g. "/ha-yaml/"), which already works.
 */
export function getApiBase(): string {
  const ingress = (
    typeof window !== "undefined"
      ? (window as unknown as Record<string, unknown>).__HA_INGRESS_BASE__
      : undefined
  ) as string | undefined;

  const base = ingress != null ? `${ingress}/` : import.meta.env.BASE_URL;
  // Normalise: no double slashes, no trailing slash
  return `${base}api`.replace(/\/+/g, "/").replace(/\/$/, "");
}
