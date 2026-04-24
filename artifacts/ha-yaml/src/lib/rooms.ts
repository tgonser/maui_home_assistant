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
    for (const e of entities) {
      const a = e.area_id ?? (e.device_id ? deviceArea.get(e.device_id) : null);
      if (a) entityArea.set(e.entity_id, a);
    }
    set({
      areas,
      devices,
      entities,
      entityArea,
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
      (s) => domainOf(s.entity_id) === "light" && s.state !== "unavailable",
    );
    const lights: RoomLight[] = lightStates.map((s) => {
      const on = s.state === "on";
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
    .sort((a, b) => {
      // On rooms first, then by name
      if (a.on !== b.on) return a.on ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

// ---------- Room actions ----------

/** Turn the whole room on by setting every light to the threshold brightness. */
export async function turnRoomOn(
  room: Room,
  pct: number = ROOM_ON_THRESHOLD_PCT,
) {
  const ids = room.lights.map((l) => l.state.entity_id);
  if (ids.length === 0) return;
  await haCallService("light", "turn_on", {
    entity_id: ids,
    brightness_pct: pct,
  });
}

/** Turn every light in the room off. */
export async function turnRoomOff(room: Room) {
  const ids = room.lights.map((l) => l.state.entity_id);
  if (ids.length === 0) return;
  await haCallService("light", "turn_off", { entity_id: ids });
}

/** Set every light in the room to a specific brightness percentage (0 = off). */
export async function setRoomBrightness(room: Room, pct: number) {
  if (pct <= 0) return turnRoomOff(room);
  const ids = room.lights.map((l) => l.state.entity_id);
  if (ids.length === 0) return;
  await haCallService("light", "turn_on", {
    entity_id: ids,
    brightness_pct: Math.max(1, Math.min(100, Math.round(pct))),
  });
}
