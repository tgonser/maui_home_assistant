---
name: Solar tier cooling matrix
description: Maui climate is driven by a per-mode x solar-tier x room-group input_number matrix; pitfalls with initial: and Jinja whitespace
---
- Tiers from sensor.maui_solar_smoothed (15-min SMA of sensor.total_solar), not raw kW. Trigger-based state machine: down boundaries 5/10/15/20, up +3 (8/13/18/23), 20-min dwell via this.last_changed, one step per /5-min eval. User spec: treat solar as trend, never react to clouds.
- Matrix helpers: input_number.maui_ct_{owners|visitors|vacation}_{tier}_{master|sitting|rest}. Groups: master=master_bed_2, sitting=sitting, rest=boardroom/beach_room/upper_mauka. Atrium/bar/maui_bar/kitchen excluded (doors open) but still forced off during peak 5-9pm.
- Battery no longer affects targets (user chose purely solar-driven). Peak still forces 84; dew floor raises only; infiltration +2; cap 84.
- **Why pitfalls matter:** `initial:` on input_number resets the value on every HA restart — never use it for user-editable settings; kiosk seeds defaults via set_value instead. Jinja variables concatenated into entity IDs must be single-line templates (folded `>-` blocks emit whitespace, breaking states() lookups and silently falling back to 84).
- Kiosk haCallService returns {ok:false} instead of throwing — always check .ok and roll back optimistic UI.

## Priority hierarchy (user-approved July 2026)
1. Suspend 2. Dew-point floor (absolute — raises even manually-held rooms; falls back to 78° when sensor missing) 3. Open-air peak shutoff 5-9pm (Owners/Visitors only, ignores holds; in Vacation doors are closed so open-air rooms follow the rest-group target instead) 4. Manual hold (8h in Owners/Visitors, 2h in Vacation — changed July 2026 after caretaker's changes kept snapping back) 5. Peak backoff 84° 6. Night/solar matrix 7. Fan dehumidify.
**Why:** user explicitly ruled that safety/hard-waste rules beat manual holds; holds only beat comfort rules.
**How to apply:** any new rule must be slotted into this order; kiosk status card must mirror the automation's final-target math exactly (incl. the 78° fallback) or displayed "applied" targets diverge from HA.
