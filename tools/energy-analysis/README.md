# Energy analysis scripts (Nov 2026)

Ad-hoc scripts used for `docs/maintenance-2026-11.md`. They read JSON dumps pulled
read-only from HA over the websocket (run in the browser console of a logged-in HA tab,
`hass = document.querySelector('home-assistant').hass`).

## Inputs

**Hourly statistics** (for `parse.py`, then `cap.py`):
```js
const ids = ['gonser_4680_system_1','4680_system_2'].flatMap(p =>
  ['load_power','solar_power','battery_power','grid_power','percentage_charged'].map(s => `sensor.${p}_${s}`));
const r = await hass.connection.sendMessagePromise({type:'recorder/statistics_during_period',
  start_time: new Date(Date.now()-35*86400e3).toISOString(), statistic_ids: ids, period:'hour', types:['mean']});
// compact: {s1_load_power: "epochHour:mean,...", ...}
```

**Raw history** (for `ac.py`, `nights.py`, `cyc.py`): `history/history_during_period`
for the Maui `climate.*` entities (with attributes, for `hvac_action`) and the two
`*_load_power` sensors, compacted to `"epochSeconds:value,..."` strings.

The scripts expect the browser-tool output wrapper (`[{type, text}]`) and strip it;
adjust the loader if you save plain JSON.

## Scripts
- `parse.py` — per-night (5 PM–9 AM HST) load / battery / grid kWh and min SOC per system; writes `stats.json`
- `cap.py` — daytime charging, SOC at 9 AM/5 PM, implied usable capacity
- `ac.py` — maps each thermostat to System 1/2 by load steps at cooling start/stop; cooling hours/day
- `nights.py` — hourly overnight load per night; S2 load jumps
- `cyc.py` — counts ~4.5 kW switch-on events per 6 h (water heater check)

Battery power sign: positive = discharging. Times are HST (UTC−10).
