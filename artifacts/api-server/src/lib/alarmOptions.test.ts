import assert from "node:assert/strict";
import test from "node:test";
import { parseAlarmOptions, alarmBodyWithStoredCode } from "./alarmOptions.ts";
import { alarmServiceAccessError } from "./alarmSecurity.ts";

const entity = "alarm_control_panel.test";
const options = parseAlarmOptions({ alarm_pin_free: true, alarm_panel_entity_id: entity, alarm_code: "1234" });
test("PIN-free is explicit opt-in with a valid exact panel and configured code", () => {
  assert.equal(options.enabled, true);
  for (const value of [null, {}, {alarm_pin_free:true}, {alarm_pin_free:false,alarm_panel_entity_id:entity,alarm_code:"1234"},
    {alarm_pin_free:true,alarm_panel_entity_id:"all",alarm_code:"1234"}]) {
    assert.equal(parseAlarmOptions(value).enabled, false);
  }
});
test("server code is injected only for the configured panel on the Supervisor connection", () => {
  assert.deepEqual(alarmBodyWithStoredCode({entity_id:entity}, "__supervisor__", options, true), {entity_id:entity,code:"1234"});
  for (const url of ["https://attacker.invalid", "http://supervisor/core"]) {
    assert.deepEqual(alarmBodyWithStoredCode({entity_id:entity}, url, options, true), {entity_id:entity});
  }
  for (const body of [{entity_id:"alarm_control_panel.other"}, {entity_id:[entity]}, {entity_id:entity,area_id:"room"}, {entity_id:entity,code:"9999"}]) {
    assert.deepEqual(alarmBodyWithStoredCode(body, "__supervisor__", options, true), body);
  }
  assert.deepEqual(alarmBodyWithStoredCode({entity_id:entity}, "__supervisor__", options, false), {entity_id:entity});
});
test("saved code does not bypass HTTPS, action or target restrictions", () => {
  const data = alarmBodyWithStoredCode({entity_id:entity}, "__supervisor__", options, true);
  assert.equal(alarmServiceAccessError("/api/services/alarm_control_panel/alarm_disarm", "POST", data, false)?.status,426);
  assert.equal(alarmServiceAccessError("/api/services/alarm_control_panel/alarm_trigger", "POST", data, true)?.status,400);
  assert.equal(alarmServiceAccessError("/api/services/alarm_control_panel/alarm_disarm", "POST", data, true),undefined);
});
