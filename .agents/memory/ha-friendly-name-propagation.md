---
name: HA friendly-name renames & multi-house climate filtering
description: Why thermostat renames don't propagate in HA and how the Maui kiosk decides which climate entities are Maui
---

# Honeywell TCC thermostats inherit the device name

Renaming a Honeywell TCC **entity** (entity settings → Name) often does NOT change
its `friendly_name`, because the thermostat is the primary entity of its device and
inherits the **device** name. To actually change the displayed name you must rename
the **device** (Settings → Devices & Services → Devices → the thermostat → rename),
and decline the "also rename entity_ids?" prompt to keep slugs stable.

**Why it matters:** users (and we) can spend turns "refreshing" expecting a name
change that never lands. Friendly-name renames are otherwise instant (no restart),
so if a name looks stale in Developer Tools → States, it's the device-inheritance
trap, not a cache.

# One HA instance hosts multiple houses (Maui, Mercer Island = "MI", Bend)

`isMauiClimate` in `artifacts/ha-yaml/src/components/Wall.tsx` decides which climate
entities show on the Maui-only kiosk Climate tab.

**Decision:** key the Maui set off a stable **entity_id allowlist**, not friendly-name
prefixes.

**Why:** prefix filtering ("exclude names starting with MI/Bend") was leaky — the
MI/Bend thermostats' entity_id slugs carry no house marker (e.g. `climate.apartment`,
`climate.kitchen_2`, `climate.thermostat` is actually Bend), and friendly-name renames
don't reliably propagate (see above), so MI/Bend units leaked into the Maui tab.

**How to apply:** when a Maui thermostat is added in HA, add its entity_id to
`MAUI_CLIMATE_IDS`. The same 9-entity Maui set drives the `maui_climate` list in the
HA climate-routine automation. Known Maui climate entity_ids: atrium, bar, beach_room,
boardroom, kitchen, master_bed_2, maui_bar, sitting, upper_mauka. (Note the `_2`
inversion: `climate.kitchen`/`climate.master_bed_2` are Maui while `climate.kitchen_2`/
`climate.master_bed` are Mercer Island.)
