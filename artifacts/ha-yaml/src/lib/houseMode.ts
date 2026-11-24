import type { HAState } from "./ha";

// House mode (input_select.maui_house_mode) for the wall, with the classic
// wall's guard: while on Vacation and T2's phone hasn't been home for 48 h,
// Owners can't be picked from a wall (workers shouldn't flip it).

export const MODE_ENTITY = "input_select.maui_house_mode";
export const HOUSE_MODES = [
  { option: "Owners Home", label: "Owners", hint: "You're here" },
  { option: "Visitors", label: "Visitors", hint: "Guests staying" },
  { option: "Vacation", label: "Vacation", hint: "Nobody here — AC follows the sun" },
  { option: "Suspend", label: "Suspend", hint: "Climate automation paused — set AC by hand" },
] as const;

const PHONE = /tom.*iphone.*temp|iphone.*tom/i;

export function modeGuard(states: Map<string, HAState>, now: number): { current: string; ownersLocked: boolean; awayHours: number | null; home: boolean | null } {
  const current = states.get(MODE_ENTITY)?.state ?? "";
  const phone = [...states.values()].find((s) => s.entity_id.startsWith("device_tracker.") && PHONE.test(s.entity_id));
  if (!phone) return { current, ownersLocked: false, awayHours: null, home: null };
  const home = phone.state === "home";
  const awayHours = home ? 0 : Math.floor((now - Date.parse(phone.last_changed)) / 3_600_000);
  return { current, ownersLocked: current === "Vacation" && !home && awayHours >= 48, awayHours, home };
}
