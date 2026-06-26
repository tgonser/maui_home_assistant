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
    // Strip UniFi camera generation numbers — not descriptive
    .replace(/\bG[56]\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || name;
  // Title-case if all-caps or all-lowercase
  if (cleaned === cleaned.toUpperCase() || cleaned === cleaned.toLowerCase()) {
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

/**
 * Display name with full precedence:
 *   1. Entity alias (user-set per tile)
 *   2. Room alias prefix replacement — if friendly name starts with the HA
 *      area name and that area has been aliased, substitute the new room name
 *      (e.g. "Bedroom 3 Light" + alias "Board Room" → "Board Room Light")
 *   3. Raw HA friendly name
 */
export function displayNameWithRoom(
  s: HAState,
  entityAliases?: Record<string, string>,
  roomAliases?: Record<string, string>,
  /** area_id → HA canonical area name */
  areaNames?: Map<string, string>,
  /** resolved area_id for this entity */
  areaId?: string,
): string {
  if (entityAliases?.[s.entity_id]) return entityAliases[s.entity_id];

  if (areaId && roomAliases?.[areaId] && areaNames) {
    const haRoom = areaNames.get(areaId);
    const fn = friendlyName(s);
    if (haRoom && fn.toLowerCase().startsWith(haRoom.toLowerCase())) {
      const suffix = fn.slice(haRoom.length);
      return (roomAliases[areaId] + suffix).trim();
    }
  }

  return friendlyName(s);
}
