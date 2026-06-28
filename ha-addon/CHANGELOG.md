# Changelog

## 1.0.32

- **Fixed: Entity and room renames instantly reverted in add-on mode** — API save
  calls were being routed to HA's own REST API (`/api/...`) instead of the
  add-on's Express server. Added `getApiBase()` utility that reads the runtime
  ingress path from `window.__HA_INGRESS_BASE__` (injected by the server) so
  alias saves are correctly routed through the HA ingress proxy.

## 1.0.31

- **Room alias propagation** — Renaming a room in the Rooms tab now automatically
  renames every entity tile whose friendly name starts with that room's HA name.
  Example: alias "Bedroom 3" → "Board Room" and all tiles in that room update to
  "Board Room Light", "Board Room Thermostat", etc. Entity-level aliases still
  override per-tile.

## 1.0.30

- **Motion sensor label cleanup** — Strips UniFi camera generation numbers (G5, G6)
  from outside motion labels (e.g. "Entry G6 PTZ" → "Entry PTZ", "G6 Instant" →
  "Instant"). Fixed title-casing so all-lowercase sensor names (e.g. "stairs")
  are now properly capitalized ("Stairs").

## 1.0.29

- **Naming system refactor** — Extracted shared `display.ts` library with canonical
  `friendlyName()`, `motionSensorLabel()`, and `displayName()` functions used
  consistently across all components. Removed duplicate implementations that had
  diverged between Wall.tsx and SuperView.tsx. No visible UI change.

## 1.0.28

- **Vacation presence indicator** — When house mode is Vacation, a dot and label now
  appear in the mode strip: green "Present" when your phone is home (automation
  armed), or grey "Not Present · Nh away" when away. Disappears in all other modes.

## 1.0.27

- **Fixed: Recent Motion tile crash** — MotionRow crashed when the entity alias map
  was undefined on first render. Added safe default so the tile loads correctly
  before aliases finish fetching from the server.

## 1.0.26

- **Entity aliases in Recent Motion tile** — User-assigned entity aliases are now
  applied to inside motion sensor labels in the SuperView Recent Motion panel.

## 1.0.25

- **Recent Motion tile** — Added to SuperView overview. Shows the six most recently
  triggered sensors split into Inside and Outside columns, sorted by last triggered
  time with a live "Xm ago" counter.
- **Vacation guard** — "Owners Home" button in the mode strip is disabled and
  struck-through when house mode is Vacation and your phone has not been home for
  48 hours, preventing accidental mode changes by workers or guests.

## 1.0.24

- **Shade tile labels** — Shade tiles now display their section's room name rather
  than the raw HA entity name, keeping labels consistent with section headers.

## 1.0.23

- **Alias sentinel bypass** — Entity aliases now skip all room-level name transforms
  so user-set names are displayed exactly as entered, without unwanted prefixes.

## 1.0.22

- **Alias persistence in add-on mode** — Entity and room aliases are stored in
  `/data/entity-aliases.json` and `/data/room-aliases.json` when no PostgreSQL
  database is configured, surviving add-on restarts.

## 1.0.21

- **Removed Fans and Locks tabs** — Cleaned up navigation to match the actual
  devices present in the home.

## 1.0.20

- **Samsung Tizen TV remote fix** — Fixed remote commands for 2022+ Samsung TVs;
  switched from the deprecated `play_media send_key` path to `remote.send_command`
  which HA returns HTTP 200 for even when the old path silently fails.

## 1.0.19

- **Duplicate entity disambiguation** — Entities that share a friendly name across
  integrations (HA appends `_2`, `_3` suffixes) are now resolved correctly in room
  grouping and sibling lookups.

## 1.0.18

- **Bluesound/Sonos group slave fix** — Slave/grouped speakers no longer show idle
  with no metadata. The tile now inherits playback state from the group
  master/leader entity. Removed erroneous unjoin calls that 500'd when the speaker
  was not actually grouped.

## 1.0.17

- **Multi-house climate** — Maui climate tiles now filter by entity ID allowlist
  rather than name prefix, preventing false matches with entities from other
  locations (e.g. mainland thermostat).

## 1.0.16

- **Honeywell TCC rename support** — TCC entities inherit the device name; renaming
  a thermostat now correctly targets the device record in HA rather than the entity.

## 1.0.15

- **Add-on supervisor proxy fix** — Fixed 401 errors on HA core API calls by setting
  `homeassistant_api: true` in config and correcting the origin construction (was
  incorrectly dropping the `/core` path segment).

## 1.0.14

- **Reliable update detection** — `config.yaml` version is now bumped on every
  release so HA's add-on manager correctly detects and offers updates.

## 1.0.13

- **Ingress asset path rewriting** — Fixed Vite-emitted absolute asset paths
  (`/assets/...`) so they carry the HA ingress prefix, preventing 404s for JS/CSS
  under the sidebar panel.

## 1.0.12

- **SPA catch-all route** — Added Express catch-all to serve `index.html` for all
  non-API routes, fixing hard refreshes and direct URL navigation under HA ingress.

## 1.0.11

- **Double-slash URL normalization** — HA ingress can produce `//wall`-style paths;
  the server now strips leading double slashes before routing.

## 1.0.10

- **Camera snapshot auto-refresh** — Outside camera images in SuperView now refresh
  every 15 seconds without a manual reload.

## 1.0.9

- **Energy chart accuracy** — Hourly cost calculation corrected to use HA long-term
  statistics for grid import/export rather than instantaneous sensor readings.

## 1.0.8

- **Auto-connect in add-on mode** — Kiosk no longer shows the connect dialog when
  running as an add-on; credentials are sourced from `SUPERVISOR_TOKEN`
  server-side automatically on startup.

## 1.0.7

- **Watchdog health check** — Added `/api/healthz` endpoint used by both the Docker
  `HEALTHCHECK` instruction and HA's add-on watchdog.

## 1.0.6

- **SUPERVISOR_TOKEN security** — Long-lived HA token is consumed server-side only;
  the browser never receives or stores it.

## 1.0.5

- **Auto-reconnect** — WebSocket connection to HA automatically reconnects on drop
  with exponential back-off.

## 1.0.4

- **Monthly grid cost chart** — Bar chart of monthly electricity cost history using
  HA long-term statistics.

## 1.0.3

- **Scenes support** — Scene tiles added to overview and rooms views with one-tap
  activation.

## 1.0.2

- **Multi-arch Docker image** — Image now builds for `linux/amd64` and `linux/arm64`
  via GitHub Actions, supporting Raspberry Pi-based HA installs.

## 1.0.1

- **HA ingress sidebar panel** — Add-on registers as a sidebar panel entry with
  icon and correct ingress routing.

## 1.0.0

- Initial release
- Solar-aware energy dashboard with real-time solar/battery/grid tile
- Cameras, climate, music, lighting, shades, scenes, sensors views
- Fully local — no Nabu Casa or Replit dependency
- Direct kiosk/tablet access on port 8099
- HA ingress panel at `/`
- `SUPERVISOR_TOKEN` used server-side; browser never sees the HA token
- Auto-reconnect on connection loss
- Watchdog health check via `/api/healthz`
