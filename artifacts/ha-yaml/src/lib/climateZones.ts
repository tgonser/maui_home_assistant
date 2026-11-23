import type { HAState } from "./ha";
import { FLOORS } from "./houseMap.ts";

// The nine Mākena thermostats (Honeywell TCC), in walking order, and what the
// Climate screen shows for each. Five of them are run by the solar-aware
// matrix and get an automatic "manual hold" timer when a person changes them.

export const ZONES: Array<{ id: string; name: string; where: string }> = [
  { id: "climate.kitchen", name: "Kitchen", where: "Ground" },
  { id: "climate.atrium", name: "Great Room", where: "Ground" },
  { id: "climate.bar", name: "Bar", where: "Ground" },
  { id: "climate.beach_room", name: "Beach", where: "Ground" },
  { id: "climate.boardroom", name: "Boardroom", where: "Ground" },
  { id: "climate.master_bed_2", name: "Master", where: "Upstairs" },
  { id: "climate.sitting", name: "Sitting", where: "Upstairs" },
  { id: "climate.maui_bar", name: "Molokini", where: "Upstairs" },
  { id: "climate.upper_mauka", name: "Mauka", where: "Upstairs" },
];

export const holdTimer = (zoneId: string) => `timer.maui_hold_${zoneId.split(".")[1]}`;

export type ZoneView = {
  id: string; name: string; where: string;
  now: number | null; target: number | null; mode: string; action: string;
  held: boolean; heldUntil: string | null; doorOpen: boolean; available: boolean;
};

const n = (v: unknown) => (Number.isFinite(Number(v)) && v !== null && v !== undefined ? Math.round(Number(v)) : null);

export function zoneViews(states: Map<string, HAState>): ZoneView[] {
  const openDoorsPause = new Set(
    FLOORS.flatMap((f) => f.doors).filter((d) => d.sensor && states.get(d.sensor)?.state === "on").flatMap((d) => d.pauses ?? []),
  );
  return ZONES.map((z) => {
    const st = states.get(z.id);
    const timer = states.get(holdTimer(z.id));
    const held = timer?.state === "active";
    const fin = timer?.attributes.finishes_at ? String(timer.attributes.finishes_at) : null;
    return {
      ...z,
      now: n(st?.attributes.current_temperature),
      target: n(st?.attributes.temperature),
      mode: st?.state ?? "unavailable",
      action: String(st?.attributes.hvac_action ?? ""),
      held,
      heldUntil: held ? fin : null,
      doorOpen: openDoorsPause.has(z.id),
      available: !!st && st.state !== "unavailable",
    };
  });
}

/** Evening/morning tip: when it is clearly cooler outside than in. */
export function openSliderTip(outside: number | null, insideAvg: number | null, hour: number): string | null {
  if (outside == null || insideAvg == null) return null;
  const coolHours = hour >= 17 || hour < 9;
  if (coolHours && outside <= insideAvg - 3) return `It's ${outside}° outside and ${insideAvg}° inside — opening a slider will cool the house for free.`;
  return null;
}
