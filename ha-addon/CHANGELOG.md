# Changelog

## 1.0.40

- **Fixed: scenes showed a meaningless number (e.g. "2,026") instead of a
  status** — A scene has no on/off state; Home Assistant reports a scene's state
  as the timestamp it was last activated. The generic sensor tile was parsing
  that timestamp as a number ("2026-06-28T…" → "2,026"). Scenes now render with
  their own tile showing "Tap to run" plus when they last ran (e.g. "Ran 3h
  ago"). Tapping opens the detail panel with the existing "Activate Scene"
  button. Automations are unaffected — their state genuinely is on/off (enabled/
  disabled).

## 1.0.39

- **Brought the Scenes tab back — now for real scenes AND automations** — Once
  you create user-facing entries in HA (e.g. the "Entertain Evening" scene, or
  "Night Motion Pub", "Night Motion Stairs", "BBQ Path" automations) they need a
  home on the wall tablet.
  - The tab now matches Scenes (`scene.*`) and Automations (`automation.*`).
  - Scripts (`script.*`) remain excluded to keep auto-generated clutter out.
  - If specific entries still show that you don't want, tell me their names/IDs
    and I'll filter those out individually.

## 1.0.38

- **Removed the Scenes tab entirely** — The only entities it could show were
  Home Assistant's auto-generated `scene.*`/`script.*` entries, none of which are
  things a wall-tablet user needs to tap. The tab is gone, removing that
  clutter from the navigation.
  - When you create real, user-facing scenes in HA and want them on the wall
    tablet, the tab can be brought back filtered to just those scenes (as one-tap
    or On/Off buttons).

## 1.0.37

- **Scenes tab no longer shows background automations** — The tab was pulling in
  three Home Assistant types: Scenes (`scene.*`), Scripts (`script.*`), and
  Automations (`automation.*`). Automations are background trigger rules (e.g.
  "porch light at sunset"), not things you tap on a wall tablet, so they were
  the bulk of the clutter.
  - The tab now shows only real Scenes plus tappable Scripts.
  - Note: the kiosk can only show what HA exposes as `scene.*`/`script.*`
    entities. Lutron Caséta scenes created in the Lutron app are generally not
    surfaced to HA as scene entities, so they won't appear here until they exist
    as a Home Assistant scene or script.

## 1.0.36

- **Fixed: a shade tile's own rename was ignored, showing the room name
  instead** — If you renamed an individual shade in its detail (pencil) view —
  e.g. "Master deck" — the Shades tile still showed the room grouping name
  ("Master Bed"). The tile was set up to prefer a per-tile alias but that alias
  value was never actually filled in, so it always fell back to the room label.
  - A shade's explicit per-tile name now takes priority on the tile, matching
    what the pencil/detail view shows.
  - Room renames (renaming the whole group) still flow through the room label as
    before, so the two naming levels no longer collide.

## 1.0.35

- **Fixed: Shades room rename is now unified with the rest of the app** — In
  1.0.34 the Shades headers got their own separate rename, so renaming "Bed 5"
  to "UpMauka Room" only affected the Shades tab and did not match the room
  rename used everywhere else. Renaming a Shades room now writes to the **same**
  HA `area_id` alias the Rooms tab and device tiles use, so a single rename
  shows up everywhere that room appears (and across every kiosk).
  - The Shades view resolves each synthetic room ("Bed 5", "Bed 4", "Bed 4
    Bath", etc.) to the dominant HA area of its shade entities and keys the
    rename off that area.
  - If a room's shades have no HA area assigned, it falls back to the per-kiosk
    `shade:<label>` key so renaming still works.
  - Note: requires redeploying the add-on — the rename fix is not live until the
    new version is built and installed.

## 1.0.34

- **Fixed: Shades tab room headers couldn't be renamed** — Rooms like "Bed 4",
  "Bed 5", and "Bed 4 Bath" were stuck with their built-in names; renaming did
  nothing. Unlike the Rooms tab (driven by HA areas), the Shades tab groups
  shades into synthetic rooms via entity-id regex patterns, so they have no HA
  `area_id` and the alias system never reached them.
  - Shade room headers are now tappable and rename per-kiosk, reusing the same
    room-alias store under a namespaced `shade:<label>` key (no collision with
    real HA area aliases).
  - The rename propagates to the shade tile labels under that header, so headers
    and tiles stay in sync.

## 1.0.33

- **Fixed: Rooms whose lights are HA `switch.*` entities were invisible** —
  Areas like "Floor 1 Exterior" (Color Niche Left/Right) and "Floor 2 Exterior"
  (Lanai Sconces) never appeared in the Rooms tab. Their Lutron Caséta loads are
  exposed by Home Assistant as `switch.*` entities (device type "None" —
  switched/non-dimming), and the kiosk only counted `light.*` entities, so each
  area resolved to 0 lights and was hidden.
  - `deriveRooms` now also treats a `switch.*` entity as a room light when its
    name matches a lighting-fixture keyword (light, lamp, sconce, niche,
    chandelier, pendant, downlight, spotlight, cove, lantern, vanity), while
    excluding network/camera status LEDs.
  - Room and per-light controls are now domain-aware: service calls are split
    between `light.*` and `switch.*` so toggling/turning a room on/off actually
    works (calling `light.turn_on` on a switch silently no-ops in HA).
  - Switch-backed lights render as a simple on/off toggle (no dimmer slider) and
    show "On"/"Off" instead of a misleading brightness percentage.

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
