---
name: Solar tier cooling matrix
description: Maui climate is driven by a per-mode x solar-tier x room-group input_number matrix; pitfalls with initial: and Jinja whitespace
---
- Tiers from sensor.total_solar (kW): <=5 poor, <=10 fair, <=15 good, <=20 strong, >20 excellent (sensor.maui_solar_tier).
- Matrix helpers: input_number.maui_ct_{owners|visitors|vacation}_{tier}_{master|sitting|rest}. Groups: master=master_bed_2, sitting=sitting, rest=boardroom/beach_room/upper_mauka. Atrium/bar/maui_bar/kitchen excluded (doors open) but still forced off during peak 5-9pm.
- Battery no longer affects targets (user chose purely solar-driven). Peak still forces 84; dew floor raises only; infiltration +2; cap 84.
- **Why pitfalls matter:** `initial:` on input_number resets the value on every HA restart — never use it for user-editable settings; kiosk seeds defaults via set_value instead. Jinja variables concatenated into entity IDs must be single-line templates (folded `>-` blocks emit whitespace, breaking states() lookups and silently falling back to 84).
- Kiosk haCallService returns {ok:false} instead of throwing — always check .ok and roll back optimistic UI.
