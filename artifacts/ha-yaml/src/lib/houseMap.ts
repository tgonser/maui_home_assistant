import type { HAState } from "./ha";

// The Mākena house map: room outlines traced from T2's floor plans (drawing
// pixel coordinates, ocean on the left), plus which Home Assistant entities
// belong to each room. Pure data + pure functions so it can be unit-tested.

export type RoomKind = "room" | "util" | "void" | "elev";
export type MapRoom = {
  id: string;
  name: string;
  x0: number; y0: number; x1: number; y1: number;
  kind: RoomKind;
  /** Rooms that light up together share a group (the stair L). */
  group?: string;
};
export type MapOutdoor = { name: string; x0: number; y0: number; x1: number; y1: number };
export type MapDoor = {
  /** Alarm/USL contact sensor; absent = drawn only, no sensor yet. */
  sensor?: string;
  x0: number; y0: number; x1: number; y1: number;
  /** Thermostats paused while this door is open (for the label). */
  pauses?: string[];
};
export type MapFloor = {
  id: "ground" | "up";
  title: string;
  ox: number; oy: number; w: number; h: number;
  rooms: MapRoom[];
  outdoor: MapOutdoor[];
  doors: MapDoor[];
};

const v = (x: number, y0: number, y1: number, sensor?: string, pauses?: string[]): MapDoor =>
  ({ x0: x - 8, x1: x + 8, y0, y1, sensor, pauses });
const hz = (y: number, x0: number, x1: number, sensor?: string, pauses?: string[]): MapDoor =>
  ({ x0, x1, y0: y - 8, y1: y + 8, sensor, pauses });

const GREAT_PAUSE = ["climate.kitchen", "climate.atrium"];

export const FLOORS: MapFloor[] = [
  {
    id: "ground", title: "Ground floor", ox: 470, oy: 240, w: 990, h: 1305,
    rooms: [
      { id: "mud", name: "Mud", x0: 1075, y0: 260, x1: 1430, y1: 345, kind: "util" },
      { id: "bar", name: "Bar", x0: 1075, y0: 345, x1: 1430, y1: 570, kind: "room" },
      { id: "kitchen", name: "Kitchen", x0: 700, y0: 540, x1: 1095, y1: 760, kind: "room" },
      { id: "great", name: "Great Room", x0: 700, y0: 760, x1: 1095, y1: 1100, kind: "room" },
      { id: "pantry", name: "Pantry", x0: 1095, y0: 570, x1: 1290, y1: 710, kind: "util" },
      { id: "utility", name: "AV", x0: 1290, y0: 570, x1: 1445, y1: 710, kind: "util" },
      { id: "entry", name: "Entry", x0: 1095, y0: 710, x1: 1200, y1: 1100, kind: "room" },
      { id: "stair1", name: "Stair", x0: 1200, y0: 710, x1: 1445, y1: 860, kind: "room", group: "stair" },
      { id: "beach", name: "Beach", x0: 700, y0: 1100, x1: 1010, y1: 1300, kind: "room" },
      { id: "hall1", name: "", x0: 1010, y0: 1100, x1: 1180, y1: 1300, kind: "util" },
      { id: "elev1", name: "⇅", x0: 1100, y0: 1150, x1: 1175, y1: 1250, kind: "elev" },
      { id: "boardroom", name: "Boardroom", x0: 1180, y0: 1100, x1: 1450, y1: 1300, kind: "room" },
      { id: "bath2", name: "Bath 2", x0: 830, y0: 1300, x1: 1140, y1: 1420, kind: "util" },
      { id: "bath3", name: "Bath 3", x0: 1140, y0: 1300, x1: 1250, y1: 1420, kind: "util" },
    ],
    outdoor: [
      { name: "Pool lanai", x0: 480, y0: 540, x1: 690, y1: 1100 },
      { name: "BBQ", x0: 700, y0: 250, x1: 1065, y1: 535 },
      { name: "Entry lanai", x0: 1210, y0: 870, x1: 1455, y1: 1092 },
      { name: "Shower", x0: 748, y0: 1305, x1: 826, y1: 1531 },
      { name: "Shower", x0: 1163, y0: 1424, x1: 1247, y1: 1541 },
    ],
    doors: [
      hz(540, 760, 1040, "binary_sensor.makena_alarm_zone_17", GREAT_PAUSE),
      v(700, 560, 1090, "binary_sensor.makena_alarm_zone_18", GREAT_PAUSE),
      v(1075, 360, 540, "binary_sensor.makena_alarm_zone_6", ["climate.bar"]),
      v(1430, 265, 340, "binary_sensor.makena_alarm_zone_11"),
      v(1200, 905, 1000, "binary_sensor.makena_alarm_zone_7"),
      v(700, 1130, 1290, undefined, ["climate.beach_room"]),
      v(1450, 1130, 1290, undefined, ["climate.boardroom"]),
      v(830, 1330, 1415),
      hz(1420, 1165, 1245),
    ],
  },
  {
    id: "up", title: "Upstairs", ox: 430, oy: 255, w: 910, h: 1165,
    rooms: [
      { id: "mbath", name: "Master bath", x0: 965, y0: 255, x1: 1240, y1: 410, kind: "util" },
      { id: "mwic", name: "Closets", x0: 965, y0: 410, x1: 1250, y1: 545, kind: "util" },
      { id: "master", name: "Master", x0: 595, y0: 545, x1: 935, y1: 790, kind: "room" },
      { id: "sitting", name: "Sitting", x0: 935, y0: 545, x1: 1230, y1: 790, kind: "room" },
      { id: "stair2a", name: "", x0: 1235, y0: 690, x1: 1335, y1: 790, kind: "room", group: "stair" },
      { id: "stair2b", name: "Stair", x0: 1095, y0: 790, x1: 1335, y1: 860, kind: "room", group: "stair" },
      { id: "void", name: "Open to Great Room", x0: 595, y0: 790, x1: 995, y1: 1105, kind: "void" },
      { id: "walkway", name: "Walkway", x0: 995, y0: 790, x1: 1095, y1: 1105, kind: "room", group: "stair" },
      { id: "molokini", name: "Molokini", x0: 595, y0: 1105, x1: 860, y1: 1330, kind: "room" },
      { id: "wic4", name: "", x0: 860, y0: 1105, x1: 990, y1: 1270, kind: "util" },
      { id: "hall2", name: "", x0: 990, y0: 1105, x1: 1135, y1: 1250, kind: "util" },
      { id: "elev2", name: "⇅", x0: 1000, y0: 1120, x1: 1078, y1: 1240, kind: "elev" },
      { id: "mauka", name: "Mauka", x0: 1135, y0: 1105, x1: 1330, y1: 1330, kind: "room" },
      { id: "bath4", name: "Bath 4", x0: 860, y0: 1270, x1: 1045, y1: 1420, kind: "util" },
      { id: "bath5", name: "Bath 5", x0: 1045, y0: 1250, x1: 1135, y1: 1420, kind: "util" },
    ],
    outdoor: [
      { name: "Lanai", x0: 440, y0: 545, x1: 590, y1: 1105 },
      { name: "Master deck", x0: 600, y0: 262, x1: 955, y1: 538 },
      { name: "Lanai", x0: 1255, y0: 420, x1: 1340, y1: 682 },
      { name: "Shower", x0: 1245, y0: 300, x1: 1328, y1: 405 },
      { name: "Shower", x0: 644, y0: 1338, x1: 855, y1: 1412 },
    ],
    doors: [
      hz(545, 640, 930), v(595, 570, 780), v(965, 270, 400), v(1230, 590, 760),
      v(595, 1150, 1290, undefined, ["climate.maui_bar"]),
      v(1335, 1130, 1300, undefined, ["climate.upper_mauka"]),
      v(860, 1340, 1410),
    ],
  },
];

/** Light entity prefixes per room group (after "light."). Bath rules come
 *  before the bedroom rule so suite baths do not light up the bedroom. */
const LIGHT_RULES: Array<[RegExp, string]> = [
  [/^floor_1_bedroom_2_suite_bed_2_bath_/, "bath2"],
  [/^floor_1_bedroom_3_suite_bed_3_bath_/, "bath3"],
  [/^floor_2_bedroom_4_suite_bed_4_bath_/, "bath4"],
  [/^floor_2_bedroom_5_suite_bed_5_bath_/, "bath5"],
  [/^floor_1_bedroom_2_suite_/, "beach"],
  [/^floor_1_bedroom_3_suite_/, "boardroom"],
  [/^floor_2_bedroom_4_suite_/, "molokini"],
  [/^floor_2_bedroom_5_suite_/, "mauka"],
  [/^floor_1_great_room_kitchen_/, "kitchen"],
  [/^floor_1_great_room_atrium_/, "great"],
  [/^floor_1_bar_/, "bar"],
  [/^floor_1_(mudroom|powder_room)_/, "mud"],
  [/^floor_1_pantry_/, "pantry"],
  [/^floor_1_equipment_utility_/, "utility"],
  [/^floor_1_(entry|elevator_hall)_/, "entry"],
  [/^floor_2_(stairs|upstairs_hall)_/, "stair"],
  [/^floor_2_master_suite_master_bath_/, "mbath"],
  [/^floor_2_master_suite_closets_/, "mwic"],
  [/^floor_2_master_suite_sitting_room_/, "sitting"],
  [/^floor_2_master_suite_master_bed_/, "master"],
];

export function lightGroup(entityId: string): string | null {
  if (!entityId.startsWith("light.")) return null;
  const name = entityId.slice(6);
  for (const [re, g] of LIGHT_RULES) if (re.test(name)) return g;
  return null;
}

export const ROOM_CLIMATE: Record<string, string> = {
  kitchen: "climate.kitchen", great: "climate.atrium", bar: "climate.bar",
  beach: "climate.beach_room", boardroom: "climate.boardroom",
  master: "climate.master_bed_2", sitting: "climate.sitting",
  molokini: "climate.maui_bar", mauka: "climate.upper_mauka",
};

export const ROOM_MEDIA: Record<string, string> = {
  great: "media_player.great_room", master: "media_player.master_bed",
  sitting: "media_player.master_sitting_room", mbath: "media_player.master_bath",
  molokini: "media_player.molokini_guest_bed", beach: "media_player.beach_guest_bed",
};

export const ROOM_MOTION: Record<string, string> = {
  sitting: "binary_sensor.usl_motion_sitting",
  stair: "binary_sensor.up_stair_motion_motion",
  bar: "binary_sensor.usl_motion_motion",
};

export const GUEST_SUITES: Array<{ id: string; name: string; bath: string }> = [
  { id: "beach", name: "Beach", bath: "bath2" },
  { id: "boardroom", name: "Boardroom", bath: "bath3" },
  { id: "molokini", name: "Molokini", bath: "bath4" },
  { id: "mauka", name: "Mauka", bath: "bath5" },
];

export const groupOf = (r: MapRoom) => r.group ?? r.id;

export type RoomStatus = {
  lightsOn: number;
  lightIds: string[];
  temp: number | null;
  playing: boolean;
  motion: boolean;
};

const DAY_MS = 24 * 3600_000;

/** Everything the map needs per room group, from one pass over the states. */
export function roomStatus(states: Map<string, HAState>, nowMs: number): Map<string, RoomStatus> {
  const out = new Map<string, RoomStatus>();
  const get = (g: string) => {
    let s = out.get(g);
    if (!s) {
      s = { lightsOn: 0, lightIds: [], temp: null, playing: false, motion: false };
      out.set(g, s);
    }
    return s;
  };
  for (const st of states.values()) {
    const g = lightGroup(st.entity_id);
    if (!g || st.state === "unavailable") continue;
    const s = get(g);
    s.lightIds.push(st.entity_id);
    if (st.state === "on") s.lightsOn += 1;
  }
  for (const [g, id] of Object.entries(ROOM_CLIMATE)) {
    const t = Number(states.get(id)?.attributes?.current_temperature);
    if (Number.isFinite(t)) get(g).temp = Math.round(t);
  }
  for (const [g, id] of Object.entries(ROOM_MEDIA)) {
    if (states.get(id)?.state === "playing") get(g).playing = true;
  }
  for (const [g, id] of Object.entries(ROOM_MOTION)) {
    const m = states.get(id);
    if (!m) continue;
    const recent = nowMs - Date.parse(m.last_changed) < 2 * 60_000;
    if (m.state === "on" || recent) get(g).motion = true;
  }
  return out;
}

/** A guest suite is "in use today" if any of its lights, its bath lights or
 *  its music changed in the last 24 hours. (Bath motion joins this list once
 *  those sensors are installed.) */
export function suiteInUse(states: Map<string, HAState>, suite: { id: string; bath: string }, nowMs: number): boolean {
  for (const st of states.values()) {
    const g = lightGroup(st.entity_id);
    const mine = g === suite.id || g === suite.bath || st.entity_id === ROOM_MEDIA[suite.id];
    if (!mine) continue;
    const t = Date.parse(st.last_changed);
    if (Number.isFinite(t) && nowMs - t < DAY_MS && st.state !== "unavailable") return true;
  }
  return false;
}

/** Fit a one-line label into a box (plan units). Returns font size and
 *  whether to run it vertically. */
export function fitLabel(text: string, w: number, h: number, base: number, pad: number): { fs: number; rot: boolean } {
  if (!text) return { fs: base, rot: false };
  for (let fs = base; fs >= base * 0.65; fs -= 1) {
    const est = text.length * fs * 0.6;
    if (est <= w - pad) return { fs, rot: false };
    if (h > w && est <= h - pad) return { fs, rot: true };
  }
  return { fs: Math.round(base * 0.65), rot: h > w };
}

export type EnergyNow = {
  solarKw: number; houseKw: number; batteryKw: number; gridKw: number;
  soc1: number | null; soc2: number | null;
};

const num = (states: Map<string, HAState>, id: string) => {
  const n = Number(states.get(id)?.state);
  return Number.isFinite(n) ? n : null;
};

/** Teslemetry: battery_power < 0 means charging; grid_power < 0 means selling. */
export function energyNow(states: Map<string, HAState>): EnergyNow {
  const sum = (suffix: string) =>
    (num(states, `sensor.gonser_4680_system_1_${suffix}`) ?? 0) + (num(states, `sensor.4680_system_2_${suffix}`) ?? 0);
  return {
    solarKw: sum("solar_power"),
    houseKw: sum("load_power"),
    batteryKw: sum("battery_power"),
    gridKw: sum("grid_power"),
    soc1: num(states, "sensor.gonser_4680_system_1_percentage_charged"),
    soc2: num(states, "sensor.4680_system_2_percentage_charged"),
  };
}
