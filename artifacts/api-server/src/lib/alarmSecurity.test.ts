import assert from "node:assert/strict";
import test from "node:test";
import {
  AlarmAttemptLimiter, alarmServiceAccessError, isAlarmServicePath, isAlarmWsCommand,
} from "./alarmSecurity.ts";

const path = "/api/services/alarm_control_panel/alarm_disarm";
const body = { entity_id: "alarm_control_panel.test", code: "1234" };

test("alarm actions require secure transport, including direct HTTP", () => {
  assert.equal(alarmServiceAccessError(path, "POST", body, false)?.status, 426);
  assert.equal(alarmServiceAccessError(path, "POST", body, true), undefined);
});
test("only supported actions with an exact panel and nonempty code pass", () => {
  for (const service of ["alarm_arm_home", "alarm_arm_away", "alarm_arm_night", "alarm_disarm"]) {
    assert.equal(alarmServiceAccessError(`/api/services/alarm_control_panel/${service}`, "POST", body, true), undefined);
  }
  for (const invalid of [
    {}, { ...body, code: "" }, { ...body, code: 1234 },
    { ...body, entity_id: ["alarm_control_panel.test"] },
    { ...body, entity_id: "all" }, { ...body, entity_id: "light.test" },
    { ...body, area_id: "garage" }, { ...body, device_id: "other" },
    { ...body, target: { entity_id: "alarm_control_panel.other" } },
  ]) assert.equal(alarmServiceAccessError(path, "POST", invalid, true)?.status, 400);
  assert.equal(alarmServiceAccessError(path, "GET", body, true)?.status, 400);
  assert.equal(alarmServiceAccessError(path.replace("alarm_disarm", "alarm_trigger"), "POST", body, true)?.status, 400);
});
test("encoded/noncanonical alarm service paths cannot evade the guard", () => {
  for (const candidate of [
    "/api/services/%61larm_control_panel/alarm_disarm",
    "/api/states/../services/alarm_control_panel/alarm_disarm",
    `${path}?return_response`, `${path}/`, path.toUpperCase(),
  ]) {
    assert.equal(isAlarmServicePath(candidate), true);
    assert.ok(alarmServiceAccessError(candidate, "POST", body, true));
  }
  assert.equal(alarmServiceAccessError("/api/states", "GET", undefined, false), undefined);
  assert.equal(alarmServiceAccessError("/api/services/light/turn_on", "POST", {}, false), undefined);
});
test("WebSocket alarm calls are detected independently of selectors", () => {
  assert.equal(isAlarmWsCommand({ type: "call_service", domain: "alarm_control_panel", service: "alarm_disarm" }), true);
  assert.equal(isAlarmWsCommand({ type: "get_states" }), false);
});
test("alarm attempts are bounded and reset after one minute", () => {
  const limiter = new AlarmAttemptLimiter();
  for (let i = 0; i < 5; i++) assert.equal(limiter.allow("client:panel", 0), true);
  assert.equal(limiter.allow("client:panel", 1), false);
  assert.equal(limiter.allow("client:other-panel", 1), true);
  assert.equal(limiter.allow("client:panel", 60_000), true);
});
