import type { HAState } from "./ha";
import { lightGroup } from "./houseMap.ts";

// One entry per room you can "pick and control": which light groups, which
// thermostat, shades and speaker belong to it, and whether guests may pick it.

export type RoomDef = {
  id: string;
  name: string;
  area: "Ground floor" | "Upstairs" | "Outside";
  lights: string[];          // light groups from houseMap.lightGroup
  climate?: string;
  shades?: string[];
  media?: string;
  guest: boolean;            // false = owners only (master suite)
};

export const ROOMS: RoomDef[] = [
  { id: "great", name: "Great Room", area: "Ground floor", lights: ["great"], climate: "climate.atrium", media: "media_player.great_room", guest: true },
  { id: "kitchen", name: "Kitchen", area: "Ground floor", lights: ["kitchen", "pantry"], climate: "climate.kitchen", guest: true },
  { id: "bar", name: "Bar", area: "Ground floor", lights: ["bar", "mud"], climate: "climate.bar", shades: ["cover.floor_1_bar_shade_group_1"], media: "media_player.great_room_tv_bsr", guest: true },
  { id: "entry", name: "Entry & stairs", area: "Ground floor", lights: ["entry", "stair"], guest: true },
  { id: "beach", name: "Beach suite", area: "Ground floor", lights: ["beach", "bath2"], climate: "climate.beach_room",
    shades: ["cover.floor_1_bedroom_2_suite_bed_2_shade_group_1", "cover.floor_1_bedroom_2_suite_bed_2_bath_shade_group_1"], media: "media_player.beach_guest_bed", guest: true },
  { id: "boardroom", name: "Boardroom suite", area: "Ground floor", lights: ["boardroom", "bath3"], climate: "climate.boardroom", guest: true },
  { id: "molokini", name: "Molokini suite", area: "Upstairs", lights: ["molokini", "bath4"], climate: "climate.maui_bar",
    shades: ["cover.floor_2_bedroom_4_suite_bed_4_shade_group_1", "cover.floor_2_bedroom_4_suite_bed_4_bath_shade_group_1"], media: "media_player.molokini_guest_bed", guest: true },
  { id: "mauka", name: "Mauka suite", area: "Upstairs", lights: ["mauka", "bath5"], climate: "climate.upper_mauka",
    shades: ["cover.floor_2_bedroom_5_suite_bed_5_shade_group_1", "cover.floor_2_bedroom_5_suite_bed_5_shade_group_2"], guest: true },
  { id: "master", name: "Master suite", area: "Upstairs", lights: ["master", "mbath", "mwic"], climate: "climate.master_bed_2",
    shades: ["cover.floor_2_master_suite_master_bed_shade_group_1", "cover.floor_2_master_suite_master_bath_shade_group_1",
      "cover.floor_2_master_suite_master_bath_floor_2_master_suite_master_bath_shade_group_2", "cover.floor_2_master_suite_closets_floor_2_master_suite_closets_shade_group_1"],
    media: "media_player.master_bed", guest: false },
  { id: "sitting", name: "Master sitting", area: "Upstairs", lights: ["sitting"], climate: "climate.sitting", media: "media_player.master_sitting_room", guest: false },
  { id: "ext_lanai", name: "Great Room lanai", area: "Outside", lights: ["ext_lanai"], media: "media_player.great_room_lanai", guest: true },
  { id: "ext_bbq", name: "BBQ", area: "Outside", lights: ["ext_bbq"], media: "media_player.bbq_lanai", guest: true },
  { id: "ext_master", name: "Master lanais", area: "Outside", lights: ["ext_master"], media: "media_player.master_lanai", guest: false },
];

export const GUEST_SUITE_IDS = ["beach", "boardroom", "molokini", "mauka"];
/** Guest thermostat range (owners get the full range). */
export const GUEST_TEMP = { min: 72, max: 80 };

export function roomsFor(role: TabletRole): RoomDef[] {
  return role.kind === "owner" ? ROOMS : ROOMS.filter((r) => r.guest);
}

/** Every light entity in a room, sorted by name. */
export function roomLights(states: Map<string, HAState>, room: RoomDef): HAState[] {
  const groups = new Set(room.lights);
  return [...states.values()]
    .filter((s) => { const g = lightGroup(s.entity_id); return g != null && groups.has(g) && s.state !== "unavailable"; })
    .sort((a, b) => lightName(a).localeCompare(lightName(b)));
}

/** "Floor 2 Bedroom 4 Suite Bed 4 Bath Toe Kicks" → "Bath toe kicks". */
export function lightName(s: HAState): string {
  const raw = String(s.attributes.friendly_name ?? s.entity_id);
  const out = raw
    .replace(/^Floor \d\s+/i, "")
    .replace(/^(Bedroom \d Suite|Master Suite|Great Room|Exterior|Equipment\/Utility)\s+/i, "")
    .replace(/^Bed \d\s+/i, "")
    .trim() || raw;
  return out.charAt(0).toUpperCase() + out.slice(1).toLowerCase();
}

// ── Tablet role ──────────────────────────────────────────────────────────────

export type TabletRole = { kind: "owner" } | { kind: "guest"; room: string };
export const ROLE_KEY = "wall:role";

export function parseRole(raw: string | null): TabletRole {
  try {
    const v = JSON.parse(raw ?? "null") as TabletRole | null;
    if (v && v.kind === "guest" && GUEST_SUITE_IDS.includes(v.room)) return v;
  } catch { /* fall through */ }
  return { kind: "owner" };
}
