import type { HAState } from "./ha";

/** Raw HA friendly name, falling back to entity_id. */
export function friendlyName(s: HAState): string {
  return (s.attributes.friendly_name as string | undefined) ?? s.entity_id;
}

/**
 * Extract a clean location label from a motion sensor's friendly name.
 * "USL-Motion_Bar Motion" → "Bar"
 * "UP sense - stairs Motion" → "Stairs"
 * "MOTION KITCHEN" → "Kitchen"
 * "MOTION BATHROOM 2" → "Bathroom 2"
 */
export function motionSensorLabel(name: string): string {
  const cleaned = name
    .replace(/^USL-Motion_/i, "")
    .replace(/^UP sense\s*-\s*/i, "")
    .replace(/^MOTION\s+/i, "")
    .replace(/\s*Motion\s*$/i, "")
    .trim() || name;
  if (cleaned === cleaned.toUpperCase()) {
    return cleaned.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return cleaned;
}

/**
 * Display name for an entity: user alias wins, then HA friendly name.
 * Single source of truth for entity labels across the UI.
 */
export function displayName(s: HAState, aliases?: Record<string, string>): string {
  return aliases?.[s.entity_id] ?? friendlyName(s);
}
