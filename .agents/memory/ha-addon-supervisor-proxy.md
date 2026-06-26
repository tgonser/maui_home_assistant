---
name: HA add-on supervisor proxy gotchas
description: Non-obvious requirements for an HA add-on to call the Home Assistant core API via the supervisor proxy (URL construction + config permissions + ingress)
---

# HA add-on → supervisor proxy → HA core API

An HA add-on reaches the Home Assistant core API at `http://supervisor/core` using the
injected `SUPERVISOR_TOKEN`. Three separate things must all be right or it silently breaks:

## 1. Config permissions (the "Unauthorized"/401 cause)
The add-on's `config.yaml` MUST declare:
- `homeassistant_api: true` — authorizes `SUPERVISOR_TOKEN` for `http://supervisor/core/api/*` (REST + WebSocket). Without it HA core returns **401 Unauthorized** even though the request reaches HA.
- `hassio_api: true` — supervisor API access (add-on/system info).

**Why:** the supervisor token is unprivileged by default; permission is opt-in per add-on.

## 2. URL construction — `new URL(...).origin` drops the path
`new URL("http://supervisor/core").origin` === `"http://supervisor"` (the `/core` segment is gone).
Building targets from `.origin` sends calls to `http://supervisor/api/states` (supervisor's own API → wrong)
instead of `http://supervisor/core/api/states` (HA core).
**Fix:** build with `origin + pathname`:
`const basePath = base.pathname === "/" ? "" : base.pathname.replace(/\/$/, ""); target = origin + basePath + path;`
Same bug bites the WebSocket URL → must be `ws://supervisor/core/api/websocket`.

## 3. Ingress version + update detection
HA detects add-on updates by the **`version:` field in config.yaml**, not the image digest.
Bump `version` on EVERY change or HA won't offer/pull the new GHCR image.

## Other ingress notes
- `ingress_entry: /` (a leading-slash value like `/wall` produced `//wall` double-slash).
- Server injects `window.__HA_INGRESS_BASE__` (from `X-Ingress-Path` header) and
  `window.__HA_ADDON__=true` (when `SUPERVISOR_TOKEN` present) into the HTML so the SPA
  auto-connects synchronously without a discovery round-trip.
- Client sends sentinel `url="__supervisor__"`, `token="addon"`; server swaps in the real
  token + `http://supervisor/core`. Real token never reaches the browser.
- Under ingress the app skips Wouter routing entirely and renders the kiosk view directly
  (base-path routing math fought the ingress prefix and 404'd).
