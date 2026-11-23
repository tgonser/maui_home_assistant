import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldStreamEntity } from "./streamFilter.ts";

test("keeps panel totals, drops SPAN circuits and wind", () => {
  assert.equal(shouldStreamEntity("sensor.span_panel_current_power"), true);
  assert.equal(shouldStreamEntity("sensor.span_panel_2_current_power"), true);
  assert.equal(shouldStreamEntity("sensor.span_panel_3_site_power"), true);
  assert.equal(shouldStreamEntity("sensor.span_panel_outlets_kitchen_dishwasher_power"), false);
  assert.equal(shouldStreamEntity("binary_sensor.span_panel_door_state"), false);
  assert.equal(shouldStreamEntity("sensor.makena_4_wind_speed"), false);
  assert.equal(shouldStreamEntity("light.floor_1_kitchen"), true);
  assert.equal(shouldStreamEntity("climate.kitchen"), true);
});
