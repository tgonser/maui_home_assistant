# Maui HA maintenance — November 2026

Working notes from the Nov 5, 2026 review. Nothing here has been applied to the live
Home Assistant yet; each section ends with a checklist to pick up later.

Data source: HA recorder long-term statistics (hourly, Oct 2 – Nov 5) and raw history
(1-min, last ~14 days) pulled read-only over the HA websocket. Scripts are in
`tools/energy-analysis/`.

---

## 1. Tesla battery imbalance (System 1 vs System 2)

### Symptom
System 2 (`sensor.4680_system_2_*`) repeatedly drains to its 10% reserve and then
imports from the grid, while System 1 (`sensor.gonser_4680_system_1_*`) holds 50–65%
overnight and exports surplus solar every afternoon. Each gateway only sees its own
circuits, so Tesla cannot move energy between the two systems.

### Findings
| | System 1 | System 2 |
|---|---|---|
| Usable capacity (estimated from charge data) | ~58 kWh | ~54 kWh |
| Battery discharge, 5 PM – 9 AM (avg) | ~12 kWh | ~10 kWh (+ ~5 kWh grid) |
| Solar 9 AM – 5 PM (avg) | ~45 kWh | ~35 kWh |
| Load 9 AM – 5 PM (avg) | ~17 kWh | ~20 kWh |
| Typical day | 100% by midday, then exports | starts 10–18%, peaks 30–45% (since mid-Oct) |

**Root cause: System 2 does not recharge during the day.** Overnight draw is similar;
System 2 simply enters each evening half empty.

### AC → system mapping
Determined by matching each Honeywell `hvac_action` cooling start/stop to load steps
on each gateway. Step sizes are approximate (Honeywell cloud polling lags).

| System 1 | System 2 |
|---|---|
| Sitting (~0.85 kW) | **Atrium (~3.6 kW)** |
| Kitchen (~0.85 kW) | Boardroom (~1.2 kW) |
| Master Bed (~0.8 kW) | Bar (~1.1 kW) |
| Molokini / `maui_bar` (~0.4 kW) | Beach Room (weak signal, likely) |

Upper Mauka: too little activity to classify.

Atrium cooled ~8 h/day over 10 days (~3.9 h overnight) ≈ **29 kWh/day on System 2**,
more than the whole gap between the two systems.

### Proposed fix (electrician — sent to Walter)
Move the Atrium condenser circuit to a SPAN panel fed by System 1.
Estimated shift: ~11 kWh daytime + ~18 kWh evening/overnight to System 1. System 1
would still fill most days; its overnight low drops from ~60% to ~30%.
Alternatives: moving Boardroom alone (~4 kWh/day) is not enough; moving a solar
string from System 1 to System 2 (solar installer job).

### Possible HA-side options (not built — decide later)
- **Hard floor:** keep `number.*_backup_reserve` ≥ 20% on both systems.
- **Hold the low battery:** when the SOC gap is over ~20 points, raise the low system's
  reserve to its current SOC (off-peak only) so its loads run from the grid; restore
  the reserve when the gap is under ~10. Needs a minimum hold time and must always restore the original reserve.
- **System-aware climate:** use per-system solar surplus (not `total_solar`) when
  deciding pre-cooling for rooms on each system; back off System 2 rooms when it is low.
- Note: battery export via `select.*_allow_export` could offset the low side at the
  meter, but only if both gateways are on one meter and the utility tariff allows it — unverified.

### Checklist
- [ ] Walter confirms the Atrium breaker/panel in the SPAN app and feasibility of the move
- [ ] Circuit moved; re-run `cap.py` after 1–2 weeks to confirm System 2 fills daily
- [ ] Decide whether to add the hard-floor reserve automation regardless

---

## 2. New water heater cycling around the clock (System 2)

Since ~3 PM HST **Nov 3**, a ~4.5 kW load on System 2 switches on roughly every 18 min
(~8 min on), day and night — about 20 starts per 6 h vs ~1 per 6 h before. That is
roughly **+40–45 kWh/day**, and is what drove System 2's 40+ kWh overnight loads on
Nov 3–4. Timing matches the new water heater + pump install (`cyc.py`, `nights.py`).

Likely causes: recirculation pump running continuously with no timer/aquastat, and/or
a heat-pump water heater running on its resistance element (4.5 kW) instead of the
heat pump. Email sent to the contractor who oversaw the install.

### Checklist
- [ ] Contractor checks recirc pump control, operating mode, setpoint/vacation mode, leaks
- [ ] Confirm in SPAN app which breaker shows the 18-min cycling
- [ ] Re-run `cyc.py` afterwards — expect back to ~1 start per 6 h

---

## 3. Old alarm integration (Total Connect) — remove

- `totalconnect` config entry is still installed, state `setup_error`; **72 entities**,
  all unavailable (incl. `alarm_control_panel.ltem_xv`).
- No dashboard references. Kiosk `alarm_panel_entity_id` already points to the new
  EyezOn/Envisalink panel `alarm_control_panel.makena_alarm_partition_1`.
- **Still referenced by "Maui Auto Presence"** (`automation.maui_auto_presence_2`):
  `binary_sensor.motion_kitchen` and `binary_sensor.motion_upstairs` (both dead).
  Last triggered Jun 26, 2026.

Updated paste-ready automation: `ha-config/maui_auto_presence.yaml` (dead Total Connect
sensors removed; slots for the EyezOn motion zones marked TODO).

### Checklist
- [ ] Get the EyezOn zone list (zone number → sensor) from the installer/EyezOn portal
- [ ] Rename `binary_sensor.makena_alarm_zone_N` friendly names; set motion zones'
      device class to `motion` (currently all 24 are `opening`)
- [ ] Fill the TODO zone entity IDs in `maui_auto_presence.yaml`, paste over the
      existing automation in the UI (Edit in YAML)
- [ ] Delete the Total Connect integration (Settings → Devices & services)
- [ ] After deletion, check whether old names (e.g. `binary_sensor.front_door`) are
      now free and worth reusing for the EyezOn zones

---

## 4. Updates pending (as of Nov 5, 2026)

| Component | Installed | Latest |
|---|---|---|
| Home Assistant Core | 2026.7.2 | 2026.11.0 |
| Home Assistant OS (Green, aarch64) | 18.1 | 18.4 |
| Studio Code Server | 6.0.1 | 7.2.0 |
| ESPHome Device Builder | 2026.6.5 | 2026.10.2 |
| Terminal & SSH | 10.0.2 | 10.6.0 |
| Matter Server | 9.1.0 | 9.3.0 |
| File editor | 6.0.0 | 6.3.0 |
| EyezOn (HACS) | v1.2.1 | v1.2.2 |
| UI Lovelace Minimalist (HACS) | v1.5.6 | v1.5.9 |
| SPAN Panel (HACS) | v2.0.8 | v2.1.2 — installed but not configured; consider removing |

Current: Supervisor 2026.10.5, Wall Kiosk 1.0.75, HACS 2.0.5, WireGuard, all UniFi firmware.

### Checklist
- [ ] Full backup first
- [ ] Review breaking changes 2026.8 → 2026.11 for: Honeywell TCC, Tesla (Fleet/Teslemetry),
      UniFi Network/Protect, Tempest/WeatherFlow (history of crashes after updates), Envisalink
- [ ] Update OS + add-ons, then Core
- [ ] Verify: kiosk loads, climate matrix automation runs, storm-prep and alarm panel work,
      Tempest sensors available

---

## 5. Doc fix in this branch
`docs/maui-climate-automation.md` "Battery Protection" said the automation uses the
lower of the two batteries. Battery no longer affects targets (purely solar-driven by
design); section updated to say so.
