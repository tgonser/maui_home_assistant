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
    "Both battery control pairs are missing or invalid. Unlock homeowner controls";
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
  assert.match(approve, /target_value_2 == current_target_2/);
  assert.match(approve, /control_domain_2 == requested_domain_2/);
  assert.match(approve, /control_2 != control/);
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

test("both prior values are durable before writes and both writes are verified", () => {
  const approve = JSON.stringify(packageConfig.script.maui_storm_prep_approve);
  const previous1 = approve.indexOf("maui_storm_prep_previous_value");
  const previous2 = approve.indexOf("maui_storm_prep_previous_value_2");
  const firstBatteryWrite = Math.min(
    ...["number.set_value", "select.select_option", "switch.turn_on"]
      .map((action) => approve.indexOf(action))
      .filter((index) => index >= 0),
  );
  assert.ok(previous1 >= 0 && previous2 >= 0);
  assert.ok(previous1 < firstBatteryWrite && previous2 < firstBatteryWrite);
  assert.match(approve, /applied_2/);
  assert.match(approve, /applied \| bool and applied_2 \| bool/);

  const restore = JSON.stringify(packageConfig.script.maui_storm_prep_end);
  assert.match(restore, /maui_storm_prep_previous_entity_2/);
  assert.match(restore, /restored_2/);
  assert.match(restore, /restored and restored_2/);
});

test("weather evaluation remains recommendation-only", () => {
  const automation = packageConfig.automation.find(
    (item: Record<string, unknown>) => item.id === "maui_storm_prep_evaluate",
  );
  const serialized = JSON.stringify(automation);
  assert.match(serialized, /script\.maui_storm_prep_request/);
  assert.doesNotMatch(serialized, /number\.set_value|select\.select_option|switch\.turn_(?:on|off)/);
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
});