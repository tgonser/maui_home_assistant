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

The Bluesound HA integration returns 500 ("Server got itself in trouble") when:

- `unjoin` is called with no `entity_id` target (HA can't dispatch a media_player service without a target).
- `unjoin` is called against a player that is not actually in a group right now (stale UI state vs. live HA state).
- `unjoin` is called against a **slave** entity. The BluOS API only exposes group dissolution from the master side, so per-slave removal isn't actually wired up in the HA integration — it just blows up.

**Why:** Bluesound's underlying BluOS API has no "remove this one player from the group" primitive. You can only dissolve the whole group from the master.

**How to apply:**

- Always pass `entity_id` in the service data.
- To "remove a single slave" from a group, dissolve the group on the master (`unjoin` on coordinator), wait ~600ms, then `join` the master with the remaining members (excluding the removed slave). Brief audio dropout is unavoidable.
- Re-check live `group_members` at click time before firing — optimistic UI flags drift seconds behind reality during grouping operations.

# Bluesound has no power off

Bluesound players are always on — the HA integration does not advertise `SUPPORT_TURN_OFF` / `SUPPORT_TURN_ON` in `supported_features`, and calling `media_player.turn_off` against one returns 500. The equivalent user-facing action is `media_player.media_stop` (advertised via `SUPPORT_STOP` = 4096).

**How to apply:** Any media_player power button must inspect `attributes.supported_features` (bitmask). Use TURN_OFF (256) / TURN_ON (128) when present, otherwise fall back to STOP (4096), otherwise hide the button. Never assume turn_off works on a media_player.

# Transport calls must target the coordinator, not the slave

Bluesound 500s when `media_play` / `media_pause` / `media_next_track` / `media_previous_track` are called on a group slave. Only the coordinator owns the playback queue.

**How to apply:** A drawer / per-zone control that knows both `entity` (the opened player) and `controller` (the resolved coordinator via `masterOf`) must explicitly pass `entity_id: controller.entity_id` for all transport calls. Volume, mute, and source selection still go to the per-zone `entity`.

# Detecting active playback when Bluesound exposes no metadata

When Bluesound plays via Spotify Connect (and likely AirPlay/TuneIn), the HA integration leaves `state: "idle"` AND publishes empty `media_title`, `media_artist`, `source`, and `app_name`. The only fields populated by audio actually flowing are:
- `media_content_type: "music"` (or similar — set whenever content is loaded)
- `media_position_updated_at: <ISO timestamp>` (bumped each HA poll, ~every 5s, while audio progresses)

**How to apply:** Treat (`media_content_type` non-empty) AND (`media_position_updated_at` within the last ~45s of now) as a signal of live playback. This is needed by both `isMediaActive` and the friendly state label, otherwise the tile reads "Idle" while music plays. Label can fall back to a generic "Streaming" / "Streaming · Group" since the specific source is unknown.

# `master` attribute is boolean on the coordinator, string on slaves

Bluesound publishes `master: true` (boolean) on the coordinator of a group, and `master: "<coordinator entity_id>"` (string) on each slave.

**How to apply:** `masterOf` must type-check the attribute — only a string value means "I am a slave of X". A boolean `true` means "I am the master" and should NOT be returned as a slave pointer.

# `source` is not echoed back after `select_source` for streaming inputs

After `media_player.select_source` succeeds (e.g. user picks "Spotify" from `source_list`), Bluesound's HA integration does NOT update the `source` attribute back. The dropdown will snap back to its placeholder on the next poll.

**How to apply:** Drawer / source picker must keep an optimistic local copy of the user's selection (cleared when switching entities) and use it as the dropdown value whenever HA's `source` attribute is empty.

# Stale `master` and `group_members` after dissolve

After `media_player.unjoin` on a Bluesound coordinator, both sides of the group can stay stale for many seconds (sometimes minutes):
- The former slave keeps its `master` attribute pointing at the old coordinator.
- The former master keeps the slave inside its `group_members` array.

This means neither side alone is trustworthy as evidence of an active group.

**How to apply:**
- `masterOf(slave)` must require a bidirectional link: the named master must exist in states AND list this slave in its `group_members`. Otherwise treat the slave as standalone.
- Do NOT treat `group_members.length > 1` alone as "actively playing". Require an actual audio signal (HA state in playing/paused/buffering, OR non-empty `media_title`, OR `source` other than "idle"). A ghost-grouped pair with no metadata is silent.
- Tile "active" highlighting and the friendly state label must use the same predicate, or you get yellow-highlighted tiles labeled "Idle".

# Which player becomes the master

When you call `media_player.join` with `entity_id: X, group_members: [Y]`, **X becomes the master**, not Y. That means the player you "started playback from" in a UI is not necessarily the one HA will report metadata for — it depends on which entity_id was the join target.

**How to apply:** If a kiosk wants "the room I tapped" to remain the conceptual primary, the `join` call must use that room's entity_id as the target, even if it was previously a slave.
