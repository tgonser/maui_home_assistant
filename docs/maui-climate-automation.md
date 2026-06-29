# Maui Solar-Aware Climate Automation

## Overview

The Maui house runs two HA automations that work together to keep the home comfortable while protecting the battery system and maximizing the value of solar production.

- **Maui Solar-Aware Climate** — sets AC setpoints every 30 minutes based on solar output, battery level, time of day, and house mode
- **Maui Auto Presence** — watches indoor motion sensors and automatically switches the house mode between Owners Home and Vacation

---

## House Modes

The mode is set manually from the wall kiosk (or automatically by the presence automation). It determines which rooms are controlled and how aggressively they are cooled.

| Mode | Rooms Controlled | Purpose |
|---|---|---|
| **Owners Home** | Boardroom, Sitting, Master Bed | Owners present — core comfort rooms only |
| **Visitors** | All 9 rooms | Guests staying — full house cooled |
| **Vacation** | All 9 rooms | Nobody home — light cooling to protect the house |
| **Suspend** | None | Automation paused entirely — manual control |

**Note:** In Owners Home mode, guest rooms (Atrium, Kitchen, Bar, Beach Room, etc.) are intentionally left uncontrolled. Doors are typically open and cooling those spaces would be wasteful. Any guest room can be controlled manually at any time via the Honeywell app or kiosk.

---

## Energy States

Each 30-minute cycle, the automation reads the 15-minute rolling average of solar production (`sensor.solar_15min_avg`) and battery level. Using the rolling average prevents brief cloud cover (2–3 minutes) from triggering a tier change. The energy situation is classified into one of five states:

### Solar Awesome
**Condition:** 15-minute average solar production > 14 kW

Peak solar output — the house is producing far more than it can consume. AC is pushed to its most aggressive setpoints. The excess energy is best stored as cool air in the building's thermal mass rather than exported.

### Solar Good
**Condition:** Battery ≥ 80% OR solar production > 10 kW

Abundant energy. AC setpoints are comfortable. Running the AC at this tier is essentially free — surplus solar is stored in the battery or in the building's thermal mass.

### Moderate
**Condition:** Solar is producing but battery is not yet full and production is under 10 kW

Some headroom exists but not abundantly. Setpoints are raised slightly to reduce load while the battery continues charging.

### Outside Active Window
**Condition:** The sun is not yet at the angle to heat that room's windows

East-facing rooms are only actively cooled between 9 AM and 2 PM HST. West-facing rooms are cooled from noon to 9 PM HST. Outside these windows the rooms hold at a conservative setpoint — no point pre-cooling a room that isn't being heated yet.

### Protect / Peak
**Condition:** Battery below protect threshold AND solar below 10 kW, OR it is 5–9 PM HST

The battery is low and solar cannot cover demand, or it is peak evening hours ($0.57/kWh) when the battery is needed for overnight use. The automation raises all setpoints to the protect level and lets the house drift. This is a hard override — no other tier applies during peak hours regardless of solar or battery state.

---

## Vacation Grid Draw Protection

**Condition:** House mode is Vacation AND `(home load − solar) > grid draw limit`

When nobody is home and the house is buying power from the grid beyond the configured limit, the AC backs off to the inactive setpoint (82 °F). There is no point cooling an empty house at grid expense.

- The threshold is configurable from the kiosk Settings tab (`maui_grid_protect_kw`, default 0 kW — any net grid draw triggers the setback)
- This protection only applies in Vacation mode. Owners and Visitors can draw from the grid freely during daytime hours ($0.17/kWh)
- During peak hours (5–9 PM) the standard peak protect takes priority regardless

---

## Setpoint Logic (Priority Order)

All setpoints are configurable from the kiosk Settings tab without editing any YAML.

| Priority | Condition | All Modes |
|---|---|---|
| 1 | Peak hours (5–9 PM) OR low battery + low solar | 84 °F |
| 2 | Vacation + net grid draw > limit | 82 °F |
| 3 | Outside active window for that zone | 82 °F |

If none of the above apply, the setpoint is chosen by solar tier and house mode:

| Energy State | Owners Home | Visitors | Vacation |
|---|---|---|---|
| Solar Awesome (> 14 kW) | 72 °F | 74 °F | 80 °F |
| Solar Good (batt ≥ 80% or solar > 10 kW) | 74 °F | 76 °F | 82 °F |
| Moderate | 79 °F | 81 °F | 84 °F |

**Boardroom** has an additional hard cap of 78 °F in all conditions to protect the wood and glass wall.

---

## Dew Point Awareness (Moisture-First Control)

In a tropical oceanfront house the real enemy is not heat, it is **moisture**. Condensation forms whenever a surface falls below the surrounding air's dew point, which damages wood, steel, glass, artwork, and finishes. This layer makes the automation control humidity first and temperature second — the way high-end resorts and museums run their HVAC.

**Priority order:** 1) Prevent condensation → 2) Protect materials → 3) Comfort → 4) Battery → 5) Solar self-consumption.

> A house at 78 °F / 58 °F dew point is safer and more comfortable than one at 73 °F / 70 °F dew point.

### Dew Point Sensors

Dew point is computed with the Magnus formula from temperature + relative humidity.

| Sensor | Source | Notes |
|---|---|---|
| `sensor.maui_outdoor_dew_point` | Tempest weather station | Prefers the Tempest's native dew point reading; falls back to Magnus from its temp/humidity. **Fails safe** (reports unknown) if the Tempest is offline. |
| `sensor.maui_indoor_dew_point` | Honeywell `climate.*` zones | The **maximum** dew point across rooms — the wettest air drives protection. |
| `sensor.maui_indoor_dew_point_status` | derived | Excellent / Target / Acceptable / Warning / High humidity risk. |
| `sensor.maui_dew_point_setpoint_floor` | derived | The minimum allowed setpoint for the current outdoor dew point (table below). |
| `sensor.maui_indoor_dew_point_rate` | derivative | °F/min rise, smoothed over 15 min — used for infiltration detection. |

### Outdoor Dew Point Floor (overrides solar pre-cooling)

The final setpoint is `max(solar/battery target, dew point floor)`. A high outdoor dew point **raises** the minimum setpoint so cold surfaces are never driven below the outside dew point. This overrides aggressive solar pre-cooling — e.g. if excess solar would normally cool to 72 °F but the outdoor dew point is 74 °F, cooling is limited to 76 °F.

| Outdoor Dew Point | Minimum Indoor Setpoint | Helper |
|---|---|---|
| < 65 °F | 72 °F | `maui_dewfloor_under65` |
| 65–69 °F | 74 °F | `maui_dewfloor_65_69` |
| 70–72 °F | 75 °F | `maui_dewfloor_70_72` |
| 73–75 °F | 76 °F | `maui_dewfloor_73_75` |
| > 75 °F | 78 °F | `maui_dewfloor_over75` |

If the outdoor dew point is unknown (e.g. the Tempest integration is disconnected), the floor defaults to the **warmest** band so a dead sensor can never cause aggressive over-cooling.

### Indoor Dew Point Targets & Dehumidification

| Indoor Dew Point | Status |
|---|---|
| < 58 °F | Excellent |
| 58–62 °F | Target |
| 62–65 °F | Acceptable |
| 65–68 °F | Warning |
| > 68 °F | High humidity risk |

When indoor dew point rises above the target (`maui_indoor_dewpoint_target`, default **64 °F**), the automation **prioritises dehumidification**: it reduces fan speed where the equipment supports a low/quiet setting so the coil runs longer and removes more moisture (latent heat) rather than just moving air. On equipment with no low fan setting this step safely no-ops.

### Infiltration Detection

A rapid indoor dew point rise means doors/windows were opened or a slug of humid outside air got in. When `sensor.maui_indoor_dew_point_rate` exceeds `maui_infiltration_rate` (default **0.2 °F/min ≈ 3 °F in 15 min**) for one minute:

- `input_boolean.maui_infiltration_active` turns on and a **30‑minute hold** (`timer.maui_infiltration`) starts.
- Aggressive solar pre-cooling is suspended and a **+2 °F buffer** is added to setpoints, so the system does not chase a moving humidity target with cold surfaces.
- The hold clears automatically when the timer finishes.

### New Configurable Parameters

| Helper | Default | Description |
|---|---|---|
| `maui_dewfloor_under65` | 72 °F | Min setpoint, outdoor dew point < 65 °F |
| `maui_dewfloor_65_69` | 74 °F | Min setpoint, outdoor dew point 65–69 °F |
| `maui_dewfloor_70_72` | 75 °F | Min setpoint, outdoor dew point 70–72 °F |
| `maui_dewfloor_73_75` | 76 °F | Min setpoint, outdoor dew point 73–75 °F |
| `maui_dewfloor_over75` | 78 °F | Min setpoint, outdoor dew point > 75 °F |
| `maui_indoor_dewpoint_target` | 64 °F | Indoor dew point above which dehumidification is prioritised |
| `maui_infiltration_rate` | 0.2 °F/min | Indoor dew point rise rate that flags infiltration |

> **Setup:** the YAML lives in `ha-config/` — `maui_dewpoint_package.yaml` (sensors, helpers, infiltration) and `maui_solar_aware_climate.yaml` (the updated main automation). Set your real Tempest entity ids in the outdoor dew point sensor before enabling.

---

## Room Windows (East vs West)

The house has a distinct east/west solar exposure pattern. The automation treats rooms differently based on which direction they face.

**East-facing rooms** — active cooling window 9 AM – 2 PM HST
- Boardroom (glass sunrise wall, capped at 78 °F)
- Sitting Room
- Upper Mauka (guest)

**West-facing rooms** — active cooling window noon – 9 PM HST
- Master Bed
- Atrium
- Bar / Maui Bar
- Beach Room
- Kitchen

---

## Battery Protection

Two battery thresholds govern when the automation shifts into conservative mode. The automation uses the **lower** of the two battery systems (to account for unbalanced AC loads between the two systems).

- **Protect threshold (default 25%)** — if the lower battery falls below this AND solar is under 10 kW, all rooms go to protect setpoint. Solar production overrides this: strong production means the house is running off solar regardless of battery state.
- **Good threshold (default 80%)** — above this the battery is considered full and Solar Good setpoints apply even if solar production is temporarily low.

---

## Peak Hours

5 PM – 9 PM HST is treated as peak regardless of solar or battery level ($0.57/kWh vs $0.17/kWh off-peak). This window protects evening battery reserves for overnight use. During peak hours the automation always applies the protect setpoint — it is the first check in the logic and cannot be overridden.

---

## Solar Averaging

The automation references `sensor.solar_15min_avg` — a 15-minute rolling mean of `sensor.total_solar` — rather than the instantaneous reading. This prevents brief cloud cover from triggering a tier change. A genuine weather shift (sustained overcast) shows up in the average within 10–15 minutes.

---

## Auto Presence

A separate automation watches five indoor motion sensors (kitchen, upstairs, staircase, sitting room, bar). It runs every hour and on any motion trigger.

- **Motion detected in the last hour + mode is Vacation** → switches to Owners Home, sends push notification to Tom's iPhone
- **No motion for a full hour + mode is Owners Home** → switches back to Vacation
- **Visitors or Suspend modes are never touched automatically**

Outdoor cameras are intentionally excluded to avoid false triggers from wind, wildlife, and passing cars.

---

## Configurable Parameters

All setpoints and thresholds are stored as Home Assistant `input_number` helpers and can be adjusted live from the kiosk Settings tab. Changes take effect on the next 30-minute automation run.

| Helper | Default | Description |
|---|---|---|
| `maui_temp_owners_awesome` | 72 °F | Owners Home setpoint — solar awesome |
| `maui_temp_visitors_awesome` | 74 °F | Visitors setpoint — solar awesome |
| `maui_temp_vacation_awesome` | 80 °F | Vacation setpoint — solar awesome |
| `maui_temp_owners_good` | 74 °F | Owners Home setpoint — solar good |
| `maui_temp_visitors_good` | 76 °F | Visitors setpoint — solar good |
| `maui_temp_vacation_good` | 82 °F | Vacation setpoint — solar good |
| `maui_temp_owners_mod` | 79 °F | Owners Home setpoint — moderate |
| `maui_temp_visitors_mod` | 81 °F | Visitors setpoint — moderate |
| `maui_temp_vacation_mod` | 84 °F | Vacation setpoint — moderate |
| `maui_temp_inactive` | 82 °F | All modes — outside active window |
| `maui_temp_protect` | 84 °F | All modes — protect / peak hours |
| `maui_temp_boardroom_max` | 78 °F | Boardroom hard cap |
| `maui_solar_awesome` | 14 kW | Solar threshold for "awesome" tier |
| `maui_solar_good` | 10 kW | Solar threshold for "good" tier |
| `maui_batt_good` | 80 % | Battery threshold for "good" tier |
| `maui_batt_protect` | 25 % | Battery threshold for protect mode |
| `maui_grid_protect_kw` | 0 kW | Vacation grid draw limit before AC backs off |

---

## Key Entities

| Entity | Description |
|---|---|
| `input_select.maui_house_mode` | Current house mode (Owners Home / Visitors / Vacation / Suspend) |
| `sensor.gonser_4680_system_1_percentage_charged` | Battery 1 state of charge |
| `sensor.4680_system_2_percentage_charged` | Battery 2 state of charge |
| `sensor.total_solar` | Total solar production — instantaneous (kW) |
| `sensor.solar_15min_avg` | Total solar production — 15-minute rolling average (kW) |
| `sensor.total_home_load` | Total home load (kW) |
| `climate.boardroom` | Boardroom AC — east, capped at 78 °F |
| `climate.sitting` | Sitting Room AC — east |
| `climate.master_bed_2` | Master Bedroom AC — west |
| `climate.upper_mauka` | Upper Mauka guest room — east |
| `climate.atrium` | Atrium — west |
| `climate.bar` / `climate.maui_bar` | Bar areas — west |
| `climate.beach_room` | Beach Room — west |
| `climate.kitchen` | Kitchen — west |
