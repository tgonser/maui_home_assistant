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

### Update — Nov 12
- Walter agreed to move **two AC units: Atrium + Boardroom** to System 1. Not done yet
  as of Nov 12 (System 2 at 12% on grid ~4:50 AM HST, System 1 at 55%).
- **Overshoot risk:** together they shift roughly 30 kWh/day, while the current gap is
  more like 10–15 kWh/day (System 1 exports ~10 kWh/day; System 2 imports ~5 kWh/night).
  System 1 could become the short side. Plan B: move Boardroom back. Mention to Walter
  so the wiring keeps that easy.
- What to watch for 1–2 weeks after the move: System 2 should end nights well above 12%;
  System 1 should still reach ~100% most afternoons. If System 1 starts ending nights
  low while System 2 sits full, the imbalance has flipped.

### SPAN panels (3 panels, 2 Tesla systems)
| SPAN panel | Tesla system | Notes |
|---|---|---|
| "Garage" panel (Pool Subpanel, Subpanel Garage, Main House solar water heater) | System 1 (inferred) | Only 3 circuits, ~240–300 W at night |
| System 1 Mudroom | System 1 | ~1.1–1.2 kW at night (inferred by difference) |
| System 2 Mudroom | System 2 | 0.7 kW from grid at 12% on Nov 12 |

**SPAN app gotcha:** the **Flow** screen's "home" kW and battery % appear to be the
*whole Tesla system's* figures, not that panel's own load — both System 1 panels showed
~1.3–1.5 kW and 55%. Only the **Circuits** tab is panel-specific. (Alternative: the
garage panel feeds System 1 Mudroom through feed-through lugs.) Asked Walter which.
Judge the AC move by system totals (Flow / Tesla / HA), not one panel's circuit list.

### Checklist
- [x] Walter confirmed the plan: move Atrium + Boardroom (Nov 12)
- [ ] Walter answers: is the garage panel on System 1, and does it feed or get fed by System 1 Mudroom? Is Flow a system total?
- [ ] Circuits moved (date: ____)
- [ ] 1–2 weeks after: re-run `parse.py` / `cap.py` and compare to the Oct 2 – Nov 5 baseline
- [ ] If the imbalance flips, ask Walter to move Boardroom back
- [ ] Update the AC → system table above after the move
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

**Nov 12:** System 2 drew only 0.7 kW at ~4:50 AM HST (vs ~2.5 kW average overnight on
the bad nights), so the cycling may be fixed — one reading, not confirmed.

### Checklist
- [ ] Contractor checks recirc pump control, operating mode, setpoint/vacation mode, leaks
- [ ] Confirm in SPAN app which breaker shows the 18-min cycling
- [ ] Re-run `cyc.py` afterwards — expect back to ~1 start per 6 h

---

## 2b. Solar rebalancing — phase 2 (after the AC move)

Do this **second**, after seeing the effect of Walter's AC move. Change one thing at a time.

### What we know (Enphase, Nov 11 — a clear day, 106–109 kWh total)
- All microinverters reporting; no failed units.
- Panel output falls into groups that match roof orientation (no tree shading at this house):

| Group | Arrays | Per panel, Nov 11 |
|---|---|---|
| Best | 5, 7, 9, 10, 11, 12 | ~2.15–2.26 kWh |
| Middle | 1, unlabeled top group, 4, 13 | ~1.5–1.7 kWh |
| Low, even | 6, 8 | ~0.80–0.87 kWh |
| Low, uneven | 3 | 308–874 Wh (likely self-shading from the building) |

- Single low panels to re-check on other clear days: Array 4 (555 Wh vs ~1.5),
  top group (944 Wh vs ~1.7), Array 1 (1.06 kWh vs ~1.47). If always low and not near a
  roof edge or vent, raise with the installer as a warranty question.
- Tesla data (Oct 2 – Nov 5): System 1 solar ~45 kWh vs System 2 ~35 kWh, 9 AM–5 PM.
  Hypothesis: the weak faces (Arrays 3, 6, 8) mostly feed System 2. Unconfirmed.

### Data needed to plan a move
1. **Solar wiring (installer):** which arrays feed which Tesla system; how panels are
   grouped into Enphase **branch circuits** (AC — a move is normally moving a branch
   breaker, not DC rewiring); where those breakers land and the distance between panels.
2. **Per-array production over a year** (Enphase → Array → Year, per array). Sun angle
   changes which faces win by season; one November day can mislead.
3. **Limits (installer):** max PV per Tesla system/gateway, Powerwall capacity,
   breaker/busbar ratings on the receiving side, and the **utility interconnection
   approval** (in Hawaii the approved PV may be tied to each system — a move may need paperwork).
4. **Post-AC-move results:** 1–2 weeks of per-system solar, load and battery % from HA
   (`tools/energy-analysis`) to size how much solar, if any, still needs to move.
5. **Tariff export rules:** whether exported solar earns anything — sets how much
   System 1's afternoon surplus is currently wasted.

With 1, 2 and 4: pick which branch circuits to move and estimate kWh/day per system.
Item 3 says whether it's allowed.

### Checklist
- [ ] Installer: array → system → branch circuit map, and per-system limits
- [ ] Interconnection: can PV move between systems without utility paperwork?
- [ ] Enphase yearly per-array screenshots
- [ ] After AC move settles: decide whether a solar move is still needed

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
