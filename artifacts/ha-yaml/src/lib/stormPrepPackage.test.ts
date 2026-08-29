import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";

const source = readFileSync(
  resolve(process.cwd(), "../../ha-config/maui_storm_prep_package.yaml"),
  "utf8",
);
const packageConfig = yaml.load(source) as Record<string, any>;
const tileSource = readFileSync(
  resolve(process.cwd(), "src/components/StormPrepTile.tsx"),
  "utf8",
);

test("initial setup exposes the homeowner unlock gate", () => {
  const setupMessage =
    "Battery control configuration is missing or invalid. Unlock homeowner controls";
  const setupIndex = tileSource.indexOf(setupMessage);
  assert.ok(setupIndex >= 0);
  assert.match(tileSource.slice(setupIndex, setupIndex + 500), /\{securityGate\}/);
});

test("approval applies only the immutable reviewed control snapshot", () => {
  const request = JSON.stringify(
    packageConfig.script.maui_storm_prep_request,
  );
  const approve = JSON.stringify(
    packageConfig.script.maui_storm_prep_approve,
  );

  assert.match(request, /maui_storm_prep_requested_control/);
  assert.match(request, /maui_storm_prep_requested_value/);
  assert.match(request, /maui_storm_prep_requested_domain/);
  assert.match(request, /maui_storm_prep_requested_duration_hours/);
  assert.match(request, /maui_storm_prep_requested_control_2/);
  assert.match(request, /maui_storm_prep_requested_value_2/);
  assert.match(request, /maui_storm_prep_requested_domain_2/);
  assert.match(approve, /maui_storm_prep_requested_control/);
  assert.match(approve, /control == current_control/);
  assert.match(approve, /target_value == current_target/);
  assert.match(approve, /control_domain == requested_domain/);
  assert.match(approve, /duration_hours == current_duration_hours/);
  assert.match(approve, /control_2 == current_control_2/);
  assert.match(approve, /control_2 == verified_control_2/);
  assert.match(approve, /target_value_2 == current_target_2/);
  assert.match(approve, /control_domain_2 == requested_domain_2/);
});

test("second bank is optional, fully bound when present, and distinct", () => {
  const status = JSON.stringify(packageConfig.template);
  assert.match(status, /entity2 == '' and verified2 == '' and target2 == ''/);
  assert.match(status, /entity2 != entity/);
  assert.match(status, /entity2 == verified2/);
  assert.match(status, /available2 and identity2/);
  assert.match(status, /second\.valid/);
});

test("approval directly revalidates second-bank metadata without status-sensor lag", () => {
  const approve = JSON.stringify(packageConfig.script.maui_storm_prep_approve);
  assert.doesNotMatch(
    approve,
    /sensor\.maui_storm_prep_status.*config_valid|config_valid.*sensor\.maui_storm_prep_status/,
  );
  assert.match(approve, /available2 and identity2/);
  assert.match(approve, /control_2 != control/);
  assert.match(approve, /control_2 == current_control_2/);
  assert.match(approve, /control_2 == verified_control_2/);
  assert.match(approve, /target_value_2 == current_target_2/);
  assert.match(approve, /control_domain_2 == requested_domain_2/);
  assert.match(approve, /state_attr\(control_2, 'unit_of_measurement'\) == '%'/);
  assert.match(approve, /minimum2 <= value2 <= maximum2/);
  assert.match(approve, /state_attr\(control_2, 'options'\) or \[\]/);
  assert.match(approve, /second\.valid/);
});

test("status publishes both current values, targets, and combined action", () => {
  const status = packageConfig.template
    .flatMap((group: Record<string, any>) => group.sensor ?? [])
    .find((sensor: Record<string, unknown>) =>
      String(sensor.name).includes("Storm Prep Status"),
    );
  assert.ok(status);
  assert.ok(status.attributes.current_value);
  assert.ok(status.attributes.target_value);
  assert.ok(status.attributes.control_entity_2);
  assert.ok(status.attributes.current_value_2);
  assert.ok(status.attributes.target_value_2);
  assert.match(String(status.attributes.proposed_action), /action1/);
  assert.match(String(status.attributes.proposed_action), /name2/);
});

test("out-of-band configuration changes invalidate pending approval", () => {
  const automation = packageConfig.automation.find(
    (item: Record<string, unknown>) =>
      item.id === "maui_storm_prep_invalidate_changed_request",
  );
  assert.ok(automation);
  const serialized = JSON.stringify(automation);
  assert.match(serialized, /maui_storm_prep_control_entity/);
  assert.match(serialized, /maui_storm_prep_verified_control/);
  assert.match(serialized, /maui_storm_prep_control_value/);
  assert.match(serialized, /maui_storm_prep_control_entity_2/);
  assert.match(serialized, /maui_storm_prep_verified_control_2/);
  assert.match(serialized, /maui_storm_prep_control_value_2/);
  assert.match(serialized, /maui_storm_prep_duration_hours/);
  assert.match(serialized, /maui_storm_prep_pending/);
  assert.match(serialized, /maui_storm_prep_approval_token/);
});

test("recovery record is persisted before any battery write", () => {
  const approve = JSON.stringify(
    packageConfig.script.maui_storm_prep_approve,
  );
  const recoveryIndex = approve.indexOf(
    "input_boolean.maui_storm_prep_recovery_required",
  );
  const firstBatteryWrite = Math.min(
    ...["number.set_value", "select.select_option", "switch.turn_on"]
      .map((action) => approve.indexOf(action))
      .filter((index) => index >= 0),
  );
  assert.ok(recoveryIndex >= 0);
  assert.ok(firstBatteryWrite >= 0);
  assert.ok(recoveryIndex < firstBatteryWrite);
  assert.ok(
    approve.indexOf("maui_storm_prep_previous_entity_2") < firstBatteryWrite,
  );
  assert.ok(
    approve.indexOf("maui_storm_prep_previous_value_2") < firstBatteryWrite,
  );
});

test("each bank write is separately verified and partial failures restore", () => {
  const approve = JSON.stringify(packageConfig.script.maui_storm_prep_approve);
  assert.match(approve, /states\(control\)/);
  assert.match(approve, /states\(control_2\)/);
  assert.match(approve, /applied_2/);
  assert.match(approve, /Partial failure: first control/);
  assert.match(approve, /second control .* could not be verified/);
  assert.match(approve, /First control verification failed/);
  assert.match(approve, /second control was not written/);
  assert.match(approve, /script\.maui_storm_prep_end/);
  const firstVerification = approve.indexOf('"applied"');
  const secondWriteAfterVerification = approve.indexOf(
    "control_domain_2 == 'number'",
    firstVerification,
  );
  assert.ok(firstVerification >= 0);
  assert.ok(secondWriteAfterVerification > firstVerification);
});

test("restoration treats both prior values independently", () => {
  const restore = JSON.stringify(packageConfig.script.maui_storm_prep_end);
  assert.match(restore, /maui_storm_prep_previous_entity_2/);
  assert.match(restore, /maui_storm_prep_previous_value_2/);
  assert.match(restore, /restorable_2/);
  assert.match(restore, /restored_2/);
  assert.match(restore, /restored and restored_2/);
  assert.match(restore, /recovery remains required until both controls are restored/);
  const bothVerified = restore.indexOf("restored and restored_2");
  const recoveryOffAfterVerification = restore.indexOf(
    "input_boolean.maui_storm_prep_recovery_required",
    bothVerified,
  );
  assert.ok(recoveryOffAfterVerification > bothVerified);
});

test("expiry and restart reconciliation both invoke durable restoration", () => {
  const expiry = packageConfig.automation.find(
    (item: Record<string, unknown>) => item.id === "maui_storm_prep_expire",
  );
  const reconcile = packageConfig.automation.find(
    (item: Record<string, unknown>) => item.id === "maui_storm_prep_reconcile",
  );
  assert.match(JSON.stringify(expiry), /script\.maui_storm_prep_end/);
  const serialized = JSON.stringify(reconcile);
  assert.match(serialized, /event":"start/);
  assert.match(serialized, /maui_storm_prep_recovery_required/);
  assert.match(serialized, /script\.maui_storm_prep_end/);
});

test("legacy one-control configuration remains supported", () => {
  const serialized = JSON.stringify(packageConfig.template);
  assert.match(serialized, /entity2 == '' and verified2 == '' and target2 == ''/);
  const approve = JSON.stringify(packageConfig.script.maui_storm_prep_approve);
  assert.match(approve, /control_2 == ''/);
  assert.match(approve, /true/);
});

test("weather evaluation only requests approval and contains no battery writes", () => {
  const evaluate = packageConfig.automation.find(
    (item: Record<string, unknown>) => item.id === "maui_storm_prep_evaluate",
  );
  const serialized = JSON.stringify(evaluate);
  assert.match(serialized, /script\.maui_storm_prep_request/);
  assert.doesNotMatch(
    serialized,
    /number\.set_value|select\.select_option|switch\.turn_(?:on|off)/,
  );
});