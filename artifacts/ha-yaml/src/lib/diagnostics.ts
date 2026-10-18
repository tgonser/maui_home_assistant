import type { HAState } from "./ha";

export const diagnosticGroups = ["battery", "climate", "solar", "stormPrep"] as const;
export type DiagnosticGroup = typeof diagnosticGroups[number];
const attributes = new Set([
  "friendly_name", "unit_of_measurement", "device_class", "state_class",
  "min", "max", "step", "mode", "options", "supported_features",
  "temperature", "current_temperature", "target_temp_high", "target_temp_low",
  "min_temp", "max_temp", "target_temp_step", "hvac_modes", "hvac_action",
  "fan_mode", "fan_modes", "preset_mode", "preset_modes", "current_humidity",
  "config_valid", "recovery_required", "restore_failed", "duration_hours",
  "control_entity", "control_entity_2", "target_value", "target_value_2",
  "approval_valid", "review_at", "approval_expires_at", "last_reset",
]);
const sensitive = /token|password|secret|credential|api_key|access_key|pin(?:_|$)/i;

function clean(value: unknown): unknown {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value === null) return value;
  if (typeof value === "string") {
    if (/https?:\/\/|bearer\s|eyJ[A-Za-z0-9_-]+\./i.test(value)) return "[redacted]";
    return value.slice(0, 500);
  }
  if (Array.isArray(value)) return value.slice(0, 100).map(clean);
  // Arbitrary nested attributes may contain credentials or location data.
  return undefined;
}

export function diagnosticGroup(entity: HAState): DiagnosticGroup | undefined {
  const id = entity.entity_id;
  if (sensitive.test(id)) return undefined;
  if (/^(input_text|input_number|input_boolean|input_datetime|timer|sensor|binary_sensor)\.maui_storm_prep_/.test(id)) return "stormPrep";
  if (id.startsWith("climate.")) return "climate";
  if (!/^(sensor|binary_sensor|number|select|switch)\./.test(id)) return undefined;
  const name = `${id} ${String(entity.attributes.friendly_name || "")}`;
  if (/solar|envoy|photovoltaic|grid_|home_load|home_usage/i.test(name)) return "solar";
  if (/battery|powerwall|4680|gonser|backup_reserve/i.test(name) &&
      !/phone|ipad|iphone|tablet|watch|laptop|vehicle/i.test(name)) return "battery";
  return undefined;
}

export function buildDiagnostics(states: HAState[], groups: readonly DiagnosticGroup[], capturedAt = new Date().toISOString()) {
  const entities = states.filter(entity => {
    const group = diagnosticGroup(entity);
    return group && groups.includes(group);
  }).map(entity => ({
    entity_id: entity.entity_id,
    group: diagnosticGroup(entity),
    state: clean(entity.state),
    last_updated: entity.last_updated,
    attributes: Object.fromEntries(Object.entries(entity.attributes)
      .filter(([key]) => attributes.has(key) && !sensitive.test(key))
      .map(([key, value]) => [key, clean(value)])
      .filter(([, value]) => value !== undefined)),
  })).sort((a, b) => a.entity_id.localeCompare(b.entity_id));
  return {
    format: "wall-kiosk-diagnostics",
    schema_version: 1,
    captured_at: capturedAt,
    groups,
    privacy_notice: "Contains entity names, device readings and settings. Review before sharing. No connection credentials, approval tokens, location attributes, arbitrary nested attributes or browser storage are included.",
    limitations: "Read-only state snapshot. Does not include configuration YAML, execution traces, logs, recorder history or device/area registries.",
    entity_count: entities.length,
    entities,
  };
}
