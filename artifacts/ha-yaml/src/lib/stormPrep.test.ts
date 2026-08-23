import test from "node:test";
import assert from "node:assert/strict";
import { getCandidateBatteryControls, getStormPrepStatus, getStormPrepSettings, validateControlTarget, type HAState } from "./stormPrep.ts";

test("stormPrep", async (t) => {
  await t.test("getCandidateBatteryControls filters correctly", () => {
    const states = [
      { entity_id: "switch.powerwall_storm_watch", state: "off", attributes: {} },
      { entity_id: "select.powerwall_operation_mode", state: "backup", attributes: {} },
      { entity_id: "number.enphase_backup_reserve", state: "30", attributes: {} },
      // Excluded due to EV charging/tesla ev
      { entity_id: "switch.tesla_ev_charging", state: "off", attributes: {} },
      // Allowed Tesla Powerwall
      { entity_id: "number.tesla_powerwall_backup_reserve", state: "20", attributes: {} },
      // Excluded due to device battery
      { entity_id: "sensor.ipad_battery_level", state: "100", attributes: {} },
      // Excluded domains
      { entity_id: "sensor.powerwall_backup_reserve", state: "20", attributes: {} },
      { entity_id: "input_number.battery_reserve", state: "20", attributes: {} },
    ] as any as HAState[];

    const candidates = getCandidateBatteryControls(states);
    assert.equal(candidates.length, 4);
    assert.ok(candidates.find(c => c.entity_id === "switch.powerwall_storm_watch"));
    assert.ok(candidates.find(c => c.entity_id === "select.powerwall_operation_mode"));
    assert.ok(candidates.find(c => c.entity_id === "number.enphase_backup_reserve"));
    assert.ok(candidates.find(c => c.entity_id === "number.tesla_powerwall_backup_reserve"));
  });

  await t.test("getStormPrepStatus parses correctly with new tokens", () => {
    const states = [
      { entity_id: "binary_sensor.maui_storm_prep_risk", state: "on", attributes: {} },
      { 
        entity_id: "sensor.maui_storm_prep_status", 
        state: "Pending Approval", 
        attributes: {
          reason: "High Rain",
          forecast_window: "Next 24h",
          proposed_action: "Set Reserve 100%",
          control_entity: "number.powerwall_reserve",
          config_valid: true,
          last_result: "Failure",
          review_at: "2023-10-01T12:00:00Z",
          trigger_source: "weather",
          recovery_required: "true",
          restore_failed: true,
          approval_token: "xyz123",
          approval_expires_at: "2023-10-01T10:00:00Z",
          approval_valid: true,
        } 
      },
      { entity_id: "input_boolean.maui_storm_prep_pending", state: "on", attributes: {} },
      { entity_id: "input_boolean.maui_storm_prep_active", state: "off", attributes: {} },
    ] as any as HAState[];

    const status = getStormPrepStatus(states);
    assert.equal(status.active, false);
    assert.equal(status.pending, true);
    assert.equal(status.recoveryRequired, true);
    assert.equal(status.recoveryFailed, true);
    assert.equal(status.approvalToken, "xyz123");
    assert.equal(status.approvalExpiresAt, "2023-10-01T10:00:00Z");
    assert.equal(status.approvalValid, true);
  });

  await t.test("validateControlTarget works", () => {
    const numEntity = {
      entity_id: "number.reserve",
      attributes: { min: 0, max: 100, unit_of_measurement: "%" },
    } as any as HAState;
    assert.equal(validateControlTarget(numEntity, "50").valid, true);
    assert.equal(validateControlTarget(numEntity, "150").valid, false);
    assert.equal(validateControlTarget(numEntity, "abc").valid, false);

    const selEntity = { entity_id: "select.mode", attributes: { options: ["backup", "self_consumption"] } } as any as HAState;
    assert.equal(validateControlTarget(selEntity, "backup").valid, true);
    assert.equal(validateControlTarget(selEntity, "off_grid").valid, false);

    const swEntity = { entity_id: "switch.storm", attributes: {} } as any as HAState;
    assert.equal(validateControlTarget(swEntity, "on").valid, true);
    assert.equal(validateControlTarget(swEntity, "Off").valid, false);
    assert.equal(validateControlTarget(swEntity, "toggle").valid, false);

    const wattsEntity = {
      entity_id: "number.reserve",
      attributes: { min: 0, max: 100, unit_of_measurement: "W" },
    } as any as HAState;
    assert.equal(validateControlTarget(wattsEntity, "50").valid, false);
  });
});