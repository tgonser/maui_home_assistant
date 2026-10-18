import { readFileSync } from "node:fs";

export type AlarmOptions = { enabled: boolean; entityId: string; code: string };

export function parseAlarmOptions(value: unknown): AlarmOptions {
  const o = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const entityId = typeof o.alarm_panel_entity_id === "string" ? o.alarm_panel_entity_id.trim() : "";
  const code = typeof o.alarm_code === "string" ? o.alarm_code.trim() : "";
  return {
    enabled: o.alarm_pin_free === true &&
      /^alarm_control_panel\.[a-z0-9_]+$/.test(entityId) && code.length > 0 && code.length <= 64,
    entityId, code,
  };
}

export function loadAlarmOptions(): AlarmOptions {
  try {
    return parseAlarmOptions(JSON.parse(readFileSync(process.env.HASSIO_OPTIONS_PATH ?? "/data/options.json", "utf8")));
  } catch {
    return { enabled: false, entityId: "", code: "" };
  }
}

/** Never inject the stored credential into a client-supplied upstream URL. */
export function alarmBodyWithStoredCode(
  body: unknown, clientUrl: unknown, options: AlarmOptions, supervisorAvailable: boolean,
): unknown {
  if (!options.enabled || !supervisorAvailable || clientUrl !== "__supervisor__" ||
      !body || typeof body !== "object" || Array.isArray(body)) return body;
  const data = body as Record<string, unknown>;
  if (data.entity_id !== options.entityId || data.code !== undefined ||
      Object.keys(data).some(key => key !== "entity_id")) return body;
  return { entity_id: options.entityId, code: options.code };
}
