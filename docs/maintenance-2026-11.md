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
| Battery | 3 × Powerwall 3 (~40.5 kWh) | 3 × Powerwall 3 (~40.5 kWh) |
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

### Occupancy matters (added Nov 12)
- House is occupied **Nov–May** (vacant in summer). Balance for those months only; summer
  has surplus solar and light load. Do any rewiring in summer while the house is empty.
- When occupied: **Boardroom (System 2) cools the most** (hottest room, mostly daytime —
  directly competes with System 2 recharging). Master + Sitting (System 1) moderate, sliders
  open in the evening. **Atrium little** (big sliders open). Others held ~80°F.
- So **Boardroom is the priority move**; Atrium is optional. The Oct–Nov baseline was mostly
  vacant, which is why the Atrium looked so large. Fix that in HA instead: in Vacation mode give
  the Atrium a warmer target (keep the dew-point floor).
- Real test: 2 weeks of data **while occupied** after the move.

### SPAN panels (3 panels, 2 Tesla systems) — confirmed Nov 13 via HA
All three are MAIN 32 on spanos3/r202639/04, connected to HA with the official local
API (SpanPanel/span v2.2.0, passphrase auth; needs HA ≥ 2026.8, so Core was updated to
2026.11.1 the same day).

| HA name | SPAN app name | Tesla system (Powerwall 3 serial) | Circuits |
|---|---|---|---|
| Span Panel | System 1 Mudroom | System 1 (tg12518700062e) | 37 |
| Span Panel 2 | Garage panel (Pool Subpanel, Subpanel Garage, Main House solar water heater) | System 1 (tg12518700062e) | 10 |
| Span Panel 3 | System 2 Mudroom | System 2 (tg1251870006gx) | 34 |

- **SPAN app Flow screen = whole Tesla system total.** Confirmed: both System 1 panels
  report the same battery and nearly the same site power. Only per-circuit numbers are
  panel-specific. The garage panel's feed-through power is 0, so it doesn't feed another panel.
- Circuit names show AC condensers on both systems (e.g. System 1: "AC Subpanel 2nd Floor
  bedrooms & AC condenser 2"; System 2: "Laundry / Dryer & AC condenser Living Room",
  "Dryer 2 / Master Bedroom & AC condenser Downstairs"). The thermostat-based AC → system
  table above is an inference; re-check it against SPAN circuit data before Walter's move.
- **Batteries are identical:** both systems have **3 × Powerwall 3** (~40.5 kWh each),
  confirmed in the Tesla app Nov 15. (An earlier estimate of 43 vs 58 kWh from a single
  low-charge reading was wrong.) So the imbalance is entirely load + solar.
- **Tesla app issues found (Nov 15):**
  - System 2 (TG1251870006GX) site address was **4860** Makena Alanui — corrected to
    **4680** by T2 in the Tesla app (Nov 15).
  - Firmware: System 2 **26.34.3** is the mainstream build (~90% of Powerwall 3s per
    Netzero tracker, Nov 15); System 1 **26.42.0** is an early staged rollout (~1%, first seen
    Nov 3). Normal — nothing to do; System 2 should get 26.42 in coming weeks. No public
    26.42 release notes found.

### Checklist
- [x] Walter confirmed the plan: move Atrium + Boardroom (Nov 12)
- [x] Garage panel is on System 1, feeds nothing; Flow = system total (confirmed via SPAN in HA, Nov 13)
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
| Low, uneven | 3 | 308–874 Wh (winter self-shading; uniform in July) |

- Tesla data (Oct 2 – Nov 5): System 1 solar ~45 kWh vs System 2 ~35 kWh, 9 AM–5 PM.
  Hypothesis: the weak winter faces (Arrays 3, 6, 8) mostly feed System 2. Unconfirmed.

### Orientation and season (Nov 11 vs Jul 18, per panel)
Compass from drone photos: pool/ocean side = **west**, entrance = **east**; the long
roof ridges run east–west, with panel blocks on the south and north sides of each ridge.

| Arrays | Nov 11 | Jul 18 | Face |
|---|---|---|---|
| 3, 6, 8 | 0.3–0.87 kWh | 2.18–2.24 kWh | North: worst in winter, best in summer |
| 1, 2 (top group), 4, 13 | 0.55–1.7 | 1.89–2.27 | East/west: in between |
| 5, 7, 9, 10, 11, 12 | 2.15–2.26 | 1.95–2.12 | South: best in winter, slightly lower in summer |

Site total: 109 kWh (Nov 11) vs 146 kWh (Jul 18).

- **No faulty panels.** The single low November panels (Array 4 555 Wh, top group
  944 Wh, Array 1 1.06 kWh) and Array 3's spread were all normal in July. They were
  winter self-shading from taller roof sections with the low sun. Removed from the watch list.
- In summer all arrays are within ~15%, so each system's solar ≈ its **panel count**.
  In winter it depends on its **north/south mix**.
- **If rebalancing solar: swap, don't just move.** Trade a north array on System 2 for a
  south array of similar size on System 1 (e.g. Array 6 or 8 ↔ Array 7, ~7 panels each)
  so both systems get a similar mix — balanced in winter without unbalancing summer.
  Only valid if the north arrays are confirmed to be on System 2.

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

### Inverter watch (new, not installed yet)
`ha-config/maui_inverter_watch.yaml`, a package that checks every Enphase microinverter
and both Envoys each evening (7:30 PM HST) and notifies on problems: not reporting,
produced nothing on a sunny day, or well below its own usual share of site output.
Each inverter is compared with itself, so north-facing panels in winter don't trigger it.
Added after learning that Arrays 9 and 10 lost production to inverter issues after
install without anyone noticing. Logic tested offline with simulated inverters.

- [x] Verified: 70 inverter sensors, one Envoy (202445013483) (Nov 13)
- [x] Installed in /homeassistant/packages/ and reloaded (Nov 13); first samples counting all 70
- [ ] After 5 sunny days, confirm `sensor.maui_inverter_watch` shows 0 issues and learned_days >= 5

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

### EyezOn zones (from T2, Nov 13 2026)
| Zone | Sensor | Type |
|---|---|---|
| 2 | Kitchen motion | motion |
| 5 | Sitting room motion | motion |
| 6 | Bar sliding door | door |
| 7 | Front door | door |
| 8 | Bar bath door | door |
| 11 | Mudroom door | door |
| 17 | Kitchen sliding door | door |
| 18 | Great room sliding door | door |

Zones 1, 3, 4, 9, 10, 12–16 and 19–24 are unused (per T2) — candidates to disable in HA.

### Checklist
- [x] Get the EyezOn zone list (zone number → sensor) from the installer/EyezOn portal
- [x] Renamed zones 2, 5, 6, 7, 8, 11, 17, 18; zones 2 and 5 set to `motion` (Nov 13)
- [x] Live Maui Auto Presence updated (Nov 13): phone tracker `device_tracker.temp`, notify
      `notify.mobile_app_temp`, zones 2 + 5 in, Total Connect sensors out
- [x] `configuration.yaml` "Maui Someone Home": Total Connect sensors replaced by zones 2 + 5 (Nov 13)
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
