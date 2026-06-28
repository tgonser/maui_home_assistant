---
name: HA switch.* lighting loads in room derivation
description: Why some "lights" never appear as rooms in the kiosk, and how room derivation must treat switch-domain lighting loads
---

Lutron Caséta loads whose device type is left as "None" (both "Switched"/non-dimming
and even "Dimmed" circuits) are exposed by Home Assistant as `switch.*` entities, NOT
`light.*`. The kiosk's room derivation originally counted only `light.*` entities, so an
HA area containing only these loads resolved to `totalLights = 0` and was hidden entirely
(e.g. "Floor 1 Exterior" color niches, "Floor 2 Exterior" Lanai sconces).

**Rule:** room derivation must treat a `switch.*` entity as a room light when its friendly
name matches lighting-fixture keywords (light, lamp, sconce, niche, chandelier, pendant,
downlight, spotlight, cove, lantern, vanity), excluding network/camera status LEDs.

**Why:** there is no reliable domain/attribute signal that a `switch.*` controls a light —
HA carries no integration metadata in the registry beyond area. Name-keyword matching is
the established heuristic in this codebase (mirrors NON_SWITCH_PATTERNS / CAMERA_LIGHT_PATTERNS).

**How to apply:**
- Switch-domain lights are on/off only (no `brightness` attribute) → model as pct 100 when on.
- Control service calls MUST be routed by the entity's own domain: `light.turn_on` on a
  `switch.*` silently no-ops (HA returns 200, nothing happens). Split room ids into
  light vs switch and call `light.*` / `switch.*` services separately.
- UI: hide per-light and room master dimmer sliders when a light/room has no dimmable
  (`light.*`) members; show On/Off instead.
- Diagnosing "an area exists in HA but not in the kiosk": first check the entity DOMAIN
  (Settings → Entities → the entity) — `switch.*` vs `light.*` is the usual cause, not area
  assignment. The kiosk never invents room names; a shown room name is always a real HA area.
