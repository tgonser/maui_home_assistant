const secretKey = /password|passwd|token|secret|credential|authorization|authentication|api[_-]?key|private[_-]?key|client[_-]?key|(^|[._-])(pin|auth|username)($|[._-])/i;
const urlKey = /(^|[_-])(url|uri|webhook)($|[_-])/i;

/** Redact instead of exporting reusable credentials or private endpoint URLs. */
export function sanitizeSurvey<T>(value: T): T {
  if (typeof value === "string") {
    return value
      .replace(/\b(?:https?|wss?|rtsp|mqtts?|ftp):\/\/[^\s"'<>`]+/gi, "[REDACTED URL]")
      .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
      .replace(/((?:password|passwd|token|secret|api[_-]?key|authorization)\s*[:=]\s*)[^\s,;"']+/gi, "$1[REDACTED]") as T;
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeSurvey(item)) as T;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    const sensitiveEntity = typeof object.entity_id === "string" && secretKey.test(object.entity_id);
    return Object.fromEntries(Object.entries(object).map(([key, item]) => [
      key,
      sensitiveEntity && key === "attributes" ? {} :
      secretKey.test(key) || urlKey.test(key) || (sensitiveEntity && key === "state")
        ? "[REDACTED]"
        : sanitizeSurvey(item),
    ])) as T;
  }
  return value;
}
