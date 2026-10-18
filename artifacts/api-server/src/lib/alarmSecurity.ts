/** Guards the wall's alarm service calls without storing or logging alarm codes. */
const SERVICES = new Set([
  "alarm_arm_home", "alarm_arm_away", "alarm_arm_night", "alarm_disarm",
]);

export interface AlarmAccessError {
  status: number;
  code: string;
  error: string;
}

export function isAlarmServicePath(path: unknown): boolean {
  if (typeof path !== "string") return false;
  try {
    const normalized = new URL(decodeURIComponent(path), "http://proxy.invalid").pathname;
    return /\/api\/services\/alarm_control_panel(?:\/|$)/i.test(normalized);
  } catch {
    return /alarm_control_panel/i.test(path);
  }
}

export function alarmServiceAccessError(
  path: unknown, method: unknown, body: unknown, secure: boolean,
): AlarmAccessError | undefined {
  if (!isAlarmServicePath(path)) return undefined;
  if (!secure) return {
    status: 426, code: "ALARM_SECURE_TRANSPORT_REQUIRED",
    error: "Alarm controls require HTTPS or secure Home Assistant ingress. Do not enter your alarm code on a direct HTTP connection.",
  };
  const service = typeof path === "string"
    ? /^\/api\/services\/alarm_control_panel\/([a-z_]+)$/.exec(path)?.[1]
    : undefined;
  if (method !== "POST" || !service || !SERVICES.has(service)) return {
    status: 400, code: "ALARM_ACTION_UNSUPPORTED",
    error: "Use the Alarm panel's Arm Stay, Arm Away, Arm Night, or Disarm controls.",
  };
  const data = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown> : {};
  if (
    typeof data.entity_id !== "string" ||
    !/^alarm_control_panel\.[a-z0-9_]+$/.test(data.entity_id) ||
    Object.keys(data).some(key => key !== "entity_id" && key !== "code")
  ) return {
    status: 400, code: "ALARM_EXACT_TARGET_REQUIRED",
    error: "Select exactly one alarm panel; area, device, and additional selectors are not allowed.",
  };
  if (typeof data.code !== "string" || !data.code.trim() || data.code.length > 64) return {
    status: 400, code: "ALARM_CODE_REQUIRED",
    error: "Enter your alarm-system code for this action. This is not the kiosk homeowner PIN.",
  };
  return undefined;
}

export function isAlarmWsCommand(command: unknown): boolean {
  if (!command || typeof command !== "object") return false;
  const c = command as Record<string, unknown>;
  return c.type === "call_service" &&
    typeof c.domain === "string" && c.domain.toLowerCase() === "alarm_control_panel";
}

/** Counts all attempts, including HA's possible HTTP-200 rejection of bad codes. */
export class AlarmAttemptLimiter {
  private attempts = new Map<string, { count: number; until: number }>();
  allow(key: string, now = Date.now()): boolean {
    for (const [k, item] of this.attempts) if (item.until <= now) this.attempts.delete(k);
    const item = this.attempts.get(key);
    if (item) {
      if (item.count >= 5) return false;
      item.count += 1;
      return true;
    }
    if (this.attempts.size >= 1000) return false;
    this.attempts.set(key, { count: 1, until: now + 60_000 });
    return true;
  }
}
