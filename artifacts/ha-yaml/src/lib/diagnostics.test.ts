import test from "node:test";
import assert from "node:assert/strict";
import { buildDiagnostics } from "./diagnostics.ts";

const entity = (id: string, state = "10", attributes: Record<string, unknown> = {}) =>
  ({ entity_id: id, state, attributes, last_changed: "", last_updated: "" });

test("exports relevant states, exact control ranges and selected categories only", () => {
  const report = buildDiagnostics([
    entity("number.4680_system_2_backup_reserve", "10", { min: 0, max: 100, unit_of_measurement: "%" }),
    entity("climate.kitchen", "cool", { hvac_modes: ["off", "cool"] }),
    entity("person.homeowner", "home"),
    entity("camera.entry", "idle"),
    entity("sensor.iphone_battery", "90"),
  ], ["battery"]);
  assert.equal(report.entity_count, 1);
  assert.equal(report.entities[0].state, "10");
  assert.deepEqual(report.entities[0].attributes, { min: 0, max: 100, unit_of_measurement: "%" });
});

test("excludes secret entities and non-allowlisted or nested attributes", () => {
  const report = buildDiagnostics([
    entity("input_text.maui_storm_prep_approval_token", "private-approval"),
    entity("input_text.maui_storm_prep_pin", "private-pin"),
    entity("sensor.solar_power", "10", {
      access_token: "private-token", latitude: 20, longitude: 21,
      entity_picture: "https://private", friendly_name: "Solar",
      options: [{ password: "private-nested" }], config_valid: true,
    }),
    entity("input_text.maui_storm_prep_notify_service", "https://private.example/secret"),
  ], ["solar", "stormPrep"]);
  const text = JSON.stringify(report);
  assert.doesNotMatch(text, /private-|private\.example|latitude|longitude|entity_picture/);
  assert.equal(report.entities.find(e => e.entity_id === "sensor.solar_power")?.attributes.friendly_name, "Solar");
});

test("snapshot carries timestamp and does not mutate source states", () => {
  const source = [entity("climate.kitchen", "cool", { temperature: 76 })];
  const before = JSON.stringify(source);
  const report = buildDiagnostics(source, ["climate"], "2026-10-18T12:00:00Z");
  assert.equal(report.captured_at, "2026-10-18T12:00:00Z");
  assert.equal(JSON.stringify(source), before);
  assert.equal(buildDiagnostics(source, []).entity_count, 0);
});
