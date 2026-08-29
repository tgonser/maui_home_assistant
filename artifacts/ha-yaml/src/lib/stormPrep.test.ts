import test from "node:test";
import assert from "node:assert/strict";
import { getCandidateBatteryControls, getStormPrepStatus, getStormPrepSettings, hasCompleteStormPrepDualHelperSet, stormPrepActionsAvailable, validateControlTarget, type HAState } from "./stormPrep.ts";

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
      // Allowed Maui 4680 systems, whose friendly names omit "battery"
      {
        entity_id: "number.4680_system_2_backup_reserve",
        state: "10",
        attributes: { friendly_name: "Backup reserve", unit_of_measurement: "%" },
      },
      {
        entity_id: "number.gonser_4680_system_1_backup_reserve",
        state: "10",
        attributes: { friendly_name: "Backup reserve", unit_of_measurement: "%" },
      },
      // Excluded due to device battery
      { entity_id: "sensor.ipad_battery_level", state: "100", attributes: {} },
      // Excluded domains
      { entity_id: "sensor.powerwall_backup_reserve", state: "20", attributes: {} },
      { entity_id: "input_number.battery_reserve", state: "20", attributes: {} },
    ] as any as HAState[];

    const candidates = getCandidateBatteryControls(states);
    assert.equal(candidates.length, 6);
    assert.ok(candidates.find(c => c.entity_id === "switch.powerwall_storm_watch"));
    assert.ok(candidates.find(c => c.entity_id === "select.powerwall_operation_mode"));
    assert.ok(candidates.find(c => c.entity_id === "number.enphase_backup_reserve"));
    assert.ok(candidates.find(c => c.entity_id === "number.tesla_powerwall_backup_reserve"));
    assert.ok(candidates.find(c => c.entity_id === "number.4680_system_2_backup_reserve"));
    assert.ok(candidates.find(c => c.entity_id === "number.gonser_4680_system_1_backup_reserve"));
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
           control_entity_2: "select.enphase_mode",
           target_value: "100",
           target_value_2: "Backup",
           current_value: "20",
           current_value_2: "Self Consumption",
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
    assert.equal(status.controlEntityId2, "select.enphase_mode");
    assert.equal(status.targetValue, "100");
    assert.equal(status.targetValue2, "Backup");
    assert.equal(status.currentValue, "20");
    assert.equal(status.currentValue2, "Self Consumption");
  });

  await t.test("getStormPrepSettings reads both battery banks", () => {
    const values = {
      "input_text.maui_storm_prep_control_entity": "number.bank_1_backup_reserve",
      "input_text.maui_storm_prep_verified_control": "number.bank_1_backup_reserve",
      "input_text.maui_storm_prep_control_value": "100",
      "input_text.maui_storm_prep_control_entity_2": "select.bank_2_operation_mode",
      "input_text.maui_storm_prep_verified_control_2": "select.bank_2_operation_mode",
      "input_text.maui_storm_prep_control_value_2": "Backup",
    };
    const states = Object.entries(values).map(([entity_id, state]) => ({
      entity_id,
      state,
      attributes: {},
    })) as HAState[];
    const settings = getStormPrepSettings(states);
    assert.equal(settings.controlEntity, "number.bank_1_backup_reserve");
    assert.equal(settings.controlEntity2, "select.bank_2_operation_mode");
    assert.equal(settings.verifiedControl2, "select.bank_2_operation_mode");
    assert.equal(settings.controlValue2, "Backup");
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

  await t.test("getStormPrepSettings reads both exact control pairs", () => {
    const states = [
      { entity_id: "input_text.maui_storm_prep_control_entity", state: "number.bank_1_backup_reserve", attributes: {} },
      { entity_id: "input_text.maui_storm_prep_control_value", state: "80", attributes: {} },
      { entity_id: "input_text.maui_storm_prep_control_entity_2", state: "number.bank_2_backup_reserve", attributes: {} },
      { entity_id: "input_text.maui_storm_prep_verified_control_2", state: "number.bank_2_backup_reserve", attributes: {} },
      { entity_id: "input_text.maui_storm_prep_control_value_2", state: "90", attributes: {} },
    ] as HAState[];
    const settings = getStormPrepSettings(states);
    assert.equal(settings.controlEntity2, "number.bank_2_backup_reserve");
    assert.equal(settings.verifiedControl2, "number.bank_2_backup_reserve");
    assert.equal(settings.controlValue2, "90");
  });

  await t.test("legacy one-bank states cannot expose storm-prep actions", () => {
    const legacy = [
      { entity_id: "input_text.maui_storm_prep_weather_entity", state: "weather.home", attributes: {} },
      { entity_id: "input_text.maui_storm_prep_control_entity", state: "number.bank_1_backup_reserve", attributes: {} },
    ] as HAState[];
    assert.equal(hasCompleteStormPrepDualHelperSet(legacy), false);
    assert.equal(stormPrepActionsAvailable(legacy), false);
  });

  await t.test("complete dual helper set enables the reviewed action surface", () => {
    const helpers = [
      "input_text.maui_storm_prep_control_entity_2",
      "input_text.maui_storm_prep_verified_control_2",
      "input_text.maui_storm_prep_control_value_2",
      "input_text.maui_storm_prep_requested_control_2",
      "input_text.maui_storm_prep_requested_value_2",
      "input_text.maui_storm_prep_requested_domain_2",
      "input_text.maui_storm_prep_previous_entity_2",
      "input_text.maui_storm_prep_previous_value_2",
    ].map((entity_id) => ({ entity_id, state: "", attributes: {} })) as HAState[];
    assert.equal(hasCompleteStormPrepDualHelperSet(helpers), true);
    assert.equal(stormPrepActionsAvailable(helpers), true);
  });
});