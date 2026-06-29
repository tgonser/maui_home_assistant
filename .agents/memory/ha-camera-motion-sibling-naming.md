---
name: HA camera motion-sensor → camera name resolution
description: Why the kiosk "Recent Motion" OUTSIDE rows must resolve camera names via alias + primary-stream selection, not raw first-match
---

# Camera motion rows must mirror the camera's displayed name

In the Wall kiosk, OUTSIDE "Recent Motion" rows are camera motion binary_sensors. Their own friendly name is useless, so they resolve to the sibling `camera.*` entity on the same device (`cameraSiblingName`).

Two traps make the resolved name diverge from what the Cameras tab shows:

1. **Aliases.** The Cameras tab renders alias-applied entities, so a camera renamed *on the kiosk* (per-entity alias, not in HA) shows the nice name there. `cameraSiblingName` must apply the same alias-first precedence (`aliases[camera] ?? friendlyName(camera)`), or motion rows show the raw HA name while the Cameras tab shows the alias.

2. **UniFi multi-entity devices.** One UniFi camera device exposes several `camera.*` entities (high-/low-resolution streams, package camera). A naive `states.find(first camera on device)` latches onto "… High resolution channel" with its raw auto-generated name. Skip secondary-stream entities (regex on `high res|low res|resolution|package|sub stream|channel`) and prefer an aliased or primary entity.

**Why:** symptom was OUTSIDE rows showing "South Pool G6 PTZ High resolution…" while the Cameras tab correctly showed "South Pool PTZ". The `motionSensorLabel` fallback strips `G6`, so any displayed name still containing `G6` proves it came from `cameraSiblingName` returning a raw camera name, not the fallback.

**How to apply:** any code resolving a camera-related entity's display name must go through the alias-first path used app-wide (`displayName`/`aliases[id] ?? friendlyName`), and any "find the camera on this device" lookup must de-prioritize secondary UniFi stream entities. The Motion *tab* (Wall.tsx `SensorsView`) intentionally excludes camera motion sensors, so this only affects the SuperView Recent Motion widget.
