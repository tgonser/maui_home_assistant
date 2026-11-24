import type { HAState } from "./ha";

// Mākena's Lutron shades, by floor and room. Entity names come from the
// Lutron project, so they are mapped to the room names used on the wall.

export const SHADE_SECTIONS: Array<{ title: string; shades: Array<[string, string]> }> = [
  { title: "Ground floor", shades: [
    ["cover.floor_1_bar_shade_group_1", "Bar"],
    ["cover.floor_1_bedroom_2_suite_bed_2_shade_group_1", "Beach"],
    ["cover.floor_1_bedroom_2_suite_bed_2_bath_shade_group_1", "Beach bath"],
    ["cover.floor_1_equipment_utility_window", "Utility window"],
  ] },
  { title: "Upstairs", shades: [
    ["cover.floor_2_master_suite_master_bed_shade_group_1", "Master bedroom"],
    ["cover.floor_2_master_suite_master_bath_shade_group_1", "Master bath 1"],
    ["cover.floor_2_master_suite_master_bath_floor_2_master_suite_master_bath_shade_group_2", "Master bath 2"],
    ["cover.floor_2_master_suite_closets_floor_2_master_suite_closets_shade_group_1", "Closets"],
    ["cover.floor_2_bedroom_4_suite_bed_4_shade_group_1", "Molokini"],
    ["cover.floor_2_bedroom_4_suite_bed_4_bath_shade_group_1", "Molokini bath"],
    ["cover.floor_2_bedroom_5_suite_bed_5_shade_group_1", "Mauka 1"],
    ["cover.floor_2_bedroom_5_suite_bed_5_shade_group_2", "Mauka 2"],
  ] },
];

export const SHADE_IDS = SHADE_SECTIONS.flatMap((s) => s.shades.map(([id]) => id));

export type ShadeView = { id: string; name: string; pos: number | null; moving: boolean; available: boolean; label: string };

export function shadeView(states: Map<string, HAState>, id: string, name: string): ShadeView {
  const st = states.get(id);
  const available = !!st && st.state !== "unavailable";
  const raw = Number(st?.attributes.current_position);
  const pos = available && Number.isFinite(raw) ? Math.round(raw) : null;
  const moving = st?.state === "opening" || st?.state === "closing";
  const label = !available ? "Offline" : moving ? (st!.state === "opening" ? "Opening…" : "Closing…") : pos == null ? st!.state : pos >= 99 ? "Open" : pos <= 1 ? "Closed" : `${pos}% open`;
  return { id, name, pos, moving, available, label };
}

/** Which of Open / Half / Close matches where the shade is now. */
export function shadePreset(pos: number | null): "open" | "half" | "close" | null {
  if (pos == null) return null;
  if (pos >= 95) return "open";
  if (pos <= 5) return "close";
  if (pos >= 35 && pos <= 65) return "half";
  return null;
}
