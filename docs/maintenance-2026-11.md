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
- [x] Circuits moved: **Walter moved BOTH Atrium and Boardroom ACs to System 1** (reported Nov 16).
      SPAN shows the switch ~2–3 PM HST Nov 16: System 2 "Laundry / Dryer & AC condenser Living Room"
      last drew >200 W at 2 PM; a new 240 V circuit appeared on System 1 Mudroom (tabs 9:11,
      "AC condenser / Living & AC condenser Master Bedroom…", first active 3 PM). Walter also
      updated the SPAN breaker map, so circuit names may have changed — verify which
      condensers moved against thermostat data. Boardroom can go back if System 1 runs short.
      Baseline = before Nov 16 2 PM HST; post-move = after.
- [x] Walter confirmed: garage panel + System 1 Mudroom are both on Tesla System 1, and SPAN's
      Flow total is read from Tesla (system total), not summed from that panel's circuits.
- [ ] 1–2 weeks after: re-run `parse.py` / `cap.py` and compare to the Oct 2 – Nov 5 baseline
- [ ] If the imbalance flips, ask Walter to move Boardroom back
- [ ] Update the AC → system table above after the move
- [ ] Decide whether to add the hard-floor reserve automation regardless

---

## 2. New water heater cycling around the clock (System 2) — CORRECTED Nov 17: it was the AC condensers, not the water heater (see section 6)

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

## 6. SPAN check-in — Nov 17, 2026 (first circuit-level look)

Data: SPAN (all 3 panels) + Tesla, Nov 13 8 AM → Nov 17 6 AM HST. House in **Vacation** mode.
The AC move happened ~3 PM HST Nov 16, so this is mostly a **before** baseline plus one
after-move night. Nov 17 is forecast cloudy; the real before/after comparison is the Nov 24 check-in.

### Per system, per day (Tesla, kWh)
| Day | S1 solar | S1 day load | S1 night load | S1 night from grid | S2 solar | S2 day load | S2 night load | S2 night from grid |
|---|---|---|---|---|---|---|---|---|
| Nov 13 | 59 | 26 | 19 | 0 | 42 | 55 | 57 | 56 |
| Nov 14 | 47 | 22 | 16 | 9 | 29 | 45 | 27 | 27 |
| Nov 15 | 69 | 15 | 17 | 0 | 34 | 24 | 20 | 14 |
| Nov 16 (move 3 PM) | 59 | 21 | 18* | 0 | 33 | 29 | 14* | 14 |
*partial night (to 6 AM). Day = 9 AM–5 PM, night = 5 PM–9 AM.

- **System 2 never got above ~30%** in these four days; most nights it sat at its reserve and ran on
  the grid. Nov 13–14 were very heavy (AC load on System 2 from the earlier 75°F settings).
- **System 1 is not always full either:** on cloudy Nov 14 it dropped to 8% and imported 9 kWh.
- **Backup reserve is now 20% on both systems** (T2 raised it from 10% in November). System 2 holds
  at ~20% and goes to grid below that — the reserve working as intended. Trade-off: ~32 kWh usable
  per system instead of ~36 kWh, in exchange for more outage backup.
- **Solar:** System 1 47–69 kWh/day vs System 2 29–42 kWh/day (≈40% less), consistent with the
  north-facing arrays being on System 2 in winter.
- **Batteries:** identical (3 × Powerwall 3 each, ~40.5 kWh).

### Biggest circuits (before the move, kWh/day)
| kWh/day (day / night) | Circuit | System |
|---|---|---|
| 29.5 (24.3 / 5.2) | Pool Subpanel | S1 (garage panel) |
| 20.4 (8.9 / 11.5) | "Laundry / Dryer & AC condenser Living Room" | S2 → **moved to S1** |
| 11.2 (6.6 / 4.6) | "AC Subpanel 2nd Floor bedrooms & AC condenser 2" | S1 |
| 9.5 (5.5 / 4.1) | "Dryer 2 / Master Bedroom & AC condenser Downstairs" | S2 → **moved to S1** |
| 8.6 (3.2 / 5.4) | Outlets / Rack 1 (network rack) | S1 |
| 3.5 | Subpanel Garage | S1 |
| ~1–3 each | Lutron lighting circuits 10/11/14, wine coolers, elevator & gate, fridges | mixed |

### Which condenser is which (SPAN circuit vs thermostat cooling, 5-min data)
- **"AC condenser Living Room"** circuit = the **Boardroom** zone: it ran in 99% of Boardroom
  cooling periods and 96% of its run time was during Boardroom cooling. The SPAN name is misleading.
- **"Master Bedroom & AC condenser Downstairs"** (peaks ~7.8 kW): runs mainly with Boardroom/Atrium
  cooling — most likely the **Atrium** unit. Weaker match (few run hours).
- **"AC Subpanel 2nd Floor bedrooms & AC condenser 2"** (System 1): a subpanel serving several zones
  (Kitchen, Master Bed and others), not a single room.
- Both System 2 condenser circuits stopped reporting at the move, and **one new 240 V circuit appeared
  on System 1 Mudroom (tabs 9:11)**, labeled "AC condenser / Living & AC condenser Master Bedroom".
  It peaked at 7.2 kW the first evening.

### What the move should do (estimate, from the before data)
- Shifts ~30 kWh/day to System 1: ~14 kWh daytime + ~16 kWh evening/overnight (less in
  Vacation mode, more when occupied and the Boardroom is cooled).
- **System 2:** day load drops to roughly 10–15 kWh against ~33 kWh of solar → should refill to
  ~60–70% on sunny days and end nights well above reserve.
- **System 1:** night load rises from ~18 to ~30+ kWh, close to its ~32 kWh usable above the 20%
  reserve. **Risk of overshoot on cloudy days or when the Boardroom is used heavily.** First night
  after the move: System 1 went 91% → 44% by 6 AM; System 2 held at reserve (20%) and drew ~1 kW from grid.
- Biggest lever left on System 1: the **pool subpanel (~24 kWh/day in daytime)** — check its schedule
  (pump/heater hours) before considering moving the Boardroom back.

### Other checks
- **Water heater:** see Walter's answers below — on System 1 (garage), drawing almost nothing; the early-Nov
  4.5 kW cycling on System 2 was the AC condensers, not the water heater.
- **Inverter watch:** running, 0 issues, 4 days learned (output check starts after 5 sunny days).
  Nov 16 sampled site total 81 kWh.


### Walter's answers (Nov 17)
- He moved the **Atrium and Boardroom ACs** — both now on **System 1 Mudroom, spaces 9–11**.
  The dryers did NOT move: System 2's "Laundry / Dryer & AC condenser Living Room" is now just
  **Downstairs Dryer**, and "Dryer 2 / Master Bedroom & AC condenser Downstairs" is just **Upstairs Dryer**
  (each breaker previously fed a dryer + a condenser). So before the move: "Living Room" condenser =
  Boardroom (99% match), "Master Bedroom/Downstairs" condenser = Atrium.
- He'll relabel SPAN circuits on site to match the thermostat names.
- **Water heater** is on the **garage panel (System 1)**: "Main House solar water heater", spaces 26–28.
  SPAN shows its relay ON (closed) but **~0.1 kWh/day since Nov 13** (max 7 W) — explained: T2 confirmed
  the new heater was **turned off after install because nobody is home**. Turn it back on ~1 day before
  arrival. When it's on, it adds load to **System 1** (same system now carrying Atrium + Boardroom AC),
  so prefer heating during midday solar (timer, or SPAN/HA schedule) rather than evenings.
- **Correction:** the ~4.5 kW cycling on System 2 in early November was **not** the water heater (that's
  on System 1). From Nov 7 on, 36 of 39 such switch-ons happened while the Atrium/Boardroom/Bar were
  cooling, so it was almost certainly the **AC condensers** (then on System 2). Data before Nov 7 has
  aged out of HA's 5-minute history.
- Walter plans to visit the week of Nov 29.

### Nov 22 finding: System 2 load that SPAN doesn't see
- At 10:23 AM HST Nov 22 (Vacation mode, sunny): Tesla System 2 load **3.3 kW**, but the System 2
  SPAN panel's circuits sum to only **~0.33 kW**. Over the past 6 days the gap averages **~1.1 kW**
  (max ~3.5 kW) and rises when AC zones are cooling (Beach Room, Sitting, Boardroom, Bar all
  +0.7–1.5 kW on average — confounded, since zones cool together).
- So **something on System 2 is fed from its Tesla gateway outside the SPAN panel** — most likely
  one or more AC condensers (the Bar / Beach Room units were never found on any SPAN circuit).
  This is what's eating System 2's morning solar.
- Same moment: System 1 at 87% and **exporting 4.5 kW**, while System 2 charged at only 1.9 kW —
  a live case for the cross-charge (reserve) test.
- **Ask Walter:** what does System 2's Tesla gateway feed besides the System 2 SPAN panel?
  Is there a separate (non-SPAN) panel or condenser disconnects?

### Questions for Walter
1. Which SPAN circuit(s) did you move? System 2's "Laundry / Dryer & AC condenser Living Room" and
   "Dryer 2 / Master Bedroom & AC condenser Downstairs" both disappeared and one new circuit (tabs
   9–11) appeared on System 1 Mudroom. **Did any dryers move with the condensers?**
2. Can the SPAN circuit names match the thermostats? The "Living Room" condenser is actually the
   Boardroom unit, and "Master Bedroom & condenser Downstairs" looks like the Atrium.
3. Which circuit is the new water heater on? Neither SPAN water heater circuit shows any load.
4. The island lights: did they move to the new dimmer? The old Lutron "Maui Island Lts" load turns
   on but nothing lights up.

### Questions for the solar installer
1. Which arrays feed which Tesla system? Measured winter solar is System 1 ~47–69 vs System 2
   ~29–42 kWh/day, which fits north-facing arrays 3, 6 and 8 being on System 2.
2. With Enphase branch circuits: can one north array on System 2 be **swapped** with a similar-size
   south array on System 1 (e.g. Array 6 or 8 ↔ Array 7)? Any interconnection or HECO paperwork needed?
3. Per-system PV limits for each Powerwall 3 system, and does a swap stay within them?

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

## 7. Nov 22 — battery balancing live; AC circuit test; Garage SPAN panel is on System 2 (CONFIRMED from data)

**Battery balance (ha-config/maui_battery_balance.yaml, installed + enabled):** first day ran two boosts of System 2's reserve
(~51% ≈10:50 HST, cut short when the house briefly imported; 60% ≈12:40–1:40 HST). System 2 finished the solar day at ~59%
(vs ~20% on recent days); System 1 was full from ~1 PM HST and exported ~3 h, so later/longer/higher boosts are worth trying
once a few normal days are logged. Dashboard tab "Battery Balance".

**AC circuit test (ha-config/maui_ac_circuit_test.yaml):** ran 11:22 AM–~2:20 PM HST, each of the 9 zones alone at 68°F.
Restore confirmed (test flag off, Solar-Aware Climate back on). System 1 Tesla load tracked SPAN Panel 1 step for step
(condenser steps 2–4 kW, peak ~9 kW); System 2 Tesla load stayed flat ~3.3 kW with no AC steps. Per-zone results below.

**Key finding — Garage SPAN panel (Pool Subpanel, Subpanel Garage, water heater) appears to be fed by SYSTEM 2, not System 1:**

| | before ~4 PM HST step | after |
|---|---|---|
| Tesla System 2 load | ~3.3 kW | 1.65 kW |
| SPAN Garage panel | ~3.0 kW | 1.34 kW |
| SPAN Panel 3 | ~0.5 kW | 0.50 kW |
| Garage + Panel 3 | ~3.5 kW | 1.84 kW |

Same-minute step, matching magnitude, and Garage + Panel 3 ≈ System 2 load before and after. This would explain the
"unmetered System 2 load" (it was metered — on the panel we had assigned to System 1) and much of the imbalance:
the pool subpanel (~29.5 kWh/day) and the water heater are on the battery bank that runs low.

To confirm: SPAN app Flow screen for the Garage panel (which Tesla system's numbers it shows); HA comparison of
sensor.span_panel_2_battery_battery_power against each Tesla system's battery power.

Question for Walter: *Is the Garage SPAN panel (pool subpanel + water heater) fed from System 2's Tesla gateway?
We had it as System 1.* If yes, options: move pool/water heater to System 1, or run them midday on solar.

Earlier sections that place Pool Subpanel / water heater on System 1 (sec. 1 SPAN table, sec. 6 top circuits and
move estimate) need correcting once confirmed.

### Nov 22 evening — confirmation and per-zone results

**Garage panel → System 2, confirmed over 10 h of HA history (2-min samples):**
- System 2 Tesla load vs SPAN Panel 3 + Garage: mean error **0.09 kW**, correlation **0.991**.
- System 2 Tesla load vs SPAN Panel 3 alone (old assumption): mean error 1.9 kW, correlation 0.14.
- System 1 Tesla load vs SPAN Panel 1 alone: correlation 0.95.
- Twist: the Garage SPAN panel's *battery* readings track System 1's Powerwalls (correlation 0.98), which is
  probably how it got labelled System 1. Its power, however, flows through System 2's gateway.
- The Garage step is a ~3 kW block from ~9:45 AM to ~3:45 PM HST (pool equipment on a timer, to confirm).

**AC circuit test, per zone** (each alone at 68°F for 12 min; changes < 0.6 kW are noise):

| Zone | System 1 Δ | System 2 Δ | Circuit that rose | Result |
|---|---|---|---|---|
| Atrium | +6.4 kW | −0.1 | P1 "AC condenser / Living & AC condenser Master Bedroom" +6.4 | System 1 |
| Bar | +1.0 | 0.0 | same P1 circuit +1.3 | System 1 |
| Beach Rm | +0.3 | 0.0 | same P1 circuit +1.3 | System 1 |
| Boardroom | +2.2 | +0.1 | same P1 circuit +2.4 | System 1 |
| Kitchen | −1.3 | −0.2 | — | no clear load (Honeywell command errors logged; retest) |
| MasterBed | +1.4 | −0.1 | P1 "AC Subpanel 2nd Floor bedrooms & AC condenser 2" +2.6 | System 1 |
| Molokini | +2.2 | 0.0 | same 2nd-floor circuit +2.0 | System 1 |
| Sitting | −0.2 | +0.1 | 2nd-floor circuit +1.0 | System 1 (weak) |
| UpMauka | +0.6 | −0.1 | P1 "AC condenser / Living..." +0.8 | System 1 |

**Conclusion:** no AC zone draws from System 2. Every condenser that ran showed up on SPAN Panel 1 (System 1),
on two circuits: zones sharing the "Living / Master Bedroom" condenser circuit (Atrium, Bar, Beach Rm, Boardroom,
UpMauka) and the "2nd Floor bedrooms" circuit (MasterBed, Molokini, Sitting). Walter's moves took the AC off System 2.
System 2's load is Panel 3's base load (~0.3–0.5 kW) plus the whole Garage panel (pool subpanel, garage subpanel,
water heater).

**Revised question for Walter:** *The Garage SPAN panel (pool subpanel, garage subpanel, solar water heater) is fed
from System 2's gateway, not System 1, even though its SPAN battery data shows System 1. Can the pool subpanel
and/or water heater move to System 1? If not, can the pool run hours be set to 10 AM–3 PM?* (Runs ~9:45–3:45 now.)
Note: with all AC now on System 1, moving the pool too would overload System 1 instead. Simplest lever may be
balancing (now automated) plus keeping the pool and water heater on midday solar.

**Nov 22 — pool schedule change (T2):** pool equipment (circulation, edge, spa pumps) moved to start 9–10 AM and end by
3 PM HST (was ~9:45 AM–4/4:30 PM, all on System 2 via the Garage panel). Measure with the Battery Balance scorecard
("System 2 at 5 PM") over the following days. OmniLogic HA integration: not a login issue — the built-in integration
crashes on pool + spa (two bodies of water); local HACS integration (cryptk/haomnilogic-local) is the option if HA
control is wanted later.

## 8. Nov 22 evening — disk full, Wall Kiosk 1.0.76/1.0.77

**Why add-on updates "never show up":** the HA Green (28 GB) had 0.6 GB free; Supervisor blocks every
add-on store refresh (`GitRepo.pull blocked … not enough free space`). Usage: system 10.4 GB, history
database 7.8 GB, 3 automatic backups 7.9 GB (each contains the DB; +~300 MB/day), add-on data 3.1 GB.

**Cause:** official SPAN integration (~Nov 19) — 388 entities updating every ~5 s = 89% of all state
writes (~1.2 M rows/day). Next: weather-station wind speed/direction.

**Done (T2 approved):**
- Deleted the Nov 19 and Nov 20 local backups (Nov 21 kept locally and in Nabu Casa cloud). Free → 5.2 GB.
- Backup retention 3 → 2 copies.
- New package `ha-config/maui_recorder.yaml`: 7-day history; SPAN recorded only for the three panel
  totals; wind speed/direction live only. Restarted HA (~6:57 PM HST); verified exclusions work.
- `recorder.purge_entities` (412 SPAN/wind entities) + `recorder.purge` keep 7 days with repack queued.
  DB file shrinks only when the repack runs — check size in the next review (expect ~1–2 GB).

**Wall Kiosk 1.0.76 → 1.0.77 installed** (store refresh worked once space was freed):
Solar Today/7-Day unit field fix; Envoy night-time "stale" fix; "Partial data" from overnight export
gaps fixed; Net Grid Power chart continuous + 5-min refresh. Verified on the wall: Solar Today
101.8 kWh (= 62.0 + 39.2), 7-Day 706.6 kWh, no Partial data warning.

**FIXED in Wall Kiosk 1.0.78 (installed Nov 22) — Running Net Balance priced the cross-charge as a purchase:** it costs each system's
imports and exports separately (System 2's 4.0 kWh boost import at the buy rate, System 1's export at
$0.04), but both systems share one meter, so energy moved between them is never bought. Today shows
−$0.03 when the meter actually net-exported 12.9 kWh. Fix: net the two systems per hour before pricing.

Wall Kiosk 1.0.78 verified: today's Running Net Balance +$0.51 (= 12.93 kWh net export × $0.04), was −$0.03.

## 9. Wall redesign + guest mode (agreed Nov 23, design canvas: "Mākena Wall — redesign directions")

Direction: "Mākena Day" sand palette, menu across the top. Two views:
- **Owners** — full wall (Home, Rooms, Lights, Climate, Shades, Music, Energy, Alarm, Cameras). Settings and
  edit controls hidden until the clock is held 3 s + owner PIN; edit re-locks after 10 min.
- **Guests (house mode Visitors)** — Rooms first: pick a room, control what's there (lights, shades, fans,
  room audio, climate 72–80°F, outside temp + "open the sliders" tip when ≥3° cooler outside), plus
  Cameras and Movement. No alarm, energy, house mode, settings or edit. Owner PIN to leave guest view.
- **Music (owners)** — pick rooms or presets (Whole house / Downstairs / Master suite / Outside), one
  source for the group, "All rooms" volume plus per-room volume. 13 Bluesound players.
- **Fans** — 6 Modern Forms WiFi ceiling fans: 4 guest suites, master bedroom, master sitting room.
  3 of 6 online in the Modern Forms app; T2 adding the rest. Then add via HA Modern Forms integration
  (local; auto-discovery on the Green's network, else by IP; reserve IPs in UniFi). Guests: Off/Low/Med/High
  (speeds 2/4/6 of 6) + 1-hour sleep timer; owners: all speeds, direction, timer. Bath exhaust fans
  (Lutron switches): on/off with 30-min auto-off.

**Decided (Nov 23):** guests cannot pick the master suite (bedroom, bath, sitting room, lanais, closets); it is owners-view only, including its two fans.

**Planned automation — pause AC while a slider is open** (T2: yes, Nov 23):
EyezOn zones 6 Bar Sliding Door → climate.bar; 17 Kitchen Sliding Door → climate.kitchen;
18 Great Room Sliding Door → climate.atrium. Door open 5 min → that zone's AC off (remember setpoint);
closed 2 min → restore. Show "AC paused — slider open" on the wall. Skip during storm prep.
Needs the live EyezOn zone entity IDs to confirm before building.

**Tablets (Nov 23):** 3 × Samsung Galaxy Tab A11+ (11", 1920×1200 → ~1280×800 CSS, same as the F-row designs).
Fully Kiosk Browser as launcher; Samsung "Protect battery" on; kiosk handles dim/wake.
- **Master / mobile** — owner view, opens to Home; in Visitors mode asks for the owner PIN after 10 idle minutes.
- **Molokini Suite** — guest-only, opens to Molokini Suite (`?room=molokini`), returns there when idle.
- **Beach Suite** — guest-only, opens to Beach Suite (`?room=beach`), returns there when idle.
Lights redesign agreed: Rooms tab (whole house on one screen, On/Off/Mixed tiles, tap to toggle) + Scenes tab.
**Wake-up (guest tablets, Nov 23):** time, tomorrow / every day of stay — choosing "every day" asks "When do you leave?" and repeats through that date (14-day backstop; any change out of Visitors also clears it). No per-suite stay tracking (T2: overkill).
music fade-up on suite speaker, lights fade over 10 min, shades open, tablet chime; snooze 9 min = music paused,
lights low, shades stay; live camera (Pool/Front entry/BBQ) on the wake screen. Runs in HA, not on the tablet.

## 10. Motion lighting + door-open AC pause (agreed Nov 23)

**Hardware to buy (all UniFi SuperLink, existing gateway):**
- 4 × USL-Motion, one per guest bath (Bed 2, 3, 4, 5). Checked Nov 23: no guest bath has a motion sensor today.
  - Existing sensors: USL Sitting, USL Bar/Pub, USL BBQ, UP-Sense stairs, UP-Sense equipment closet.
- 4 × USL-Entry, one per door:
  - Molokini (upstairs, ocean side) → `climate.maui_bar`
  - Mauka (upstairs, mountain side) → `climate.upper_mauka`
  - Beach (lower level, ocean side) → `climate.beach_room`
  - Boardroom (lower level, mountain side) → `climate.boardroom`
- Mounting: motion sensor high in a corner, aimed at the bathroom doorway. Entry-sensor magnet on the moving slider panel, sensor on the frame at the latch side.

**Motion lighting:**
- Existing night paths use blueprint `night_motion_lights.yaml`:
  - Sitting: `binary_sensor.usl_motion_sitting` → `light.sitting_lights`, 00:00–07:00, 20%, 5 min.
  - Stairs: UP-Sense → `light.stair_helper_lights`, 20%, dims to 5% after 2 min.
  - Pub: 00:00–06:00.
  - BBQ: 35%, 10 min.
- Keep these unchanged. The owner view gets an on/off switch and a "path on" indicator.
- Guest baths, once sensors arrive: use the same blueprint, targeting each bath's toe-kick light (Bed 4 and 5 have `..._toe_kick(s)`).
  - Day: normal on.
  - Night: dim warm path light only.
  - Manual override wins.
  - PIR off-delay about 10 minutes at night, longer by day, so someone sitting still is not left in the dark.

**Door-open AC pause (per zone):**
- Door open ≥ 3 min → store the zone's mode and setpoint, then turn the zone off.
- Door closed ≥ 2 min → restore the zone.
- `automation.maui_solar_aware_climate` must skip zones whose door is open.
- The Wall shows "Door open — AC paused" for the room. An owner switch disables the feature.
- The same logic covers the downstairs EyezOn sliders (zones 6, 17, 18) once their entity ids are confirmed.

### Suite map (T2, Nov 23 — authoritative)
| HA name | Room | Location | Thermostat | Night light for bath path (by friendly name; entity ids are scrambled — test in daytime) |
|---|---|---|---|---|
| Bed 2 | Beach | Ground floor, ocean side | `climate.beach_room` | "Bed 2 Bath Toe Kick" = `light.floor_1_exterior_bed_2_ext_sconces` |
| Bed 3 | Boardroom | Ground floor, mountain side; warmest in the AM (south-facing garage-door glass) | `climate.boardroom` | "Bed 3 Bath Toe Kick" = `light.floor_1_bedroom_2_suite_bed_2_bath_linear_lighting` |
| Bed 4 | Molokini | Upstairs, ocean side | `climate.maui_bar` | `light.floor_2_bedroom_4_suite_bed_4_bath_toe_kicks` |
| Bed 5 | Mauka | Upstairs, mountain side | `climate.upper_mauka` | `light.floor_2_bedroom_5_suite_bed_5_bath_toe_kick` |

### Ground-floor door → thermostat map (from T2's plan, Nov 23)
- Kitchen and Great Room are one open space (T2, Nov 23). If EITHER the Great Room west sliders (102A, zone 18) OR the Kitchen north sliders (102B, zone 17) are open, pause BOTH `climate.atrium` and `climate.kitchen`.
  - The Great Room supply is in the wall above the slider; the kitchen supply is over the pantry.
- Bar sliders (103A, to outdoor kitchen), alarm zone 6 → `climate.bar`.
- Beach (Bed 2) slider 107A → `climate.beach_room` (new USL-Entry).
- Boardroom (Bed 3) glass garage-style door → `climate.boardroom` (new USL-Entry).
- Bath 2 and Bath 3 outdoor-shower doors (108D, 111B): not covered, by choice.
- Motion sensors: Bath 2 and Bath 3, high in the corner by the door from the bedroom, aimed into the bath.

### Upstairs door → thermostat map (from T2's plan, Nov 23)
- Molokini (Bed 4): west slider 206A to the Bed 4 lanai → `climate.maui_bar` (new USL-Entry).
- Mauka (Bed 5): east slider 211A to the Bed 5 lanai → `climate.upper_mauka` (new USL-Entry).
- Bath 4 outdoor door 207D: not covered, by choice (same as downstairs).
- Master suite (201 sliders 201A/201D, sitting 202A): owner-managed, no sensors planned.
- Motion sensors: Bath 4 and Bath 5, high in the corner by the door from the bedroom/WIC, aimed into the bath.
- Note: the Great Room is double-height ("open to below" upstairs), which fits the Atrium thermostat serving it.

### Final shopping list
- 4 × USL-Entry (Beach 107A, Boardroom glass door, Molokini 206A, Mauka 211A)
- 4 × USL-Motion (Baths 2–5)

### Suite "in use today" (decided Nov 23)
- A guest suite counts as in use if, in the last 24 h, any of these had activity: bath motion, slider, lights or music.
- No manual toggle and no checkout date. Shown on the Home map as "G" and in the "Right now" panel.

### Scenes (decided Nov 23)
- Scenes live in Home Assistant, not the Wall app, so the tablet, phone and automations share them.
- Starter set: Good morning, Sunset, Good night, Leave, Dinner, Entertain Evening (exists, 23 lights), Master reading, Master night.
- Light levels are set by "capture": T2 sets a room, then taps "+ Save as scene" on the tablet.
- BUILT Nov 23: `script.maui_leave` ("Maui — Leave"). It turns off all lights and closes all 12 Lutron shades. It never touches the garage door. Not run yet.
- TVs get their own tab later. The existing TV scripts (Netflix, Max, Apple TV, Watch TV) are unreliable; revisit on site.

### Overnight spikes on System 1 (found Nov 23)
- About 735 W for roughly 30 s, every 12–20 min, all night.
- Caught live at 07:10 HST on circuit `sensor.span_panel_outlets_kitchen_dishwasher_power` (0 → 735 W → 0 over 33 s).
- CONFIRMED (T2, Nov 23): the kitchen has an Insta-Hot tap, which is the source. About 0.6–0.7 kWh/day.
- On site: check under the kitchen sink. Turn the tank down or off, or put it on a daytime smart plug. If there is no tank, have the dishwasher serviced for idle heating.

## 11. Wall build — phase 1 shipped (Nov 23, add-on 1.0.80)
- New design preview: classic Settings › "New wall design" › Try it. "Classic view" in the header switches back. The choice is stored per tablet (localStorage `wall:ui`).
- Live updates: `POST /api/ha/stream` holds one HA websocket per tablet and pushes changes; the tablet falls back to 6-second polling after 3 failures. The header shows Live / Polling / Offline.
- Home screen is live: floor-plan map (lights, temperatures, doors, motion, music, suites in use), power strip, Right now panel, and All lights off / Open shades / Close shades / Leave (each needs a second tap to confirm).
- Verified on HA at 1280×800: Live, real values. Room taps and quick buttons have not been exercised, to avoid switching lights in the house remotely.
- Next screens, in order: Lights (rooms + scenes + capture), Music, Climate, Shades, Energy, Alarm, Cameras, then the guest view and the night look.

## 12. Guest tablets and wake-up (Nov 23)
- Wall 1.0.89–1.0.91: Rooms screen; per-tablet guest mode ("This tablet" → a suite; "Owner" + storm-prep PIN to leave). Guests see only their own suite plus the shared rooms, Wake-up and the outdoor cameras.
- `packages/maui_wake.yaml` (installed Nov 23, config valid). Per suite (beach, boardroom, molokini, mauka):
  - Helpers `wake_<suite>_*`: enabled, time, repeat, until, lights, shades, voice, ringing; `timer.wake_<suite>_snooze` (9 min).
  - Automation `maui_wake_<suite>`: fades up that suite's bedroom lights (not bath or closet), opens its bedroom shades, and says good morning on its speaker via Nabu Casa TTS (Beach and Molokini only) up to 3 times. Ringing ends after 20 minutes.
  - Scripts `wake_<suite>_snooze` / `wake_<suite>_stop`.

## 13. Battery balance bug found and fixed (Nov 23, ~4:30 PM HST)
- System 2's reserve was raised to 73% at 1:55 PM. Tesla then reported a stale 20% (1:56–2:57 PM), so the 14:45 safety reset saw "already 20%" and did nothing. The real reserve stayed at 73% into late afternoon: System 2 bought 0.46 kW from the grid while System 1 exported 1.9 kW.
- Fixed by hand at 4:29 PM: S2 reserve set to 20% (logged). S2 then supplied its own load and grid import went to 0.
- Package fix (installed, config valid): the safety reset now also runs at 15:30 and 16:40, and on scheduled runs always sends 20% regardless of the reported value.

## 14. False manual holds fixed (Nov 23)
- Cause: at 3:34 PM, switching Suspend → Vacation made the solar automation set 84°. About 15 s later, Honeywell TCC briefly reported the old 78° with no automation context, so the hold automation started 2-hour holds on Beach and Boardroom.
- Fix (live in HA, automation id 1784393891358, mirrored in `ha-config/maui_manual_hold.yaml`): ignore changes within 4 minutes after the solar automation runs or the house mode changes.

## 15. Molokini thermostat (Nov 23)
- T2 confirmed `climate.maui_bar` is the Molokini suite (its Honeywell name is already "Maui-Molokini"; no rename needed).
- Solar-aware climate (automation id 1781981986844): moved from the open-air group (forced off 5–9 PM in Owners/Visitors) to the rest/bedroom group.
- Manual hold automation now triggers on it, and `timer.maui_hold_maui_bar` was added in `maui_solar_tier_package.yaml`.
- Wall: guest occupancy now comes from wake-ups, not from 24 h of activity.

## 16. Nov 24 — utility bill, pool schedule, one-week AC-move check

**Oct bill (Sep 23–Oct 22, Smart Export, R TOU).** Received 932 kWh: 831 kWh in the 9 AM–4 PM window earned
nothing; 101 kWh (4 PM–9 AM) earned $14.55 = 14.41¢/kWh. Delivered 209 kWh (overnight 153, evening peak 24,
daytime 32). Note the *purchase* periods on the bill are 9–5 / 5–9 PM / 9 PM–9 AM, while paid export starts at
4 PM. Effective buy rates (Oct): ~25¢ day, ~73¢ 5–9 PM, ~49¢ overnight. This bill predates the Nov 22 balancer
and pool changes. Biggest bills are occupied winter months (Feb 1,565 kWh / $636, Mar 1,259 kWh / $491), so
Dec–Mar bills are the real test.

**Pool schedule (T2, set Nov 24 in OmniLogic, daily):**

| Pump | Schedule |
|---|---|
| Main filter | 8:30–11:59 AM 2016 rpm · 11:59 AM–2 PM 3008 rpm · 2–4 PM 1504 rpm |
| Edge (infinity booster) | 11 AM–2 PM 2173 rpm |
| Spa | 12–1 PM 2000 rpm |
| All | off 4 PM–8:30 AM |

Pool 51,950 gal incl. surge trough; HydraPure UV max 120 GPM (design flow 144 — bypass unverified), so the
3008 rpm step must stay under ~120 GPM through the UV branch. Watch for a week: water clarity/chlorine (if it
slips, raise 2–4 PM to 2000 or start at 8 AM), edge sheet at 2173 (raise ~200 rpm only if it breaks), System 2
near full by ~4 PM on sunny days (trim edge first, then the 3008 peak). House empty → edge ~1 h at noon.

**Morning snapshot Nov 24, ~5:45 AM HST (Tesla app):** S1 68 % / 0.8 kW, S2 45 % / 0.7 kW, grid 0 on both —
no overnight purchase.

**One-week AC-move check (scheduled):** could not run — no Home Assistant access from the check-in session
(the desktop browser link was offline). Still to do: before/after comparison (excluding Nov 17 12:19 PM–Nov 19
~11:20 AM Suspend), S1 still reaching ~100 %, overnight battery vs grid kWh, the ~1–3.5 kW of S2 load not on
span_panel_3, and whether solar-tier pre-cooling cools S2 rooms.
