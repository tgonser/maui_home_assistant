import type { HAState } from "./ha";

// Bluesound players at Mākena, by area, and how they are grouped right now.
// HA's group_members lists the leader first; an ungrouped player has none.

export const MUSIC_SECTIONS: Array<{ title: string; players: Array<[string, string]> }> = [
  { title: "Main house", players: [["media_player.great_room", "Great Room"], ["media_player.great_room_tv_bsr", "Bar"]] },
  { title: "Master suite", players: [["media_player.master_bed", "Master bed"], ["media_player.master_sitting_room", "Sitting room"], ["media_player.master_bath", "Master bath"]] },
  { title: "Guest suites", players: [["media_player.molokini_guest_bed", "Molokini"], ["media_player.beach_guest_bed", "Beach"]] },
  { title: "Outside", players: [
    ["media_player.great_room_lanai", "Great Room lanai"], ["media_player.bbq_lanai", "BBQ lanai"],
    ["media_player.master_lanai", "Master lanai"], ["media_player.master_bath_lanai", "Master bath lanai"],
    ["media_player.back_yard", "Back yard"], ["media_player.front_yard", "Front yard"],
  ] },
];

export const PLAYER_NAMES = new Map(MUSIC_SECTIONS.flatMap((s) => s.players));
export const PLAYER_IDS = [...PLAYER_NAMES.keys()];

export type MusicGroup = { leader: string; members: string[] };

/** Current groups (leader first). Ungrouped players are groups of one. */
export function musicGroups(states: Map<string, HAState>): MusicGroup[] {
  const seen = new Set<string>();
  const out: MusicGroup[] = [];
  for (const id of PLAYER_IDS) {
    if (seen.has(id) || !states.has(id)) continue;
    const gm = states.get(id)?.attributes.group_members;
    const members = Array.isArray(gm) && gm.length > 1 ? (gm as string[]).filter((m) => PLAYER_NAMES.has(m)) : [id];
    if (!members.includes(id)) members.push(id);
    members.forEach((m) => seen.add(m));
    out.push({ leader: members[0], members });
  }
  return out;
}

export function groupFor(groups: MusicGroup[], id: string): MusicGroup | undefined {
  return groups.find((g) => g.members.includes(id));
}

/** Which player should lead a set of picked rooms: one that is already
 *  playing (its music spreads to the others), else the first picked. */
export function pickLeader(states: Map<string, HAState>, picked: string[]): string | undefined {
  return picked.find((id) => states.get(id)?.state === "playing") ?? picked[0];
}

export function describeNowPlaying(st: HAState | undefined): { title: string; sub: string } {
  if (!st || st.state === "unavailable") return { title: "Unavailable", sub: "" };
  const a = st.attributes;
  const title = String(a.media_title ?? "");
  const artist = a.media_artist ? String(a.media_artist) : "";
  const source = a.source ? String(a.source) : "";
  if (st.state === "playing" || st.state === "paused") {
    if (/playing elsewhere/i.test(title)) return { title: artist || "Spotify", sub: `${source || "Spotify"} · controlled from a phone` };
    return { title: title || source || "Playing", sub: [artist, source].filter(Boolean).join(" · ") + (st.state === "paused" ? " · paused" : "") };
  }
  return { title: "Nothing playing", sub: source ? `Last source: ${source}` : "" };
}

/** A grouped follower reports "idle" even while it plays the leader's music.
 *  Return the state that describes what the room is actually doing. */
export function effectivePlayer(states: Map<string, HAState>, id: string): { st: HAState | undefined; leader: string; followsName: string | null } {
  const own = states.get(id);
  const gm = own?.attributes.group_members;
  if (Array.isArray(gm) && gm.length > 1 && gm[0] !== id && states.has(gm[0])) {
    const leader = gm[0] as string;
    return { st: states.get(leader), leader, followsName: PLAYER_NAMES.get(leader) ?? null };
  }
  return { st: own, leader: id, followsName: null };
}
