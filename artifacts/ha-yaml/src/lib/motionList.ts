import type { HAState } from "./ha";
import { motionSensorLabel } from "./display.ts";

// Motion sensors for the wall (same rules as the classic Motion tab): real
// motion sensors only — no camera motion, battery or tamper sub-entities.

export function isMotionSensor(s: HAState): boolean {
  if (!s.entity_id.startsWith("binary_sensor.")) return false;
  const dc = s.attributes.device_class;
  const isMotion = dc === "motion" || (/^binary_sensor\.motion_/.test(s.entity_id) && !/_battery|_tamper|_contact|_moisture|_alarm/.test(s.entity_id));
  if (!isMotion) return false;
  const name = String(s.attributes.friendly_name ?? s.entity_id);
  return !/\bG[56]\b|PTZ|Turret|Instant\b/i.test(name);
}

export type MotionItem = { id: string; name: string; active: boolean; changed: number | null; available: boolean };

/** Motion sensors, most recent motion first. "changed" is when it last saw
 *  motion: from the history (lastOn) or, if it is moving right now, its live
 *  state. A sensor's live "last changed" alone is NOT used: a Home Assistant
 *  restart resets it on every sensor, which made the whole house look busy. */
export function recentMotion(states: Map<string, HAState>, lastOn: Map<string, number> = new Map()): MotionItem[] {
  return [...states.values()].filter(isMotionSensor).map((s) => {
    const active = s.state === "on";
    const live = active ? Date.parse(s.last_changed) : NaN;
    const hist = lastOn.get(s.entity_id);
    const times = [live, hist ?? NaN].filter((t) => Number.isFinite(t));
    return {
      id: s.entity_id,
      name: motionSensorLabel(String(s.attributes.friendly_name ?? s.entity_id).replace(/^Makena Alarm\s+/i, "")),
      active,
      available: s.state !== "unavailable" && s.state !== "unknown",
      changed: times.length ? Math.max(...times) : null,
    };
  }).sort((a, b) => Number(b.active) - Number(a.active) || (b.changed ?? 0) - (a.changed ?? 0));
}

/** From HA history (history_during_period, minimal response: {s, lu} points),
 *  the last time each sensor went from off to on — real motion only, not a
 *  restart (unknown/unavailable → anything). */
export function lastMotionFromHistory(history: Record<string, Array<{ s: string; lu?: number; lc?: number }>>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, points] of Object.entries(history)) {
    let prev: string | null = null;
    for (const p of points) {
      const t = (p.lc ?? p.lu ?? NaN) * 1000;
      if (p.s === "on" && prev === "off" && Number.isFinite(t)) out.set(id, Math.max(out.get(id) ?? 0, t));
      prev = p.s;
    }
  }
  return out;
}

/** "now", "4 min ago", "2 h ago", "3 days ago". */
export function agoText(ms: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}
