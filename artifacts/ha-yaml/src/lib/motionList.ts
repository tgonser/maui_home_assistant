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

export type MotionItem = { id: string; name: string; active: boolean; changed: number; available: boolean };

/** Motion sensors, most recent activity first. "changed" is when it last
 *  turned on (or off, if that's all HA knows). */
export function recentMotion(states: Map<string, HAState>): MotionItem[] {
  return [...states.values()].filter(isMotionSensor).map((s) => ({
    id: s.entity_id,
    name: motionSensorLabel(String(s.attributes.friendly_name ?? s.entity_id).replace(/^Makena Alarm\s+/i, "")),
    active: s.state === "on",
    available: s.state !== "unavailable" && s.state !== "unknown",
    changed: Date.parse(s.last_changed),
  })).sort((a, b) => Number(b.active) - Number(a.active) || b.changed - a.changed);
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
