import { test } from "node:test";
import assert from "node:assert/strict";
import {
  discoverAlarmSystems, companionHealth, zoneBadges, filterZones, availableActions,
  writeGuard, activeIssues, pruneAcks, parseAcks, keypadInfo, validCode, alarmOwnedIds,
  type AlarmEntity,
} from "./alarm.ts";

const e = (entity_id: string, state: string, attributes: Record<string, unknown> = {}, t = "2024-01-01T00:00:00Z"): AlarmEntity =>
  ({ entity_id, state, attributes, last_changed: t, last_updated: t });

const states: AlarmEntity[] = [
  e("alarm_control_panel.makena_alarm_partition_1", "disarmed", { supported_features: 15, code_format: "number", code_arm_required: true }),
  e("alarm_control_panel.other_alarm_partition_1", "disarmed", { supported_features: 3 }),
  e("binary_sensor.makena_alarm_zone_18", "on", { zone: 18, partition: 1, friendly_name: "Zone 18" }),
  e("binary_sensor.makena_alarm_zone_2", "off", { zone: 2, partition: 1, bypassed: true, fault: true }),
  e("binary_sensor.makena_alarm_zone_10", "unavailable", { zone: 10, partition: 1 }),
  e("binary_sensor.makena_alarm_zone_5", "off", { zone: 5, partition: 2 }),
  e("binary_sensor.other_alarm_zone_1", "off", { zone: 1, partition: 1 }),
  e("binary_sensor.makena_alarm_partition_1_ac_power", "on"),
  e("binary_sensor.makena_alarm_partition_1_panel_battery", "unknown"),
  e("binary_sensor.makena_alarm_partition_1_panel_health", "off"),
  e("sensor.makena_alarm_partition_1_keypad", "x", { alpha: "FAULT18 LIVING ROOM DOOR ", ac_trouble: false, bat_trouble: true }),
];

test("discovers per stem+partition without merging households", () => {
  const sys = discoverAlarmSystems(states);
  assert.equal(sys.length, 2);
  const mk = sys.find((s) => s.stem === "makena_alarm")!;
  assert.deepEqual(mk.zones.map((z) => z.zone), [2, 10, 18]);
  assert.ok(mk.keypad);
  assert.equal(sys.find((s) => s.stem === "other_alarm")!.zones.length, 1);
  assert.ok(alarmOwnedIds(sys).has("binary_sensor.makena_alarm_zone_18"));
  assert.ok(!alarmOwnedIds(sys).has("binary_sensor.makena_alarm_zone_5"));
});

test("health semantics: unknown never green", () => {
  assert.equal(companionHealth("ac_power", e("x", "on")).tone, "ok");
  assert.equal(companionHealth("ac_power", e("x", "off")).tone, "alert");
  assert.equal(companionHealth("panel_battery", e("x", "off")).tone, "ok");
  assert.equal(companionHealth("panel_health", e("x", "on")).issue, true);
  assert.equal(companionHealth("panel_battery", e("x", "unknown")).tone, "unknown");
  assert.equal(companionHealth("fire", undefined).tone, "unknown");
});

test("zone badges show multiple flags; unavailable is not closed", () => {
  const mk = discoverAlarmSystems(states)[0];
  const z2 = mk.zones.find((z) => z.zone === 2)!;
  assert.deepEqual(zoneBadges(z2).map((b) => b.kind), ["fault", "bypassed"]);
  const z10 = mk.zones.find((z) => z.zone === 10)!;
  assert.ok(!zoneBadges(z10).some((b) => b.kind === "closed"));
  assert.deepEqual(filterZones(mk.zones, "open", "").map((z) => z.zone), [18]);
  assert.deepEqual(filterZones(mk.zones, "issues", "").map((z) => z.zone), [2, 10]);
  assert.deepEqual(filterZones(mk.zones, "bypassed", "").map((z) => z.zone), [2]);
  assert.deepEqual(filterZones(mk.zones, "all", "18").map((z) => z.zone), [18]);
});

test("keypad info and actions", () => {
  const k = keypadInfo(discoverAlarmSystems(states)[0].keypad);
  assert.equal(k.text, "FAULT18 LIVING ROOM DOOR");
  assert.deepEqual(k.troubles, ["bat trouble"]);
  assert.deepEqual(availableActions(states[0]).map((a) => a.service), ["alarm_arm_home", "alarm_arm_away", "alarm_arm_night", "alarm_disarm"]);
  assert.deepEqual(availableActions(states[1]).map((a) => a.service), ["alarm_arm_home", "alarm_arm_away", "alarm_disarm"]);
  assert.ok(validCode("1234", "number"));
  assert.ok(!validCode("12a4", "number"));
  assert.ok(!validCode("12", "number"));
});

test("write guard blocks insecure, offline, stale, unknown", () => {
  const base = { secureTransport: true, connected: true, lastOkMs: 1000, nowMs: 2000, panelState: "disarmed" };
  assert.equal(writeGuard(base).blocked, false);
  assert.ok(writeGuard({ ...base, secureTransport: false }).blocked);
  assert.ok(writeGuard({ ...base, secureTransport: null }).blocked);
  assert.ok(writeGuard({ ...base, connected: false }).blocked);
  assert.ok(writeGuard({ ...base, nowMs: 60_000 }).blocked);
  assert.ok(writeGuard({ ...base, panelState: "unavailable" }).blocked);
});

test("acks are episode-scoped and pruned when resolved or changed", () => {
  const sys = discoverAlarmSystems(states)[0];
  const issues = activeIssues(sys);
  assert.ok(issues.some((i) => i.kind === "panel_battery"));
  const id = issues[0].id;
  const acks = { [id]: 1, "gone|fault|t": 2 };
  assert.deepEqual(Object.keys(pruneAcks(acks, issues)), [id]);
  const changed = activeIssues(discoverAlarmSystems(states.map((s) =>
    s.entity_id === issues[0].entityId ? { ...s, last_changed: "2024-02-01T00:00:00Z", last_updated: "2024-02-01T00:00:00Z" } : s))[0]);
  assert.deepEqual(pruneAcks(acks, changed), {});
  assert.deepEqual(parseAcks("bad"), {});
});

test("keypad-only trouble and bypassed zones remain actionable issues", () => {
  const issues = activeIssues(discoverAlarmSystems(states)[0]);
  assert.ok(issues.some(i => i.kind === "keypad" && i.detail === "bat trouble"));
  assert.ok(issues.some(i => i.kind === "bypassed"));
});
