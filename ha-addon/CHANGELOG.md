# Changelog

## 1.0.92

- New wall power strip (Home and Energy): instead of one line, the sun now fans out to the
  House, the Powerwalls and the Grid, each line showing its own kW (e.g. 3.9 kW to the house and
  2.1 kW charging). When the sun can't cover the house, lines show the batteries or the grid
  feeding it.

## 1.0.91

- Guest tablets › Wake-up (new): set a wake time for that suite only — "Just tomorrow" or "Every
  day of my stay" (asks "When do you leave?"), and choose fade up the bedroom lights, open the
  shades, and a spoken good-morning on the suite speaker. At wake time the tablet shows a big
  clock over the ocean camera with Snooze 9 min (dims lights, goes quiet; shades stay) and I'm up.
  Runs in Home Assistant (needs the maui_wake.yaml package), so it works even if the tablet sleeps.
- Shades: every shade shows a little window that fills with fabric as it closes, and the Open /
  Half / Close button that matches its position is lit — on the Shades and Rooms screens.
- Rooms: light names drop the repeated room word ("Atrium downlights" → "Downlights") and wrap
  instead of being cut off.

## 1.0.90

- Guest tablets only show their own suite plus the shared rooms (Great Room, Kitchen, Bar, Entry,
  lanais) — never another guest suite.
- Rooms › Music: "Play from your phone" switches the room's speaker to Bluetooth and shows how to
  pair a phone (works on any Wi-Fi), with a note about Spotify and AirPlay on the house Wi-Fi.

## 1.0.89

- New wall › Rooms: pick a room on the left, control everything in it on the right — each light
  (on/off and brightness), All on / All off, the room's AC (− / + and on/off), its shades and its
  speaker (play/pause, volume).
- Guest tablets: "This tablet" (owner view) turns a tablet into the guest tablet for Beach,
  Boardroom, Molokini or Mauka. It opens in that suite with only Rooms and the outdoor cameras;
  the master suite, Alarm, Energy and the classic wall are hidden, and guest AC targets stay
  within 72–80°. "Owner" asks for the homeowner PIN (checked by the add-on) to switch back.
  Guest mode can only be turned on once a homeowner PIN is set in the add-on options.

## 1.0.88

- New wall: swipe left or right on a screen to go to the next or previous tab (touches that start
  on a slider, text box or open dialog are ignored, and vertical scrolling is unaffected).
- New wall › Cameras: cameras whose short names would match (two "Entry") keep their model name.

## 1.0.87

- New wall › Cameras: every UniFi Protect camera as a snapshot grid (refreshed every 10 s),
  a green "Motion" badge while a camera sees movement, and tap to enlarge (refreshes every 2 s).
- New wall: "Full screen" button in the header hides Home Assistant's menus and the tablet's
  bars where the browser allows it.
- New wall › Alarm: the keypad hint now says every arm/disarm asks for confirmation (the saved
  code is used, so it isn't typed each time).

## 1.0.86

- New wall › Alarm: big status (Disarmed / Armed …) with what's open and the keypad text, every
  named zone (doors, sliders, motion) with Closed / Open / Bypassed / Fault, and panel health
  (ready, AC power, battery, panel, fire, alarm). "Arm or disarm…" opens the existing alarm
  keypad unchanged, so the code handling and safety checks are exactly as before.

## 1.0.85

- New wall › Energy: the live power strip, a "Last 24 hours" chart of solar production against
  house use, both Powerwall systems (charge, charging/supplying, solar today) with the battery
  balancer's status, and tiles for solar made today, sold/bought, today vs. grid, this month's
  bill and solar over the last 7 days. Uses the same calculations as the classic Energy page.

## 1.0.84

- New wall › Shades: all 12 Lutron shades by floor and room (Bar, Beach, Master, Closets,
  Molokini, Mauka and their baths, utility window) with a little window picture of how far each
  is open, Open / Half / Close, and Open all / Close all per floor. Garage door shown as status only.
- New wall › Climate: idle zones say "At target" or "Idle" instead of "Holding", which was easy
  to confuse with a manual hold.

## 1.0.83

- New wall › Climate: all nine zones on one screen with inside temperature, target, and − / +
  (sent after a short pause so several taps become one change), Cool / Turn on, and what each
  room is doing. Rooms held by a manual change show "Held until …" with "Back to schedule".
  A top bar shows house mode, inside average, outside temperature and how many zones are cooling,
  with an "open a slider" tip on cool evenings and mornings, and a note when a door is open.

## 1.0.82

- New wall › Music: all 13 Bluesound rooms by area (Main house, Master suite, Guest suites,
  Outside) with what each is playing, its volume and a colour dot for grouped rooms. Tap rooms to
  pick them (a grouped room picks its whole group), then control them together: "Play together
  in N rooms" groups them, plus play/pause/next, source, a volume for all picked rooms and one per
  room, mute, Remove from group, and Stop. Spotify started from a phone shows as "controlled
  from a phone" and can be spread to other rooms.
- New wall › Lights: shorter tiles so the whole house fits without scrolling.

## 1.0.81

- New wall › Lights: every room by floor (Ground floor, Upstairs, Outside) on one screen, each
  showing On / Off / Mixed; tap to switch, plus an "off" button per floor.
- New wall › Lights › Scenes: run Home Assistant scenes and Leave; "+ Save as scene" captures the
  lights (and for whole-house scenes, the shades) exactly as they are now into a saved scene;
  wall-made scenes can be re-captured. Planned scenes (Good morning, Sunset, Good night, Dinner,
  Master reading, Master night) show as ready to set up.
- Outside lights now belong to groups: Great Room lanai, BBQ, Master lanais, Suite lanais.

## 1.0.80

- New wall: the live link now stays open through the Home Assistant ingress proxy (1.0.79 closed
  it straight away and fell back to polling).
- New wall: "Suites in use today" ignores the timestamp every entity gets when Home Assistant
  restarts, so a restart no longer marks every suite as in use.

## 1.0.79

- New wall design preview (Settings › "New wall design" › Try it; "Classic view" switches back):
  sand look with the menu across the top and a live Home screen. Home shows both floors of the
  house drawn from the floor plans, with lights, temperatures, open doors, motion and music on the
  map (tap a room to switch its lights), a live power strip, and a "Right now" panel with
  All lights off / Open shades / Close shades / Leave. Other tabs open the classic wall for now.
- Live updates: the new design receives changes from Home Assistant as they happen instead of
  re-reading every state every 6 seconds (falls back to 6-second polling if the live link fails).
  SPAN circuit sensors and wind readings are left out of the live feed.

## 1.0.78

- Running Net Balance and monthly costs now price each hour at the shared utility meter:
  both Tesla systems' imports and exports are netted per hour first. Energy one system
  sends to the other (e.g. Battery Balance boosts) was previously costed as a purchase at
  the buy rate while the matching export earned only the $0.04 sell rate.

## 1.0.77

- Energy › Solar Today / Solar 7-Day: no longer show "lifetime energy sensor is stale"
  every evening. The Envoy stops re-reporting its lifetime counter after sunset; the
  kiosk now accepts the unchanged counter while the same Envoy's live production
  sensor is still reporting. If both go quiet, it is still flagged.

## 1.0.76

- Energy › Solar Today / Solar 7-Day: fixed "statistics are unavailable or have
  unverified units". HA reports the stored unit as `statistics_unit_of_measurement`;
  the kiosk read a field that HA does not send, so it failed for every Envoy.
- Running Net Balance: no longer shows "Partial data" for overnight hours when Tesla's
  daily export counter is blank (no export happened). Export gaps never change the
  credit (flat sell rate); import gaps are still flagged unless the bridging hour shows
  no energy.
- Net Grid Power chart: carries each system's last reading forward (a missing update
  was treated as 0 kW), draws continuous export/import areas so the line no longer
  breaks when the net hovers near zero (e.g. during battery-balance boosts), and
  refreshes every 5 minutes instead of only at page load.

## 1.0.75

- Optional PIN-free Alarm controls: configure `alarm_pin_free`,
  `alarm_panel_entity_id`, and `alarm_code` in add-on options.
- The code remains server-side and is used only for the configured panel
  through the local Supervisor connection. HTTPS/secure ingress, explicit
  action confirmation, rate limits and live-state verification remain required.
- Disabled by default. Anyone with access to the secure wall can disarm when
  this mode is enabled. Turn it off to return to per-action alarm-code entry.

## 1.0.74

- Added a dedicated Alarm section for EyezOn/Envisalink: partition status,
  keypad text, numbered zones, open/fault/bypass/tamper/battery indications,
  and supported arm/disarm controls.
- Alarm actions require secure HA ingress/HTTPS, an alarm-system code, an
  exact panel target, and confirmation. Codes are not retained; the UI waits
  for reported panel state rather than treating an HTTP response as proof.
- Issue acknowledgment is local to the wall. It does not clear panel trouble,
  silence a siren, bypass a zone, or dismiss monitoring-company alerts.
- No Home Assistant YAML package update is required for the Alarm panel.

## 1.0.73

- HA Survey counts live automations, scripts and scenes independently of readable
  configuration. Individual configuration and registry failures are reported,
  not silently converted to empty inventories.
- Added reviewed sharing to the development Studio workspace. Sharing is disabled
  in the HA add-on and published builds; report downloads remain available.

## 1.0.72

- Added read-only diagnostic export in Wall Settings with category selection,
  a fresh Home Assistant state snapshot, exact sanitized preview and reviewed
  JSON download. No new credentials or Home Assistant package update required.

## 1.0.71

- **Fixed: solar period totals showed lifetime production** — Main Envoy's
  native daily and seven-day sensors were both reporting its lifetime value.
  The Energy page now derives each period independently from that same Envoy's
  validated hourly lifetime-energy records. Today uses Hawaii midnight; seven
  days means today plus the preceding six Hawaii calendar days. Both show the
  completed-hour cutoff. Missing history, counter resets, invalid units and
  stale data are explicit rather than displayed as trustworthy totals.
- Solar history requests are limited to seven days plus one baseline hour,
  cached for five minutes, and refreshed at Hawaii day rollover. Grid costs,
  grid flow, battery displays and Solar Live are unchanged.

## 1.0.70

- **Added: one approval prepares both Maui battery banks** — Settings now binds
  two distinct exact controls and targets into one short-lived immutable review.
  Home Assistant durably saves both prior values before writing, verifies both
  results, and restores both after partial failure, expiry, or restart recovery.
  Weather remains recommendation-only. The full review and control surface now
  lives in Settings; Overview only shows a compact urgent indicator.
- **Fixed: stale failures no longer override healthy monitoring** — A prior
  failed result does not keep the idle, valid system titled “Action Failed.”
  Requires updating the separately installed
  `ha-config/maui_storm_prep_package.yaml`.

## 1.0.69

- **Fixed: homeowner PIN unlock was hidden during initial Storm Prep setup** —
  The configuration-invalid state now shows the secure PIN gate, allowing the
  homeowner to unlock controls before saving the first verified battery target.

## 1.0.68

- **Fixed: Maui 4680 battery reserve controls were missing from Storm Prep** —
  The Storm Prep control picker now recognizes the home's writable `4680` and
  `gonser` backup-reserve entities. The package's server-side approval checks
  already enforced the same exact-entity, percent-range, and verification
  requirements.

## 1.0.67

- **Added: approval-first storm battery preparation** — The kiosk now surfaces
  official severe-weather and three-day low-sun/rain risk, but never changes a
  battery setting by itself. A homeowner must select and verify one exact
  battery control, then approve each time-limited request before Home Assistant
  applies it. The package reads the result back, preserves the original value,
  restores it at expiry or on demand, and reconciles interrupted recovery after
  a restart. Approval controls on the direct LAN kiosk require the homeowner PIN
  configured in the add-on options and unlock for ten minutes at a time. The PIN
  and privileged actions are accepted only over HTTPS/secure Home Assistant
  ingress; the plain-HTTP direct LAN page remains available for general controls
  but cannot unlock or perform storm preparation.
  Requires installing `ha-config/maui_storm_prep_package.yaml` in Home Assistant
  packages and restarting Home Assistant.

## 1.0.66

- **Fixed: energy-cost refresh overloaded Home Assistant** — The kiosk no
  longer requests two years of hourly data for four grid sensors every five
  minutes. Hawaii today/current month now use a small live request, while the
  system's six months of available history load once in month-sized background
  chunks. Failed live refreshes retain the last snapshot only as an explicitly
  partial value with its age, retries back off, and proxy/timeout failures now
  identify the failing layer instead of only saying “Load failed.”

## 1.0.65

- **Fixed: impossible daily/monthly grid-cost totals** — “Today” previously
  estimated cost from a rolling 24 hours of instantaneous grid power while the
  monthly chart used Home Assistant's hourly imported/exported energy
  statistics. Both charts now use the same hourly energy records, Hawaii
  calendar boundaries, and rate schedule. The monthly footer reconciles
  before-today cost/credit with today's cost, and missing or delayed statistics
  are identified as partial data instead of producing a confident bad total.

## 1.0.64

- **Fixed: misleading matrix footnote in Vacation mode** — The cooling matrix
  caption claimed Atrium / Bar / Kitchen are excluded in all modes. They are
  only excluded in Owners Home / Visitors (doors open); in Vacation they follow
  the Rest target. The caption now changes with the selected mode tab.

## 1.0.63

- **Fixed: wrong "peak backoff" shown when viewing from another timezone** —
  The status card computed the 5–9pm peak window (and the 9pm–7am night
  window) from the viewing device's clock. Checking the kiosk from the
  mainland during mainland evening hours made the card claim "Applied: 84° —
  peak backoff" while the house (on Hawaii time) was actually mid-day and
  correctly following the solar matrix. Both windows now always use the
  house's clock (Pacific/Honolulu), matching the automation.

## 1.0.62

- **Changed: manual holds now work in Vacation mode (2 hours)** — Previously
  Vacation always reclaimed thermostats within 15 minutes of a manual change.
  Now a hand-adjusted thermostat holds for 2 hours in Vacation (8 hours in
  Owners/Visitors, unchanged), so someone working at the house gets temporary
  control before the matrix takes back over. The status card hold line now
  reads "(2h in Vacation)". Requires re-pasting BOTH the "Maui Manual Setpoint
  Hold" and "Maui Solar-Aware Climate" automations.

## 1.0.61

- **Fixed: phantom "motion X ago" times after reconnects** — When Home
  Assistant restarts or an integration (e.g. UniFi Protect) reconnects, HA
  stamps every motion sensor with a new "last changed" time, making all rows
  show the same fake recent time. The Recent Motion tile now detects that
  pattern (3+ idle sensors sharing the same timestamp) and shows "quiet"
  instead of a misleading time. Real detections are unaffected.

## 1.0.60

- **Clarified: hold list in Vacation mode** — The house status card now
  appends "(ignored in Vacation)" to the manual-hold line, since Vacation
  mode always follows the matrix regardless of holds.

## 1.0.59

- **Improved: house status card now explains itself** — Instead of a single
  summary line, the card shows: the target source (which matrix row is in
  charge and its raw values), the applied targets after adjustments (with the
  reason — peak backoff, dew-point protection, or an open door/window), and
  which rooms are under a manual hold. No more guessing why a thermostat
  differs from the matrix.
- **Changed: the dew-point floor is now absolute** — A manually held room
  keeps its hand-set temperature, but never below the condensation floor.
  If someone sets a held room colder than the dew-point floor, the
  automation raises it back to the floor (requires re-pasting the
  "Maui Solar-Aware Climate" automation from `ha-config/`).

## 1.0.58

- **Fixed: Settings tab showed the obsolete pre-matrix screen** — The
  top-level Settings tab was still the old "Solar Awesome / Good / Moderate"
  setpoint list, whose helpers no longer exist (everything read "NaN"). It
  now shows the current settings: the Cooling matrix (with the Night row)
  and the Super View entity pickers — the same panel as "Pick entities" on
  the front page.

## 1.0.57

- **Added: Night row in the cooling matrix** — Between 9pm and 7am the
  automation uses a new "Night" matrix row instead of the solar tier, so
  bedrooms can be pre-set for sleeping (Owners default: master 78°, others
  84°; Visitors default: all 78°). Vacation mode has no Night row and always
  follows the solar tier. Requires the updated `maui_solar_tier_package.yaml`
  and `maui_solar_aware_climate.yaml`.
- **Changed: House status card** — Shows "Night · …" with the live Night
  targets during the night window in Owners/Visitors modes.

## 1.0.56

- **Added: Solar-tier cooling matrix** — Cooling is now driven by five named
  solar tiers (Poor ≤5 kW · Fair 5–10 · Good 10–15 · Strong 15–20 ·
  Excellent >20). Each house mode (Owners / Visitors / Vacation) has its own
  editable matrix of AC targets for three room groups (Master / Sitting /
  Rest), stored as Home Assistant `input_number` helpers.
- **Added: Cooling matrix editor in Settings** — Pick Entities → Cooling
  matrix. Tap +/− per cell; "Load recommended defaults" seeds the starting
  values. Requires the new `maui_solar_tier_package.yaml` in HA.
- **Changed: House status card** — Threshold line now shows the solar tier
  name and the live matrix targets (e.g. "Solar good · master 76° / sitting
  76° / rest 84°").

## 1.0.55

- **Fixed: House status card was clipping the climate threshold line** — The
  card now spans two grid rows (like the Weather tile), so the "Solar-strong /
  Standard / Peak backoff" line and the dew-floor note are fully visible.

## 1.0.54

- **Added: House status card on the Overview page** — A double-width tile
  showing the current house mode (Owners Home / Visitors / Vacation / Suspend),
  live solar production, home power draw, battery charge (lowest of the two
  Powerwalls), and which climate threshold is currently in effect: Peak backoff
  (5–9pm), Low battery (<25%), Solar-strong, or Standard — plus the dew-point
  floor when it is raising setpoints.

## 1.0.53

- **Fixed: UniFi network-gear status LEDs no longer count as lights** — Access
  point and PoE switch LEDs (UAP-AC-Lite, UAP-AC-M-Pro, USW-Lite-8-PoE, UDM,
  etc.) were included in the Lighting section's "All off" count. They're now
  filtered out like camera lights, so "All off" only touches real room lights.

## 1.0.52

- **"All off" now names exactly what it will turn off** — The confirmation
  prompt lists each light by name (e.g. "Turn off Bar Sconces, Kitchen Cans,
  Lanai Lantern?") instead of just a count. Useful because the count can include
  lights that don't appear in the Lighting list — typically ones not assigned to
  any room in Home Assistant.

## 1.0.51

- **Lighting list now shows everything "All off" controls** — Lighting loads
  wired through switch modules (Lutron etc.) now appear in the Lighting section
  (and no longer under Switches), so the "All off" count always matches the list
  you see.

## 1.0.50

- **Added: "All off" button in the Lighting section** — Turns off every light in
  the house with one action, including lighting loads wired through Lutron-style
  switch modules (which Home Assistant treats as switches, not lights). Shows how
  many lights are currently on, asks "Turn off N lights?" before acting (the
  prompt auto-dismisses after a few seconds), and is disabled when nothing is on.

## 1.0.49

- **Full screen now keeps the section menu permanently visible** — Instead of a
  hide/show "Sections" button, the side menu (Overview / Rooms / Lights / etc.)
  stays on screen at all times, including in full screen, so you can jump between
  sections with a single tap. The bottom button flips to "Exit full" while in
  full screen.

## 1.0.48

- **Fixed: Full screen also hid the section selector, so you were stuck on one
  page** — Going full screen hid the whole side menu, including the Overview /
  Rooms / Lights / etc. selector, leaving no way to switch sections. Now in full
  screen a floating **Sections** button (top-left) slides out the section menu so
  you can still navigate, then tap a section (or the backdrop) to close it. The
  **Exit full screen** button stays top-right.

## 1.0.47

- **Added: a direct, chrome-free kiosk URL for wall tablets** — The add-on now
  also publishes itself on your local network at `http://<home-assistant-ip>:8099/`.
  Open that in Safari (then "Add to Home Screen" for a standalone, full-screen
  window) and you get the kiosk with **no** Home Assistant header or sidebar
  around it. Connect once with your Home Assistant address + token and it
  sticks. Note: this is **local-network only** — it is not reachable through
  Nabu Casa remote access, and it has no Home Assistant login, so anyone on your
  Wi-Fi can open it. The "Wall" panel inside Home Assistant still works exactly
  as before.

## 1.0.46

- **Fixed: on iPad the "Full screen" button was cut off below the side menu,
  and there was no way back out of full screen** — The side menu didn't scroll,
  so on shorter iPad screens the Full screen control at the bottom was
  unreachable. The menu now keeps **Back** pinned at the top and **Full screen**
  pinned at the bottom, with only the category icons scrolling in between, so
  both are always tappable. "Full screen" now hides the side menu for a clean
  wall view (and still uses true browser full screen on devices that support
  it), and a floating **Exit full screen** button appears in the top-right so
  you can always get back — on iPad/iOS too. The Esc key also exits.

## 1.0.45

- **Fixed: "Recent Motion" still showed raw UniFi names (e.g. "South Pool G6
  PTZ High resolution…") instead of your camera names** — The OUTSIDE column
  resolves each motion sensor to its camera, but it was reading the camera's raw
  Home Assistant name and, on UniFi devices that expose several camera entities,
  often latched onto the "High resolution channel" stream. It now (1) honors a
  camera renamed on this kiosk — not just in Home Assistant — and (2) skips the
  secondary stream entities and picks the primary camera. The OUTSIDE rows now
  match the names shown on the Cameras tab.

## 1.0.44

- **Dew-point–aware temperatures: tiles now warn before you over-cool** — In a
  tropical oceanfront home, setting an AC below the outdoor dew point invites
  condensation and mold. Climate tiles now read the live outdoor dew point and,
  whenever a unit is cooling to a target *below* it, show an amber warning right
  on the room's temperature tile: **"Dewpoint conflict at 77°F."** It's
  warn-only — your setting is never changed for you. (A companion Home Assistant
  automation also sends a phone push the instant any unit is set below the dew
  point, however it was set — Honeywell app, kiosk, or voice.)

## 1.0.43

- **Camera names now follow Home Assistant automatically in "Recent Motion"** — the Outside rows previously showed the motion-sensor's own name, which is a separate entity from the camera. Now each motion sensor is linked to its camera (same device) and displays the camera's HA name. Rename a camera once in Home Assistant and the kiosk follows — no second rename needed. A per-kiosk rename still overrides if you set one.

## 1.0.42

- **Fixed: camera motion names in the "Recent Motion" widget couldn't be changed**
  — The OUTSIDE column lists each camera's *motion-detection sensor*, which is a
  separate entity from the camera itself. Renaming a camera in Home Assistant does
  not rename its motion sensor, so the widget kept showing the old names. These
  camera motion sensors are also intentionally excluded from the Motion tab, so
  there was no place to rename them.
  - The "Recent Motion" rows (both INSIDE and OUTSIDE) are now tappable, with a
    small pencil hint, and open the detail panel where you can rename each sensor
    for this kiosk. The new name appears immediately in the widget.

## 1.0.41

- **Fixed: motion sensors couldn't be renamed, and renames didn't show on the
  main screen** — The Motion tab listed sensors as plain, non-tappable rows, so
  there was no way to rename them, and the list always showed the cleaned-up HA
  name instead of your custom one.
  - Motion-tab rows are now tappable (with a small pencil hint) and open the
    detail panel where you can rename the sensor for this kiosk.
  - Both the Motion tab and the main-screen "Recent Motion" widget now show your
    custom name as soon as you set it.

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
