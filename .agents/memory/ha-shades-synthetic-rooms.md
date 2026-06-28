---
name: HA Shades tab synthetic rooms & unified rename
description: Why the Shades tab groups covers by regex, and how room renaming must key off HA area_id to stay unified with the rest of the app
---

# Shades tab synthetic rooms

The Shades/covers tab does NOT group by HA area. It buckets cover entities with
hardcoded regex patterns over `entity_id` (snake_case), producing short synthetic
labels ("Bed 5", "Bed 4", "Bed 4 Bath", "Master Bed", etc.) and a hardcoded
floor layout. So these "rooms" have no `area_id` of their own.

## Renaming must unify, not fork
**Rule:** App-wide room rename is keyed by HA `area_id` (room-alias store +
`displayNameWithRoom`, which prefix-replaces a tile's friendly name when it starts
with the area name). To make a Shades-room rename behave like every other room
rename, resolve each synthetic bucket to the **dominant `area_id` among its
entities** (via `registry.entityArea`) and key the alias off that area_id. Use a
deterministic tie-break (lexicographic area_id) so the key can't flap. Fall back to
a synthetic `shade:<label>` key only when no entity in the bucket has an area.

**Why:** A first attempt keyed Shades renames under a standalone `shade:<label>`
key. It worked in isolation but the user expected one rename ("Bed 5" → "UpMauka
Room") to show up everywhere; the separate key made it a second, disconnected
naming system. Keying off the shared `area_id` makes the Rooms tab, device tiles,
and Shades headers all reflect a single rename across every kiosk.

**Side effect to accept:** if two buckets (e.g. "Bed 4" and "Bed 4 Bath") resolve
to the same HA area, they share one alias and rename together. That is correct
under area-based unification.

## Tile labels need the resolved name injected
`CoverTile` shows `__alias__ ?? __shade_room__ ?? friendly`. The `__shade_room__`
attribute (injected by ShadesView per bucket) OVERRIDES the area-alias propagation
that `displayNameWithRoom` would normally apply. So inject the **resolved** display
name (alias ?? label) as `__shade_room__`, or shade tiles will keep showing the raw
synthetic label even after the area is renamed.

## Deploy caveat
The kiosk runs as a deployed HA add-on built from GitHub CI. A fix committed in
Replit is NOT live until the add-on version is bumped, pushed, rebuilt, and
reinstalled. "Renaming does nothing" reports are often just the old version still
running.
