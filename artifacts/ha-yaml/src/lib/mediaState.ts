import type { HAState } from "./ha";

// Bluesound (and some other media players) sit in HA state "idle" even while
// they're actively producing sound — common cases:
//   - Source is a line-in or TV audio passthrough (no media metadata, no
//     stream state, the player just hands audio through to its speakers)
//   - The player is a group slave; the master reports playing, the slave
//     stays "idle" while still outputting the master's audio
// So `state === "playing"` is not a reliable "is this thing on" signal for
// music tiles. These helpers centralize the smarter check used by both the
// Wall tiles and the WallControls drawer.

const ACTIVE_RAW_STATES = new Set(["playing", "paused", "buffering", "on"]);
const OFF_RAW_STATES = new Set([
  "off",
  "standby",
  "unavailable",
  "unknown",
]);

// Bluesound (and Sonos) group slaves: the slave reports `state: idle` and
// empty media metadata while a `master` attribute (or "group_leader" on Sonos)
// points at the coordinator entity_id. Audio is still flowing out of the
// slave's speakers — it just doesn't have its own copy of the now-playing
// info. Returns the entity_id of the master if this player is a slave.
//
// Bluesound's `master` attribute is sticky: after a group is dissolved, the
// former slave can keep the stale pointer for several refresh cycles. When
// `allStates` is provided we require the named master to actually exist AND
// list this player in its `group_members`, otherwise the attribute is stale
// and we treat the player as standalone.
export function masterOf(s: HAState, allStates?: HAState[]): string | null {
  // On Bluesound the coordinator publishes `master: true` (a boolean) while
  // slaves publish `master: "<coordinator entity_id>"` (a string). Only the
  // string form indicates "I am a slave of <id>".
  const raw = s.attributes.master ?? s.attributes.group_leader ?? null;
  if (typeof raw !== "string") return null;
  if (raw.length === 0 || raw === s.entity_id) return null;
  if (!allStates) return raw;
  const master = allStates.find((x) => x.entity_id === raw);
  if (!master) return null;
  const members =
    (master.attributes.group_members as string[] | undefined) ?? [];
  if (!members.includes(s.entity_id)) return null;
  return raw;
}

// Bluesound often plays content (Spotify Connect, AirPlay, etc.) without
// exposing any of the standard media_title / source / app_name fields. The
// only reliable signal that audio is actually flowing is a recently-updated
// `media_position_updated_at` paired with `media_content_type` being set.
// HA polls Bluesound every few seconds, so "within the last 45s" comfortably
// covers any reasonable poll cadence + clock skew.
const POSITION_RECENT_MS = 45_000;
function hasRecentPlayback(s: HAState, now: number = Date.now()): boolean {
  const contentType = s.attributes.media_content_type as string | undefined;
  if (!contentType || contentType.trim().length === 0) return false;
  const ts = s.attributes.media_position_updated_at as string | undefined;
  if (!ts) return false;
  const updated = Date.parse(ts);
  if (!Number.isFinite(updated)) return false;
  return now - updated < POSITION_RECENT_MS;
}

// True if the media_player is currently producing audio (or paused on real
// content), false if powered off / unavailable. Idle-with-source counts as
// active because that's the Bluesound line-in / TV-audio case. Group slaves
// inherit their master's active state when `allStates` is provided.
export function isMediaActive(s: HAState, allStates?: HAState[]): boolean {
  const raw = s.state;
  if (OFF_RAW_STATES.has(raw)) return false;
  if (ACTIVE_RAW_STATES.has(raw)) return true;
  // raw === "idle" (or similar): look for tell-tales of live audio
  const title = s.attributes.media_title as string | undefined;
  const source = s.attributes.source as string | undefined;
  const groupMembers =
    (s.attributes.group_members as string[] | undefined) ?? [];
  const appName = s.attributes.app_name as string | undefined;
  if (title && title.trim().length > 0) return true;
  if (source && source.toLowerCase() !== "idle") return true;
  if (appName && appName.trim().length > 0) return true;
  // Bluesound + Spotify Connect (and similar): no title/source/app_name is
  // ever populated, but `media_content_type` is set and `media_position_
  // updated_at` ticks forward each HA poll. That's our truth signal.
  if (hasRecentPlayback(s)) return true;
  // NOTE: we intentionally do NOT treat `group_members.length > 1` alone as
  // "active". Bluesound leaves stale group_members populated for many
  // seconds (sometimes minutes) after a group is dissolved. Without an
  // actual title/source/playing-state signal there's no audio. The slave-
  // via-master fallback below still catches truly-active groups because the
  // master will have those signals.
  void groupMembers;
  const masterId = masterOf(s, allStates);
  if (masterId && allStates) {
    const master = allStates.find((x) => x.entity_id === masterId);
    if (master && master.entity_id !== s.entity_id)
      return isMediaActive(master, allStates);
  }
  return false;
}

// Friendly label for the current media_player state. Capitalises the standard
// HA states and replaces bare "idle" with a more meaningful descriptor based
// on the active source / stream metadata when the player is really active.
export function displayMediaState(s: HAState, allStates?: HAState[]): string {
  const raw = s.state;
  const cap = (x: string) =>
    x.length === 0 ? x : x[0].toUpperCase() + x.slice(1);
  if (raw === "off") return "Off";
  if (raw === "standby") return "Standby";
  if (raw === "playing") return "Playing";
  if (raw === "paused") return "Paused";
  if (raw === "buffering") return "Buffering";
  if (raw === "unavailable") return "Unavailable";
  if (raw === "unknown") return "Unknown";
  if (raw === "on") return "On";
  // raw === "idle" (typical) or another non-standard state
  const title = s.attributes.media_title as string | undefined;
  const source = s.attributes.source as string | undefined;
  const groupMembers =
    (s.attributes.group_members as string[] | undefined) ?? [];
  const appName = s.attributes.app_name as string | undefined;
  if (title && title.trim().length > 0) return "Streaming";
  if (source && source.toLowerCase() !== "idle") {
    return groupMembers.length > 1 ? `Streaming · ${source}` : source;
  }
  if (appName && appName.trim().length > 0) {
    return groupMembers.length > 1 ? `Streaming · ${appName}` : appName;
  }
  // Bluesound + Spotify Connect: nothing useful in metadata, but the player
  // is actually producing audio. Show "Streaming" so the tile matches the
  // active highlight instead of reading "Idle".
  if (hasRecentPlayback(s)) {
    return groupMembers.length > 1 ? "Streaming · Group" : "Streaming";
  }
  // Group slave: inherit label from the master only when the master->slave
  // link is bidirectional, so stale `master` attrs on standalone players
  // don't get permanently labeled "Grouped".
  const masterId = masterOf(s, allStates);
  if (masterId && allStates) {
    const master = allStates.find((x) => x.entity_id === masterId);
    if (master && master.entity_id !== s.entity_id)
      return displayMediaState(master, allStates);
  }
  return cap(raw);
}

// Returns the now-playing metadata to display on a tile / drawer. For group
// slaves this falls back to the master's metadata so the slave doesn't look
// blank while audio is actively coming out of its speakers.
export function effectiveMedia(
  s: HAState,
  allStates?: HAState[],
): {
  title?: string;
  artist?: string;
  source?: string;
  fromMasterId?: string;
} {
  const title = s.attributes.media_title as string | undefined;
  const artist = s.attributes.media_artist as string | undefined;
  const source = s.attributes.source as string | undefined;
  if (title || artist) return { title, artist, source };
  const masterId = masterOf(s, allStates);
  if (!masterId || !allStates) return { title, artist, source };
  const master = allStates.find((x) => x.entity_id === masterId);
  if (!master) return { title, artist, source };
  return {
    title: master.attributes.media_title as string | undefined,
    artist: master.attributes.media_artist as string | undefined,
    source: (master.attributes.source as string | undefined) ?? source,
    fromMasterId: masterId,
  };
}
