---
name: Bluesound / Sonos group slave state in HA
description: How HA reports media_player state for grouped Bluesound/Sonos speakers, and the rules for displaying and controlling slaves correctly.
---

# Group slaves report idle with no metadata

When two or more Bluesound (or Sonos) `media_player` entities are grouped:

- **Only the master** reports `state: "playing"` and carries `media_title`, `media_artist`, `source`, and a populated `group_members` array.
- **Slaves** report `state: "idle"` with empty `media_title` / `media_artist` even though audio is physically playing through them. Their `group_members` is empty.
- Slaves identify their master via an attribute that differs by integration:
  - Bluesound: `attributes.master`
  - Sonos: `attributes.group_leader`

**How to apply:** Any "is this player active?" or "what's playing?" check must walk from slave → master to inherit metadata. Use a shared helper that checks both `master` and `group_leader`. Never trust raw `state === "idle"` alone — also examine source, group_members > 1, title presence, and master attribute.

# Bluesound `media_player.unjoin` 500s

The Bluesound HA integration returns 500 Internal Server Error when:

- `unjoin` is called with no `entity_id` target (HA can't dispatch a media_player service without a target).
- `unjoin` is called against an entity that is not actually in a group right now (stale UI state vs. live HA state).

**Why:** Bluesound's underlying API errors instead of no-oping when asked to leave a non-existent group.

**How to apply:**

- Always pass `entity_id` in the service data (the coordinator's id for a "leave group" button; the slave's id for per-zone toggle).
- Re-check live `group_members` (or a `realJoined`-style helper) at click time before firing the call. Optimistic UI flags can drift several seconds behind reality during grouping operations.

# Which player becomes the master

When you call `media_player.join` with `entity_id: X, group_members: [Y]`, **X becomes the master**, not Y. That means the player you "started playback from" in a UI is not necessarily the one HA will report metadata for — it depends on which entity_id was the join target.

**How to apply:** If a kiosk wants "the room I tapped" to remain the conceptual primary, the `join` call must use that room's entity_id as the target, even if it was previously a slave.
