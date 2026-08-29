import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

const SESSION_COOKIE = "maui_storm_prep_auth";
const SESSION_TTL_MS = 10 * 60 * 1000;
const OPTIONS_PATH = process.env.HASSIO_OPTIONS_PATH ?? "/data/options.json";
const SECRET_PATH = "/data/.storm_prep_session_secret";

const BATTERY_CONTROL_ENTITY =
  /(powerwall|battery|backup|reserve|enphase|solaredge|span|storage|gonser|4680|energy.?gateway|storm.?watch|grid.?charg)/i;
const INDIRECT_DOMAIN = /^(script|automation|scene)$/;
const STORM_PREP_NAMESPACE =
  /^(?:input_text|input_boolean|input_datetime|input_number|input_select|timer|script|automation)\.maui_storm_prep_/;
const LIGHTING_SWITCH_ENTITY =
  /(?:^|[._-])(light|lights|lamp|lamps|sconce|sconces|niche|chandelier|pendant|pendants|downlight|downlights|spotlight|spotlights|cove|lantern|lanterns|vanity)(?:$|[._-])/i;
const BROAD_TARGET_KEYS = ["device_id", "area_id", "floor_id", "label_id"];

export const PROTECTED_STORM_PREP_CONTROL_HELPERS = [
  "input_text.maui_storm_prep_control_entity",
  "input_text.maui_storm_prep_verified_control",
  "input_text.maui_storm_prep_requested_control",
  "input_text.maui_storm_prep_previous_entity",
  "input_text.maui_storm_prep_control_entity_2",
  "input_text.maui_storm_prep_verified_control_2",
  "input_text.maui_storm_prep_requested_control_2",
  "input_text.maui_storm_prep_previous_entity_2",
] as const;
let ephemeralSecret: string | undefined;

function apiPathname(path: unknown): string {
  if (typeof path !== "string") return "";
  // Proxy callers send relative HA API paths. Strip query/hash before security
  // classification so `/api/services/script/turn_on?x=1` cannot bypass an
  // exact-path or anchored-regex check.
  const delimiter = path.search(/[?#]/);
  return delimiter < 0 ? path : path.slice(0, delimiter);
}

export function isProtectedStormPrepTransport(input: {
  encrypted?: boolean;
  remoteAddress?: string;
  forwardedProto?: string;
  ingressPath?: string;
  replitProxy?: boolean;
}): boolean {
  if (input.encrypted) return true;
  const remote = (input.remoteAddress ?? "").replace(/^::ffff:/, "");
  const trustedLocalProxy =
    remote === "127.0.0.1" ||
    remote === "::1" ||
    remote === "172.30.32.2" ||
    input.replitProxy === true;
  if (!trustedLocalProxy) return false;
  const protocol = (input.forwardedProto ?? "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  return (
    protocol === "https" ||
    (remote === "172.30.32.2" && Boolean(input.ingressPath))
  );
}

function sessionSecret(): string {
  const configured = process.env.SESSION_SECRET;
  if (configured) return configured;

  try {
    const existing = readFileSync(SECRET_PATH, "utf8").trim();
    if (existing) return existing;
  } catch {
    // First add-on start, or a development environment without /data.
  }

  if (!ephemeralSecret) {
    ephemeralSecret = randomBytes(32).toString("hex");
    try {
      mkdirSync("/data", { recursive: true });
      writeFileSync(SECRET_PATH, ephemeralSecret, {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx",
      });
    } catch {
      // Development can use the process-local secret. Production add-ons have
      // persistent /data, so their unlock sessions survive an app restart.
    }
  }
  return ephemeralSecret;
}

export function getConfiguredStormPrepPin(): string {
  if (process.env.STORM_PREP_PIN) return process.env.STORM_PREP_PIN;
  try {
    const options = JSON.parse(readFileSync(OPTIONS_PATH, "utf8")) as {
      storm_prep_pin?: unknown;
    };
    return typeof options.storm_prep_pin === "string"
      ? options.storm_prep_pin.trim()
      : "";
  } catch {
    return "";
  }
}

export function isStormPrepPinConfigured(): boolean {
  return getConfiguredStormPrepPin().length >= 6;
}

export function verifyStormPrepPin(candidate: unknown): boolean {
  if (typeof candidate !== "string") return false;
  const configured = getConfiguredStormPrepPin();
  if (configured.length < 6) return false;
  const expected = createHash("sha256").update(configured).digest();
  const actual = createHash("sha256").update(candidate).digest();
  return timingSafeEqual(expected, actual);
}

function signature(expiresAt: string): string {
  return createHmac("sha256", sessionSecret())
    .update(expiresAt)
    .digest("base64url");
}

export function createStormPrepSession(now = Date.now()): {
  value: string;
  expiresAt: number;
} {
  const expiresAt = now + SESSION_TTL_MS;
  const serialized = String(expiresAt);
  return {
    value: `${serialized}.${signature(serialized)}`,
    expiresAt,
  };
}

function parseCookies(header: string | undefined): Record<string, string> {
  const values: Record<string, string> = {};
  for (const pair of (header ?? "").split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    const key = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (key) values[key] = decodeURIComponent(value);
  }
  return values;
}

export function stormPrepSessionExpiry(
  cookieHeader: string | undefined,
  now = Date.now(),
): number | undefined {
  const value = parseCookies(cookieHeader)[SESSION_COOKIE];
  if (!value) return undefined;
  const [serialized, suppliedSignature, ...extra] = value.split(".");
  if (!serialized || !suppliedSignature || extra.length > 0) return undefined;
  const expiresAt = Number(serialized);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return undefined;

  const expected = Buffer.from(signature(serialized));
  const supplied = Buffer.from(suppliedSignature);
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    return undefined;
  }
  return expiresAt;
}

export function stormPrepSessionCookie(
  value: string,
): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Secure",
  ]
    .filter(Boolean)
    .join("; ");
}

function entityIds(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function bodyEntityIds(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const record = body as Record<string, unknown>;
  const target =
    record.target && typeof record.target === "object"
      ? (record.target as Record<string, unknown>)
      : {};
  const data =
    record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : {};
  return [
    ...entityIds(record.entity_id),
    ...entityIds(target.entity_id),
    ...entityIds(data.entity_id),
  ];
}

function hasBroadTargetSelector(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  const candidates: Record<string, unknown>[] = [record];
  for (const key of ["target", "data", "service_data"]) {
    const value = record[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      candidates.push(value as Record<string, unknown>);
      const nestedTarget = (value as Record<string, unknown>).target;
      if (
        nestedTarget &&
        typeof nestedTarget === "object" &&
        !Array.isArray(nestedTarget)
      ) {
        candidates.push(nestedTarget as Record<string, unknown>);
      }
    }
  }
  return candidates.some((candidate) =>
    BROAD_TARGET_KEYS.some((key) => {
      const value = candidate[key];
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }),
  );
}

export function potentialStormPrepControlEntityIds(
  path: unknown,
  body: unknown,
): string[] {
  const normalizedPath = apiPathname(path);
  const match = normalizedPath.match(/^\/api\/services\/([^/]+)\/([^/]+)$/);
  if (!match) return [];
  const [, domain, service] = match;
  const potentialWrite =
    (domain === "number" && service === "set_value") ||
    (domain === "select" && service === "select_option") ||
    ((domain === "switch" || domain === "homeassistant") &&
      ["turn_on", "turn_off", "toggle"].includes(service ?? ""));
  return potentialWrite ? bodyEntityIds(body) : [];
}

export function isSensitiveStormPrepCall(
  path: unknown,
  body: unknown,
): boolean {
  const normalizedPath = apiPathname(path);
  if (!normalizedPath) return false;
  if (normalizedPath === "/api/events/mobile_app_notification_action") {
    const record =
      body && typeof body === "object"
        ? (body as Record<string, unknown>)
        : {};
    const nested =
      record.event_data && typeof record.event_data === "object"
        ? (record.event_data as Record<string, unknown>)
        : record;
    return (
      typeof nested.action === "string" &&
      nested.action.startsWith("MAUI_STORM_PREP_")
    );
  }
  const stateMutation = normalizedPath.match(/^\/api\/states\/([^/]+)$/);
  if (stateMutation?.[1] && STORM_PREP_NAMESPACE.test(stateMutation[1])) {
    return true;
  }

  const match = normalizedPath.match(/^\/api\/services\/([^/]+)\/([^/]+)$/);
  if (!match) return false;
  const [, domain, service] = match;

  // Scripts, scenes, and automation.trigger are indirect execution
  // primitives: Home Assistant can hide a battery write inside them, beyond
  // what the proxy can inspect. Keep them behind the homeowner session.
  if (
    INDIRECT_DOMAIN.test(domain ?? "") &&
    (domain !== "automation" || service === "trigger")
  ) {
    return true;
  }
  if (
    domain === "automation" &&
    bodyEntityIds(body).some((id) => STORM_PREP_NAMESPACE.test(id))
  ) {
    return true;
  }
  if (
    domain === "homeassistant" &&
    ["turn_on", "turn_off", "toggle"].includes(service ?? "")
  ) {
    return true;
  }

  if (
    [
      "input_text",
      "input_boolean",
      "input_datetime",
      "input_number",
      "input_select",
      "timer",
    ].includes(domain ?? "") &&
    bodyEntityIds(body).some((id) => STORM_PREP_NAMESPACE.test(id))
  ) {
    return true;
  }

  const writeService =
    (domain === "number" && service === "set_value") ||
    (domain === "select" && service === "select_option") ||
    ((domain === "switch" || domain === "homeassistant") &&
      ["turn_on", "turn_off", "toggle"].includes(service ?? ""));
  if (!writeService) return false;

  // Actual number/select entities are uncommon on this kiosk (its settings use
  // input_number/input_select) and can represent operating modes whose entity
  // IDs contain no vendor/battery words. Conservatively protect all writes.
  if (domain === "number" || domain === "select") return true;

  const ids = bodyEntityIds(body);
  if (domain === "switch") {
    // Direct LAN control remains available for the lighting-name switches this
    // kiosk intentionally treats as lights. Every other switch write is
    // privileged, eliminating unknown/generic battery-control IDs.
    return (
      ids.length === 0 ||
      hasBroadTargetSelector(body) ||
      ids.some(
        (id) =>
          BATTERY_CONTROL_ENTITY.test(id) ||
          !LIGHTING_SWITCH_ENTITY.test(id),
      )
    );
  }

  return ids.some(
    (id) =>
      BATTERY_CONTROL_ENTITY.test(id) ||
      STORM_PREP_NAMESPACE.test(id),
  );
}

export function isSensitiveStormPrepWsCommand(command: unknown): boolean {
  if (!command || typeof command !== "object") return false;
  const record = command as Record<string, unknown>;
  if (record.type === "fire_event") {
    const eventData =
      record.event_data && typeof record.event_data === "object"
        ? (record.event_data as Record<string, unknown>)
        : {};
    return (
      record.event_type === "mobile_app_notification_action" &&
      typeof eventData.action === "string" &&
      eventData.action.startsWith("MAUI_STORM_PREP_")
    );
  }
  if (record.type !== "call_service") return false;
  const domain =
    typeof record.domain === "string" ? record.domain : "";
  const service =
    typeof record.service === "string" ? record.service : "";
  const serviceData =
    record.service_data && typeof record.service_data === "object"
      ? (record.service_data as Record<string, unknown>)
      : {};
  const target =
    record.target && typeof record.target === "object"
      ? (record.target as Record<string, unknown>)
      : {};
  return isSensitiveStormPrepCall(`/api/services/${domain}/${service}`, {
    data: serviceData,
    target,
  });
}

export function potentialStormPrepWsControlEntityIds(
  command: unknown,
): string[] {
  if (!command || typeof command !== "object") return [];
  const record = command as Record<string, unknown>;
  if (record.type !== "call_service") return [];
  const domain =
    typeof record.domain === "string" ? record.domain : "";
  const service =
    typeof record.service === "string" ? record.service : "";
  return potentialStormPrepControlEntityIds(
    `/api/services/${domain}/${service}`,
    {
      data: record.service_data,
      target: record.target,
    },
  );
}
