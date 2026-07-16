import { create } from "zustand";
import { haCallService, haWsBatch, type HAState } from "./ha";

export type AreaEntry = {
  area_id: string;
  name: string;
  floor_id?: string | null;
  icon?: string | null;
};

export type EntityEntry = {
  entity_id: string;
  area_id: string | null;
  device_id: string | null;
  name: string | null;
  original_name: string | null;
  hidden_by: string | null;
  disabled_by: string | null;
};

export type DeviceEntry = {
  id: string;
  area_id: string | null;
};

export type Registry = {
  areas: AreaEntry[];
  entities: EntityEntry[];
  devices: DeviceEntry[];
  /** entity_id -> resolved area_id (entity area falls back to its device area) */
  entityArea: Map<string, string>;
  /** entity_id -> device_id (for linking sibling entities on the same device) */
  entityDevice: Map<string, string>;
  loadedAt: number | null;
};

type RegistryStore = Registry & {
  loading: boolean;
  error: string | null;
  load: (force?: boolean) => Promise<void>;
};

const empty: Registry = {
  areas: [],
  entities: [],
  devices: [],
  entityArea: new Map(),
  entityDevice: new Map(),
  loadedAt: null,
};

export const useRegistry = create<RegistryStore>((set, get) => ({
  ...empty,
  loading: false,
  error: null,
  load: async (force = false) => {
    const { loadedAt, loading } = get();
    if (loading) return;
    // Cache for 60s unless forced
    if (!force && loadedAt && Date.now() - loadedAt < 60_000) return;

    set({ loading: true, error: null });
    const ws = await haWsBatch([
      { type: "config/area_registry/list" },
      { type: "config/device_registry/list" },
      { type: "config/entity_registry/list" },
    ]);
    if (!ws.ok) {
      set({ loading: false, error: ws.error ?? "Registry fetch failed" });
      return;
    }
    const [areasR, devicesR, entitiesR] = ws.results;
    const areas = (areasR?.result as AreaEntry[]) ?? [];
    const devices = (devicesR?.result as DeviceEntry[]) ?? [];
    const entities = (entitiesR?.result as EntityEntry[]) ?? [];

    const deviceArea = new Map<string, string>();
    for (const d of devices) {
      if (d.area_id) deviceArea.set(d.id, d.area_id);
    }
    const entityArea = new Map<string, string>();
    const entityDevice = new Map<string, string>();
    for (const e of entities) {
      const a = e.area_id ?? (e.device_id ? deviceArea.get(e.device_id) : null);
      if (a) entityArea.set(e.entity_id, a);
      if (e.device_id) entityDevice.set(e.entity_id, e.device_id);
    }
    set({
      areas,
      devices,
      entities,
      entityArea,
      entityDevice,
      loadedAt: Date.now(),
      loading: false,
      error: null,
    });
  },
}));

// ---------- Room derivation ----------

/** A light counts as "on enough" only when its brightness is at or above this. */
export const ROOM_ON_THRESHOLD_PCT = 35;

export type RoomLight = {
  state: HAState;
  on: boolean;
  /** brightness 0-100; 0 if off or unknown */
  pct: number;
  /** does this light count toward "room on" */
  contributes: boolean;
  /**
   * "light" entities are dimmable; "switch" lighting loads (e.g. Lutron Caséta
   * switched/non-dimming circuits, or device-type "None") are on/off only.
   */
  domain: "light" | "switch";
};

export type Room = {
  id: string;
  name: string;
  floor_id: string | null;
  lights: RoomLight[];
  /** all entities in the area, including non-light */
  allEntities: HAState[];
  /** count of lights that satisfy the "on" rule */
  onCount: number;
  /** count of light entities total (excluding unavailable) */
  totalLights: number;
  /** room is on if any light's brightness ≥ threshold */
  on: boolean;
  /** average brightness across lights that are physically on */
  avgPctOfOn: number;
};

const friendly = (s: HAState) =>
  (s.attributes.friendly_name as string | undefined) ?? s.entity_id;
const domainOf = (id: string) => id.split(".")[0] ?? "";

// Some lighting loads are exposed by HA as switch.* entities rather than
// light.* — e.g. Lutron Caséta "switched" (non-dimming) circuits, or dimmers
// whose device type is left as "None". They control real lights, so a room
// should count them. We detect them by lighting-fixture keywords in the name.
const LIGHT_SWITCH_PATTERNS: RegExp[] = [
  /\blight(s)?\b/,
  /\blamp(s)?\b/,
  /\bsconce(s)?\b/,
  /\bniche\b/,
  /\bchandelier\b/,
  /\bpendant(s)?\b/,
  /\bdownlight(s)?\b/,
  /\bspot ?light(s)?\b/,
  /\bcove\b/,
  /\blantern(s)?\b/,
  /\bvanity\b/,
];
// Guard against network/camera status LEDs that contain "light"/"led".
const LIGHT_SWITCH_EXCLUDE: RegExp[] = [
  /_led$/i,
  /status[\s_-]*(led|light)/,
];
export const isLightingSwitch = (s: HAState) => {
  if (domainOf(s.entity_id) !== "switch") return false;
  const id = s.entity_id.toLowerCase();
  const name = (
    (s.attributes.friendly_name as string | undefined) ?? id
  ).toLowerCase();
  const idWords = id.replace(/[._-]/g, " ");
  if (LIGHT_SWITCH_EXCLUDE.some((re) => re.test(name) || re.test(id)))
    return false;
  return LIGHT_SWITCH_PATTERNS.some((re) => re.test(name) || re.test(idWords));
};

export function deriveRooms(states: HAState[], registry: Registry): Room[] {
  const byArea = new Map<string, HAState[]>();
  for (const s of states) {
    const a = registry.entityArea.get(s.entity_id);
    if (!a) continue;
    const list = byArea.get(a) ?? [];
    list.push(s);
    byArea.set(a, list);
  }

  const rooms: Room[] = registry.areas.map((area) => {
    const all = byArea.get(area.area_id) ?? [];
    const lightStates = all.filter(
      (s) =>
        s.state !== "unavailable" &&
        (domainOf(s.entity_id) === "light" || isLightingSwitch(s)),
    );
    const lights: RoomLight[] = lightStates.map((s) => {
      const on = s.state === "on";
      // switch.* lighting loads are on/off only (no brightness attribute).
      if (domainOf(s.entity_id) === "switch") {
        return {
          state: s,
          on,
          pct: on ? 100 : 0,
          contributes: on,
          domain: "switch",
        };
      }
      const brightness = (s.attributes.brightness as number | undefined) ?? 0;
      const pct = on ? Math.round((brightness / 255) * 100) : 0;
      // If a light is on but reports no brightness attribute (some non-dimmable
      // bulbs), treat it as 100% so it still counts.
      const effectivePct =
        on && brightness === 0 && !("brightness" in s.attributes) ? 100 : pct;
      return {
        state: s,
        on,
        pct: effectivePct,
        contributes: on && effectivePct >= ROOM_ON_THRESHOLD_PCT,
        domain: "light",
      };
    });
    const onCount = lights.filter((l) => l.contributes).length;
    const physicallyOn = lights.filter((l) => l.on);
    const avgPctOfOn =
      physicallyOn.length === 0
        ? 0
        : Math.round(
            physicallyOn.reduce((acc, l) => acc + l.pct, 0) /
              physicallyOn.length,
          );
    return {
      id: area.area_id,
      name: area.name,
      floor_id: area.floor_id ?? null,
      lights: lights.sort((a, b) =>
        friendly(a.state).localeCompare(friendly(b.state)),
      ),
      allEntities: all,
      onCount,
      totalLights: lights.length,
      on: onCount > 0,
      avgPctOfOn,
    };
  });

  return rooms
    .filter((r) => r.totalLights > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- Room actions ----------

// Lighting loads can be either light.* (dimmable) or switch.* entities. Service
// calls must target the entity's own domain — calling light.turn_on on a switch
// silently no-ops (HA returns 200), so we always split ids by domain.
const splitRoomIds = (room: Room) => {
  const lightIds: string[] = [];
  const switchIds: string[] = [];
  for (const l of room.lights) {
    (l.domain === "switch" ? switchIds : lightIds).push(l.state.entity_id);
  }
  return { lightIds, switchIds };
};
const clampPct = (pct: number) => Math.max(1, Math.min(100, Math.round(pct)));

/** Turn the whole room on by setting every light to the threshold brightness. */
export async function turnRoomOn(
  room: Room,
  pct: number = ROOM_ON_THRESHOLD_PCT,
) {
  const { lightIds, switchIds } = splitRoomIds(room);
  const calls: Promise<unknown>[] = [];
  if (lightIds.length)
    calls.push(
      haCallService("light", "turn_on", {
        entity_id: lightIds,
        brightness_pct: pct,
      }),
    );
  if (switchIds.length)
    calls.push(haCallService("switch", "turn_on", { entity_id: switchIds }));
  await Promise.all(calls);
}

/** Turn every light in the room off. */
export async function turnRoomOff(room: Room) {
  const { lightIds, switchIds } = splitRoomIds(room);
  const calls: Promise<unknown>[] = [];
  if (lightIds.length)
    calls.push(haCallService("light", "turn_off", { entity_id: lightIds }));
  if (switchIds.length)
    calls.push(haCallService("switch", "turn_off", { entity_id: switchIds }));
  await Promise.all(calls);
}

/** Set a single light to a specific brightness percentage (0 = off). */
export async function setLightBrightness(entityId: string, pct: number) {
  // switch.* lighting loads are on/off only — ignore the brightness target.
  if (domainOf(entityId) === "switch") {
    await haCallService("switch", pct <= 0 ? "turn_off" : "turn_on", {
      entity_id: entityId,
    });
    return;
  }
  if (pct <= 0) {
    await haCallService("light", "turn_off", { entity_id: entityId });
    return;
  }
  await haCallService("light", "turn_on", {
    entity_id: entityId,
    brightness_pct: clampPct(pct),
  });
}

/** Toggle a single light on (to 35%) or off. */
export async function toggleLight(entityId: string, on: boolean) {
  if (domainOf(entityId) === "switch") {
    await haCallService("switch", on ? "turn_on" : "turn_off", {
      entity_id: entityId,
    });
    return;
  }
  if (on) {
    await haCallService("light", "turn_on", {
      entity_id: entityId,
      brightness_pct: ROOM_ON_THRESHOLD_PCT,
    });
  } else {
    await haCallService("light", "turn_off", { entity_id: entityId });
  }
}

/** Set every light in the room to a specific brightness percentage (0 = off). */
export async function setRoomBrightness(room: Room, pct: number) {
  if (pct <= 0) return turnRoomOff(room);
  const { lightIds, switchIds } = splitRoomIds(room);
  const calls: Promise<unknown>[] = [];
  if (lightIds.length)
    calls.push(
      haCallService("light", "turn_on", {
        entity_id: lightIds,
        brightness_pct: clampPct(pct),
      }),
    );
  // switches can't dim — any non-zero target just turns them on.
  if (switchIds.length)
    calls.push(haCallService("switch", "turn_on", { entity_id: switchIds }));
  await Promise.all(calls);
}
