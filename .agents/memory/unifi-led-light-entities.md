---
name: UniFi gear LEDs exposed as light.* entities
description: Network hardware status LEDs show up as lights in HA; name-pattern filters must match model names, not just brand words.
---

UniFi/Ubiquiti network hardware (access points, PoE switches, gateways) exposes its status LED as a `light.*` entity in Home Assistant. Friendly names use **model names** — e.g. "Garage UAP-AC-Lite LED", "USW-Lite-8-PoE LED", "UDM" — with no "unifi" or "ubiquiti" word in them.

**Why:** A brand-word filter (`unifi`, `ubiquiti`, `camera`) missed these, so the kiosk's "All off" count included AP/switch LEDs the user never sees as lights.

**How to apply:** Any "is this a real room light?" heuristic must also match model prefixes as whole words: `uap`, `usw`, `udm`, `udr`, `uxg`, `poe`, `u6`, `u7`, `g4`, `g5`. Hyphens count as word boundaries, so `\buap\b` matches "uap-ac-lite".
