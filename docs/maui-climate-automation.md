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
