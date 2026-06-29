---
name: Tempest/WeatherFlow HA integration outages
description: Why Tempest weather stations go "unavailable" in Home Assistant and how to diagnose across the owner's 3 properties
---

The owner (Maui/Makena, Mercer Island (MI), Sun Valley) runs Home Assistant at three
properties, each with a Tempest weather station (Maui station = "Makena 4",
native dew point entity `sensor.makena_4_dew_point`, reports °F).

**Rule:** if Tempest goes "unavailable" in HA at **all three sites at once**
while the Tempest mobile app still works, the cause is **HA-side** (a
library/version bug or a shared cloud token) — it is *never* a local network /
UDP / UniFi / container issue. The phone app uses WeatherFlow's cloud, so it
keeps working regardless. Different networks failing in lockstep can only share
the HA code path or the cloud credential.

**Why:** local causes (UDP 50222 broadcast, UniFi broadcast filtering, subnet,
Docker bridge) are per-site and cannot fail simultaneously across independent
networks. The add-on (Wall Kiosk) being containerized is a red herring —
WeatherFlow runs in HA Core, which has host networking on Supervisor installs
(the existence of any add-on proves Supervisor, i.e. HA OS/Supervised, not bare
HA Container).

**Known active bugs (as of mid-2026):**
- Local "WeatherFlow" UDP integration crashes in HA 2026.3.x at
  `pyweatherflowudp/calc.py -> psychrolib.GetTDewPointFromRelHum()` (HA issue
  #165867). Works after restart, then dies again — recurring.
- "WeatherFlow Cloud" integration: `weatherflow4py` parse failures
  ("Unable to convert data" / `feels_like`) — HA issue #170243.

**How to apply:**
- Triage: HA logs search `weatherflow`; `psychrolib` => local crash, `weatherflow4py.rest` => cloud parser.
- Confirm cloud/token fine: `https://swd.weatherflow.com/swd/rest/stations?token=...` returns JSON.
- Quick fix: restart HA Core / reload integration (temporary — recurs).
- Durable fix: HACS `briis/weatherflow_forecast` integration (needs Station ID + Personal Access Token from tempestwx.com -> Settings -> Data Authorizations).
- Any HVAC automation depending on outdoor dew point must fail safe when the
  Tempest is unavailable (the Maui dew-point automation defaults to the warmest,
  most condensation-protective setpoints).
