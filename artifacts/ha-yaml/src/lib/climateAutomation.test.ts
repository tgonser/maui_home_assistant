import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";

const source = readFileSync(
  resolve(process.cwd(), "../../ha-config/maui_solar_aware_climate.yaml"),
  "utf8",
);

test("solar climate automation parses as YAML", () => {
  assert.ok(yaml.load(source));
});

test("unchanged thermostats do not receive repeated cloud writes", () => {
  assert.doesNotMatch(source, /state_attr\(repeat\.item, 'hvac_mode'\)/);

  const modeWrites = source.match(/action: climate\.set_hvac_mode/g) ?? [];
  const modeGuards =
    source.match(/states\(repeat\.item\) != 'cool'/g) ?? [];
  assert.equal(modeWrites.length, 4);
  assert.equal(modeGuards.length, modeWrites.length);
});

test("solar climate automation never changes thermostat fan mode", () => {
  assert.doesNotMatch(source, /action: climate\.set_fan_mode/);
});