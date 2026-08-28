import type { HAState } from "./ha";

export type StormPrepStatus = {
  active: boolean;
  pending: boolean;
  recoveryRequired: boolean;
  recoveryFailed: boolean;
  statusEntity: HAState | undefined;
  riskEntity: HAState | undefined;
  reason: string;
  forecastWindow: string;
  proposedAction: string;
  controlEntityId: string;
  controlEntityId2: string;
  configValid: boolean;
  lastResult: string;
  reviewAt: string;
  triggerSource: string;
  approvalToken: string;
  approvalExpiresAt: string;
  approvalValid: boolean;
};

export type StormPrepSettings = {
  weatherEntity: string;
  alertEntity: string;
  notifyService: string;
  controlEntity: string;
  verifiedControl: string;
  controlValue: string;
  controlEntity2: string;
  verifiedControl2: string;
  controlValue2: string;
  rainThreshold: number;
  lowSunDays: number;
  durationHours: number;
};

const EXCLUDE_REGEX = /\b(ev|vehicle|car|charger|charging_cable|phone|tablet|ipad|watch|laptop|sensor|voltage|current|temperature|health|wear|degraded|wall_connector)\b/i;
const EXCLUDE_SUBSTRING = /ev_charging|car_charging/i;
const DUAL_HELPERS = [
  "input_text.maui_storm_prep_control_entity_2",
  "input_text.maui_storm_prep_verified_control_2",
  "input_text.maui_storm_prep_control_value_2",
  "input_text.maui_storm_prep_requested_control_2",
  "input_text.maui_storm_prep_requested_value_2",
  "input_text.maui_storm_prep_requested_domain_2",
  "input_text.maui_storm_prep_previous_entity_2",
  "input_text.maui_storm_prep_previous_value_2",
] as const;

export function hasCompleteStormPrepDualHelperSet(states: HAState[]): boolean {
  const ids = new Set(states.map((state) => state.entity_id));
  return DUAL_HELPERS.every((entityId) => ids.has(entityId));
}

export function stormPrepActionsAvailable(states: HAState[]): boolean {
  return hasCompleteStormPrepDualHelperSet(states);
}

export function getStormPrepStatus(states: HAState[]): StormPrepStatus {
  const riskEntity = states.find((s) => s.entity_id === "binary_sensor.maui_storm_prep_risk");
  const statusEntity = states.find((s) => s.entity_id === "sensor.maui_storm_prep_status");
  const pendingEntity = states.find((s) => s.entity_id === "input_boolean.maui_storm_prep_pending");
  const activeEntity = states.find((s) => s.entity_id === "input_boolean.maui_storm_prep_active");

  const pending = pendingEntity?.state === "on";
  const active = activeEntity?.state === "on";

  const getAttr = (key: string): string =>
    statusEntity?.attributes[key] ? String(statusEntity.attributes[key]) : "";

  return {
    active,
    pending,
    recoveryRequired: getAttr("recovery_required") === "true",
    recoveryFailed: getAttr("restore_failed") === "true",
    statusEntity,
    riskEntity,
    reason: getAttr("reason"),
    forecastWindow: getAttr("forecast_window"),
    proposedAction: getAttr("proposed_action"),
    controlEntityId: getAttr("control_entity"),
    controlEntityId2: getAttr("control_entity_2"),
    configValid: statusEntity?.attributes.config_valid === true || String(statusEntity?.attributes.config_valid) === "true",
    lastResult: getAttr("last_result"),
    reviewAt: getAttr("review_at"),
    triggerSource: getAttr("trigger_source"),
    approvalToken: getAttr("approval_token"),
    approvalExpiresAt: getAttr("approval_expires_at"),
    approvalValid:
      statusEntity?.attributes.approval_valid === true ||
      String(statusEntity?.attributes.approval_valid) === "true",
  };
}

export function getStormPrepSettings(states: HAState[]): StormPrepSettings {
  const getStr = (id: string) => states.find((s) => s.entity_id === id)?.state || "";
  const getNum = (id: string) => {
    const val = parseFloat(getStr(id));
    return isNaN(val) ? 0 : val;
  };

  return {
    weatherEntity: getStr("input_text.maui_storm_prep_weather_entity"),
    alertEntity: getStr("input_text.maui_storm_prep_alert_entity"),
    notifyService: getStr("input_text.maui_storm_prep_notify_service"),
    controlEntity: getStr("input_text.maui_storm_prep_control_entity"),
    verifiedControl: getStr("input_text.maui_storm_prep_verified_control"),
    controlValue: getStr("input_text.maui_storm_prep_control_value"),
    controlEntity2: getStr("input_text.maui_storm_prep_control_entity_2"),
    verifiedControl2: getStr("input_text.maui_storm_prep_verified_control_2"),
    controlValue2: getStr("input_text.maui_storm_prep_control_value_2"),
    rainThreshold: getNum("input_number.maui_storm_prep_rain_threshold"),
    lowSunDays: getNum("input_number.maui_storm_prep_low_sun_days"),
    durationHours: getNum("input_number.maui_storm_prep_duration_hours"),
  };
}

export function getCandidateBatteryControls(states: HAState[]): HAState[] {
  return states.filter((s) => {
    const domain = s.entity_id.split(".")[0];
    if (domain !== "switch" && domain !== "select" && domain !== "number") {
      return false;
    }
    
    const name = ((s.attributes.friendly_name as string) || s.entity_id).toLowerCase();
    const id = s.entity_id.toLowerCase();
    
    if (EXCLUDE_REGEX.test(name) || EXCLUDE_REGEX.test(id) || EXCLUDE_SUBSTRING.test(name) || EXCLUDE_SUBSTRING.test(id)) {
      return false;
    }

    const isBattery = /(battery|powerwall|enphase|solaredge|span|storage|4680|gonser)/i.test(name) || /(battery|powerwall|enphase|solaredge|span|storage|4680|gonser)/i.test(id);
    if (!isBattery) return false;

    if (domain === "number" && /(reserve|backup)/i.test(id + name)) return true;
    if (domain === "select" && /(operation|mode|reserve|backup)/i.test(id + name)) return true;
    if (domain === "switch" && /(storm.?watch|grid.?charg(e|ing))/i.test(id + name)) return true;

    return false;
  });
}

export function validateControlTarget(entity: HAState | undefined, value: string): { valid: boolean; reason?: string } {
  if (!entity) return { valid: false, reason: "No entity selected" };
  if (!value || value.trim() === "") return { valid: false, reason: "Value cannot be empty" };

  const domain = entity.entity_id.split(".")[0];
  const val = value.trim();

  if (domain === "switch") {
    const v = val.toLowerCase();
    if (v !== "on") {
      return { valid: false, reason: "Storm-prep switches must be enabled with 'on'" };
    }
    return { valid: true };
  }

  if (domain === "select") {
    const options = (entity.attributes.options as string[]) || [];
    if (!options.includes(val)) {
      return { valid: false, reason: `Value must be one of: ${options.join(", ")}` };
    }
    return { valid: true };
  }

  if (domain === "number") {
    if (entity.attributes.unit_of_measurement !== "%") {
      return { valid: false, reason: "Reserve control must use percent (%)" };
    }
    const num = Number(val);
    if (isNaN(num)) {
      return { valid: false, reason: "Value must be a number" };
    }
    const min = entity.attributes.min as number | undefined;
    const max = entity.attributes.max as number | undefined;
    if (min !== undefined && num < min) return { valid: false, reason: `Value cannot be less than ${min}` };
    if (max !== undefined && num > max) return { valid: false, reason: `Value cannot be greater than ${max}` };
    return { valid: true };
  }

  return { valid: false, reason: `Unsupported domain: ${domain}` };
}
