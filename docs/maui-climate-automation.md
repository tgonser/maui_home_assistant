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

---

## Energy States

Each 30-minute cycle, the automation reads the current solar production and battery level and classifies the energy situation into one of four states:

### Solar Good
**Condition:** Battery ≥ 80% OR Solar production > 10 kW

The house has abundant energy. AC setpoints are at their most comfortable. Running the AC aggressively at this point is essentially free — surplus solar is stored as cool air in the thermal mass of the building rather than being exported to the grid.

### Moderate
**Condition:** Solar is producing but battery is not yet full and production is under 10 kW

Some headroom exists but not abundantly. Setpoints are raised slightly to reduce load while the battery continues charging.

### Outside Active Window
**Condition:** The sun is not yet at the angle to heat that room's windows

East-facing rooms (Boardroom, Sitting, Upper Mauka) are only actively cooled between 9 AM and 2 PM HST. West-facing rooms (Master Bed, Atrium, Bar, Beach Room, Kitchen, Maui Bar) are cooled from noon to 9 PM HST. Outside these windows the rooms hold at a conservative setpoint — no point pre-cooling a room that isn't being heated yet.

### Protect / Peak
**Condition:** Battery below protect threshold AND solar below 10 kW, OR it is 5–9 PM HST

The battery is low and solar cannot cover demand, or it is peak evening hours when the grid is expensive and the battery is needed for overnight use. The automation raises all setpoints to the protect level and lets the house drift — the priority is preserving battery capacity for the evening and overnight.

---

## Setpoint Logic

All setpoints are configurable from the kiosk Settings tab without editing any YAML.

| Energy State | Owners Home | Visitors | Vacation |
|---|---|---|---|
| Solar Good | 74 °F | 76 °F | 80 °F |
| Moderate | 79 °F | 81 °F | 84 °F |
| Outside Active Window | 82 °F | 82 °F | 82 °F |
| Protect / Peak | 84 °F | 84 °F | 84 °F |

**Boardroom** has an additional hard cap of 78 °F in all conditions to protect the wood and glass wall.

---

## Room Windows (East vs West)

The house has a distinct east/west solar exposure pattern. The automation treats rooms differently based on which direction they face.

**East-facing rooms** — active cooling window 9 AM – 2 PM HST
- Boardroom (glass sunrise wall)
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

Two battery thresholds govern when the automation shifts into conservative mode:

- **Protect threshold (default 25%)** — if both batteries fall below this AND solar is under 10 kW, all rooms go to protect setpoint. Solar production overrides this: 20 kW of sun means the house is running entirely off solar regardless of battery state.
- **Good threshold (default 80%)** — above this the battery is considered full and Solar Good setpoints apply even if solar production is temporarily low.

---

## Peak Hours

5 PM – 9 PM HST is treated as peak regardless of solar or battery level. This window protects evening battery reserves for overnight use and aligns with grid peak pricing. During peak hours the automation always applies the protect setpoint.

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
| `maui_temp_owners_good` | 74 °F | Owners Home setpoint when solar is good |
| `maui_temp_visitors_good` | 76 °F | Visitors setpoint when solar is good |
| `maui_temp_vacation_good` | 80 °F | Vacation setpoint when solar is good |
| `maui_temp_owners_mod` | 79 °F | Owners Home setpoint when moderate |
| `maui_temp_visitors_mod` | 81 °F | Visitors setpoint when moderate |
| `maui_temp_vacation_mod` | 84 °F | Vacation setpoint when moderate |
| `maui_temp_inactive` | 82 °F | All modes — outside active window |
| `maui_temp_protect` | 84 °F | All modes — protect / peak hours |
| `maui_temp_boardroom_max` | 78 °F | Boardroom hard cap |
| `maui_solar_good` | 10 kW | Solar production threshold for "good" state |
| `maui_batt_good` | 80 % | Battery level threshold for "good" state |
| `maui_batt_protect` | 25 % | Battery level threshold for protect mode |

---

## Key Entities

| Entity | Description |
|---|---|
| `input_select.maui_house_mode` | Current house mode (Owners Home / Visitors / Vacation / Suspend) |
| `sensor.gonser_4680_system_1_percentage_charged` | Battery 1 state of charge |
| `sensor.4680_system_2_percentage_charged` | Battery 2 state of charge |
| `sensor.total_solar` | Total solar production (kW) |
| `sensor.total_home_load` | Total home load (kW) |
| `climate.boardroom` | Boardroom AC — east, capped at 78 °F |
| `climate.sitting` | Sitting Room AC — east |
| `climate.master_bed_2` | Master Bedroom AC — west |
| `climate.upper_mauka` | Upper Mauka guest room — east |
| `climate.atrium` | Atrium — west |
| `climate.bar` / `climate.maui_bar` | Bar areas — west |
| `climate.beach_room` | Beach Room — west |
| `climate.kitchen` | Kitchen — west |
