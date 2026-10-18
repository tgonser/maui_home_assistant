// Pure model for Envisalink-style alarm panels on the wall.
// No React, no network: discovery, health semantics, zone flags, filtering,
// and local (this-wall-only) acknowledgement bookkeeping.

export type AlarmEntity = {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
};

export type Tone = "ok" | "warn" | "alert" | "unknown" | "neutral";

export const isUnknownState = (s: string | undefined | null) =>
  s === undefined || s === null || s === "" || s === "unknown" || s === "unavailable";

// ── Discovery ────────────────────────────────────────────────────────────────

export type AlarmZone = {
  entity: AlarmEntity;
  zone: number;
  name: string;
  unknown: boolean;
  open: boolean;
  fault: boolean;
  alarm: boolean;
  tamper: boolean;
  lowBattery: boolean;
  bypassed: boolean;
  lastTrip: string | null;
};

export type CompanionKey = "ready" | "ac_power" | "panel_battery" | "panel_health" | "fire" | "alarm";
export const COMPANION_KEYS: CompanionKey[] = ["ready", "ac_power", "panel_battery", "panel_health", "fire", "alarm"];

export type AlarmSystem = {
  panel: AlarmEntity;
  stem: string;
  partition: number;
  companions: Partial<Record<CompanionKey, AlarmEntity>>;
  keypad: AlarmEntity | null;
  zones: AlarmZone[];
};

const PANEL_RE = /^alarm_control_panel\.(.+)_partition_(\d+)$/;
const ZONE_RE = /^binary_sensor\.(.+)_zone_(\d+)$/;

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const flag = (v: unknown) => v === true || v === "on" || v === "true" || v === 1;

export function zoneFromEntity(e: AlarmEntity, zoneNo: number): AlarmZone {
  const a = e.attributes;
  const unknown = isUnknownState(e.state);
  const lt = a.last_tripped_time ?? a.last_tripped ?? null;
  return {
    entity: e,
    zone: num(a.zone) ?? zoneNo,
    name: (a.friendly_name as string | undefined) ?? `Zone ${zoneNo}`,
    unknown,
    open: !unknown && (e.state === "on" || flag(a.open)),
    fault: flag(a.fault),
    alarm: flag(a.alarm),
    tamper: flag(a.tamper),
    lowBattery: flag(a.low_battery),
    bypassed: flag(a.bypassed),
    lastTrip: typeof lt === "string" || typeof lt === "number" ? String(lt) : null,
  };
}

/** Panels keyed by stem + partition. Zones join only when their stem matches
 * AND their numeric `partition` attribute equals the panel partition. */
export function discoverAlarmSystems(states: AlarmEntity[]): AlarmSystem[] {
  const byId = new Map(states.map((s) => [s.entity_id, s]));
  const out: AlarmSystem[] = [];
  for (const s of states) {
    const m = PANEL_RE.exec(s.entity_id);
    if (!m) continue;
    const stem = m[1];
    const partition = Number(m[2]);
    const obj = s.entity_id.split(".")[1];
    const companions: AlarmSystem["companions"] = {};
    for (const k of COMPANION_KEYS) {
      const c = byId.get(`binary_sensor.${obj}_${k}`);
      if (c) companions[k] = c;
    }
    const zones: AlarmZone[] = [];
    for (const z of states) {
      const zm = ZONE_RE.exec(z.entity_id);
      if (!zm || zm[1] !== stem) continue;
      if (num(z.attributes.partition) !== partition) continue;
      zones.push(zoneFromEntity(z, Number(zm[2])));
    }
    zones.sort((a, b) => a.zone - b.zone || a.entity.entity_id.localeCompare(b.entity.entity_id));
    out.push({ panel: s, stem, partition, companions, keypad: byId.get(`sensor.${obj}_keypad`) ?? null, zones });
  }
  return out.sort((a, b) => a.stem.localeCompare(b.stem) || a.partition - b.partition);
}

/** Every entity id owned by discovered alarm systems (to avoid duplicating
 * them in the generic door/motion lists). */
export function alarmOwnedIds(systems: AlarmSystem[]): Set<string> {
  const ids = new Set<string>();
  for (const s of systems) {
    ids.add(s.panel.entity_id);
    for (const c of Object.values(s.companions)) if (c) ids.add(c.entity_id);
    if (s.keypad) ids.add(s.keypad.entity_id);
    for (const z of s.zones) ids.add(z.entity.entity_id);
  }
  return ids;
}

// ── Health semantics ─────────────────────────────────────────────────────────

export type Health = { key: CompanionKey; label: string; value: string; tone: Tone; issue: boolean; entity: AlarmEntity | null };

export function companionHealth(key: CompanionKey, e: AlarmEntity | undefined): Health {
  const labels: Record<CompanionKey, string> = {
    ready: "Ready", ac_power: "AC power", panel_battery: "Panel battery",
    panel_health: "Panel health", fire: "Fire", alarm: "Alarm",
  };
  const label = labels[key];
  if (!e) return { key, label, value: "Not found", tone: "unknown", issue: false, entity: null };
  if (isUnknownState(e.state)) return { key, label, value: e.state || "unknown", tone: "unknown", issue: true, entity: e };
  const on = e.state === "on";
  switch (key) {
    case "ready": return { key, label, value: on ? "Ready" : "Not ready", tone: on ? "ok" : "warn", issue: false, entity: e };
    case "ac_power": return { key, label, value: on ? "On" : "Lost", tone: on ? "ok" : "alert", issue: !on, entity: e };
    case "panel_battery": return { key, label, value: on ? "Low / trouble" : "OK", tone: on ? "warn" : "ok", issue: on, entity: e };
    case "panel_health": return { key, label, value: on ? "Trouble" : "OK", tone: on ? "warn" : "ok", issue: on, entity: e };
    case "fire": return { key, label, value: on ? "FIRE" : "Clear", tone: on ? "alert" : "ok", issue: on, entity: e };
    case "alarm": return { key, label, value: on ? "ALARM" : "Clear", tone: on ? "alert" : "ok", issue: on, entity: e };
  }
}

export function panelTone(state: string): Tone {
  if (isUnknownState(state)) return "unknown";
  if (state === "triggered") return "alert";
  if (state.startsWith("armed")) return "warn";
  if (state === "disarmed") return "ok";
  return "neutral";
}

export const prettyState = (s: string) =>
  isUnknownState(s) ? (s || "unknown") : s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export type KeypadInfo = { text: string | null; troubles: string[] };
export function keypadInfo(e: AlarmEntity | null): KeypadInfo {
  if (!e) return { text: null, troubles: [] };
  const a = e.attributes;
  const alpha = typeof a.alpha === "string" ? a.alpha : !isUnknownState(e.state) ? e.state : null;
  const troubles: string[] = [];
  const skip = new Set(["alpha", "friendly_name", "icon", "device_class", "unit_of_measurement"]);
  for (const [k, v] of Object.entries(a)) {
    if (skip.has(k)) continue;
    if (/trouble|fault|low_battery|ac_present|bat_trouble|alarm_in_memory|fire/.test(k)) {
      // ac_present is good when true; everything else is a trouble when true.
      if (k === "ac_present" ? v === false : v === true) troubles.push(k.replace(/_/g, " "));
    }
  }
  return { text: alpha?.trim() || null, troubles };
}

// ── Zones ────────────────────────────────────────────────────────────────────

export type ZoneBadge = { kind: string; label: string; tone: Tone };
export function zoneBadges(z: AlarmZone): ZoneBadge[] {
  const b: ZoneBadge[] = [];
  if (z.unknown) b.push({ kind: "unknown", label: z.entity.state || "unknown", tone: "unknown" });
  if (z.alarm) b.push({ kind: "alarm", label: "Alarm", tone: "alert" });
  if (z.tamper) b.push({ kind: "tamper", label: "Tamper", tone: "alert" });
  if (z.fault) b.push({ kind: "fault", label: "Fault", tone: "warn" });
  if (z.lowBattery) b.push({ kind: "low_battery", label: "Low battery", tone: "warn" });
  if (z.open) b.push({ kind: "open", label: "Open", tone: "warn" });
  if (z.bypassed) b.push({ kind: "bypassed", label: "Bypassed · not protected", tone: "warn" });
  if (b.length === 0) b.push({ kind: "closed", label: "Closed", tone: "ok" });
  return b;
}
export const ISSUE_KINDS = new Set(["unknown", "alarm", "tamper", "fault", "low_battery", "bypassed"]);
export const zoneIssues = (z: AlarmZone) => zoneBadges(z).filter((b) => ISSUE_KINDS.has(b.kind));

export type ZoneFilter = "all" | "open" | "issues" | "bypassed";
export function filterZones(zones: AlarmZone[], filter: ZoneFilter, query: string): AlarmZone[] {
  const q = query.trim().toLowerCase();
  return zones.filter((z) => {
    if (filter === "open" && !z.open) return false;
    if (filter === "issues" && zoneIssues(z).length === 0) return false;
    if (filter === "bypassed" && !z.bypassed) return false;
    if (!q) return true;
    return (
      String(z.zone) === q.replace(/^zone\s*/, "") ||
      z.name.toLowerCase().includes(q) ||
      z.entity.entity_id.toLowerCase().includes(q)
    );
  });
}

// ── Actions ──────────────────────────────────────────────────────────────────

export type AlarmService = "alarm_arm_home" | "alarm_arm_away" | "alarm_arm_night" | "alarm_disarm";
export type AlarmAction = { service: AlarmService; label: string; expect: string };
export const ALL_ACTIONS: Record<AlarmService, AlarmAction> = {
  alarm_arm_home: { service: "alarm_arm_home", label: "Arm Stay", expect: "armed_home" },
  alarm_arm_away: { service: "alarm_arm_away", label: "Arm Away", expect: "armed_away" },
  alarm_arm_night: { service: "alarm_arm_night", label: "Arm Night", expect: "armed_night" },
  alarm_disarm: { service: "alarm_disarm", label: "Disarm", expect: "disarmed" },
};

/** Only features the panel actually exposes. Disarm is always offered. */
export function availableActions(panel: AlarmEntity): AlarmAction[] {
  const f = Number(panel.attributes.supported_features ?? 0) | 0;
  const out: AlarmAction[] = [];
  if (f & 1) out.push(ALL_ACTIONS.alarm_arm_home);
  if (f & 2) out.push(ALL_ACTIONS.alarm_arm_away);
  if (f & 4) out.push(ALL_ACTIONS.alarm_arm_night);
  out.push(ALL_ACTIONS.alarm_disarm);
  return out;
}

export function validCode(code: string, format: unknown): boolean {
  if (code.length < 4 || code.length > 12) return false;
  return format === "number" ? /^\d+$/.test(code) : true;
}

export type WriteBlock = { blocked: boolean; reason: string | null };
export function writeGuard(o: {
  secureTransport: boolean | null; connected: boolean; lastOkMs: number | null; nowMs: number;
  panelState: string; staleAfterMs?: number;
}): WriteBlock {
  if (o.secureTransport === null) return { blocked: true, reason: "Checking secure connection…" };
  if (!o.secureTransport) return { blocked: true, reason: "Alarm codes can only be entered over a secure (HTTPS) connection." };
  if (!o.connected) return { blocked: true, reason: "Wall is offline from Home Assistant." };
  if (o.lastOkMs === null || o.nowMs - o.lastOkMs > (o.staleAfterMs ?? 20_000))
    return { blocked: true, reason: "Alarm state is stale — waiting for a fresh update." };
  if (isUnknownState(o.panelState)) return { blocked: true, reason: "Panel state is unknown or unavailable." };
  return { blocked: false, reason: null };
}

// ── Local acknowledgements (this wall only) ──────────────────────────────────

export type ActiveIssue = { id: string; entityId: string; kind: string; label: string; detail: string; tone: Tone; since: string };

export function activeIssues(sys: AlarmSystem): ActiveIssue[] {
  const out: ActiveIssue[] = [];
  if (sys.panel.state === "triggered" || isUnknownState(sys.panel.state)) {
    out.push({
      id: `${sys.panel.entity_id}|state|${sys.panel.last_changed}`,
      entityId: sys.panel.entity_id, kind: "panel",
      label: "Alarm panel", detail: prettyState(sys.panel.state),
      tone: panelTone(sys.panel.state), since: sys.panel.last_changed,
    });
  }
  if (sys.keypad) {
    for (const trouble of keypadInfo(sys.keypad).troubles) {
      out.push({
        id: `${sys.keypad.entity_id}|${trouble}|${sys.keypad.last_updated}`,
        entityId: sys.keypad.entity_id, kind: "keypad",
        label: "Keypad", detail: trouble,
        tone: /fire|alarm/.test(trouble) ? "alert" : "warn",
        since: sys.keypad.last_updated,
      });
    }
  }
  for (const k of COMPANION_KEYS) {
    const h = companionHealth(k, sys.companions[k]);
    if (h.issue && h.entity) {
      out.push({ id: `${h.entity.entity_id}|${k}|${h.entity.last_changed}`, entityId: h.entity.entity_id, kind: k, label: h.label, detail: h.value, tone: h.tone, since: h.entity.last_changed });
    }
  }
  for (const z of sys.zones) {
    for (const b of zoneIssues(z)) {
      out.push({ id: `${z.entity.entity_id}|${b.kind}|${z.entity.last_updated}`, entityId: z.entity.entity_id, kind: b.kind, label: `Zone ${z.zone}`, detail: b.label, tone: b.tone, since: z.entity.last_updated });
    }
  }
  return out;
}

export type AckMap = Record<string, number>;
export const ackStorageKey = (connection: string) => `ha-yaml:alarm-acks:${connection || "default"}`;

export function parseAcks(raw: string | null): AckMap {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: AckMap = {};
    for (const [k, t] of Object.entries(v)) if (typeof t === "number") out[k] = t;
    return out;
  } catch {
    return {};
  }
}

/** Drop acks whose episode is no longer active (so a recurrence reappears). */
export function pruneAcks(acks: AckMap, active: ActiveIssue[]): AckMap {
  const live = new Set(active.map((i) => i.id));
  const out: AckMap = {};
  for (const [k, t] of Object.entries(acks)) if (live.has(k)) out[k] = t;
  return out;
}
