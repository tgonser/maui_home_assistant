import type { HAState } from "./ha";

// Spotify (HA's Spotify integration, T2's account) → Bluesound rooms.
// Spotify can only start music on a speaker it currently sees as a Spotify
// Connect device; Bluesound grouping then carries it to the other rooms.

export type Playlist = { title: string; uri: string };
export const PLAYLIST_CACHE_KEY = "wall:spotify-playlists";

export function spotifyEntity(states: Map<string, HAState>): HAState | undefined {
  return [...states.values()].find((s) => s.entity_id.startsWith("media_player.spotify_"));
}

/** Pick the speaker to start on and which picked rooms then join it.
 *  Prefers a picked room Spotify can see; otherwise any visible speaker
 *  (which then also plays, as the group leader). */
export function planSpotify(
  states: Map<string, HAState>,
  spotifySources: string[],
  picked: string[],
): { device: string; leader: string; joiners: string[]; extraRoom: boolean } | null {
  const byName = new Map<string, string>();
  for (const s of states.values()) {
    if (!s.entity_id.startsWith("media_player.") || s.entity_id.startsWith("media_player.spotify_")) continue;
    byName.set(String(s.attributes.friendly_name ?? "").toLowerCase(), s.entity_id);
  }
  const visible = spotifySources
    .map((name) => ({ name, id: byName.get(name.toLowerCase()) }))
    .filter((d): d is { name: string; id: string } => !!d.id);
  const inPicked = visible.find((d) => picked.includes(d.id));
  const pick = inPicked ?? visible[0];
  if (!pick) return null;
  return { device: pick.name, leader: pick.id, joiners: picked.filter((id) => id !== pick.id), extraRoom: !inPicked };
}

/** Browse result → playlists (title + spotify: URI). */
export function parsePlaylists(result: unknown): Playlist[] {
  const kids = (result as { children?: Array<{ title?: string; media_content_id?: string }> } | null)?.children ?? [];
  return kids
    .filter((k) => typeof k.media_content_id === "string" && k.media_content_id.startsWith("spotify:"))
    .map((k) => ({ title: String(k.title ?? "").trim() || "Playlist", uri: k.media_content_id! }));
}

/** Only playlists named for the house show on the wall: titles starting
 *  "Maui", "Makena" or "Mākena" (any case). If none are named that way yet,
 *  nothing is filtered, so the wall is never empty by surprise. */
export function wallPlaylists(all: Playlist[]): { shown: Playlist[]; filtered: boolean } {
  const house = all.filter((p) => /^(maui|makena|mākena)/i.test(p.title.trim()));
  return house.length ? { shown: house, filtered: true } : { shown: all, filtered: false };
}
