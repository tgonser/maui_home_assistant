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

// True if the media_player is currently producing audio (or paused on real
// content), false if powered off / unavailable. Idle-with-source counts as
// active because that's the Bluesound line-in / TV-audio case.
export function isMediaActive(s: HAState): boolean {
  const raw = s.state;
  if (OFF_RAW_STATES.has(raw)) return false;
  if (ACTIVE_RAW_STATES.has(raw)) return true;
  // raw === "idle" (or similar): look for tell-tales of live audio
  const title = s.attributes.media_title as string | undefined;
  const source = s.attributes.source as string | undefined;
  const groupMembers =
    (s.attributes.group_members as string[] | undefined) ?? [];
  if (title && title.trim().length > 0) return true;
  if (source && source.toLowerCase() !== "idle") return true;
  // Group slaves: more than just self in group_members means we're slaved
  // to a playing master.
  if (groupMembers.length > 1) return true;
  return false;
}

// Friendly label for the current media_player state. Capitalises the standard
// HA states and replaces bare "idle" with a more meaningful descriptor based
// on the active source / stream metadata when the player is really active.
export function displayMediaState(s: HAState): string {
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
  if (title && title.trim().length > 0) return "Streaming";
  if (source && groupMembers.length > 1) return `Streaming · ${source}`;
  if (source && source.toLowerCase() !== "idle") return source;
  return cap(raw);
}
