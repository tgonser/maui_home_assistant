import { test } from "node:test";
import assert from "node:assert/strict";
import { agoText, isMotionSensor, recentMotion } from "./motionList.ts";
import { modeGuard } from "./houseMode.ts";

const st = (entity_id: string, state: string, attributes: Record<string, unknown>, last_changed = "2026-11-24T10:00:00Z") =>
  ({ entity_id, state, attributes, last_changed, last_updated: last_changed }) as never;

test("motion sensors exclude cameras and sub-entities", () => {
  assert.equal(isMotionSensor(st("binary_sensor.stair", "off", { device_class: "motion", friendly_name: "USL-Motion_Stair" })), true);
  assert.equal(isMotionSensor(st("binary_sensor.pool_g6_ptz_motion", "on", { device_class: "motion", friendly_name: "Pool G6 PTZ Motion" })), false);
  assert.equal(isMotionSensor(st("binary_sensor.motion_bath_battery", "off", {})), false);
});

test("recentMotion: active first, then newest", () => {
  const m = new Map([
    ["a", st("binary_sensor.a", "off", { device_class: "motion", friendly_name: "A" }, "2026-11-24T10:00:00Z")],
    ["b", st("binary_sensor.b", "off", { device_class: "motion", friendly_name: "B" }, "2026-11-24T11:00:00Z")],
    ["c", st("binary_sensor.c", "on", { device_class: "motion", friendly_name: "C" }, "2026-11-24T09:00:00Z")],
  ]);
  assert.deepEqual(recentMotion(m).map((x) => x.name), ["C", "B", "A"]);
  assert.equal(agoText(0, 30_000), "just now");
  assert.equal(agoText(0, 5 * 60_000), "5 min ago");
  assert.equal(agoText(0, 3 * 86_400_000), "3 days ago");
});

test("modeGuard locks Owners after 48 h away on Vacation", () => {
  const now = Date.parse("2026-11-24T10:00:00Z");
  const m = new Map([
    ["input_select.maui_house_mode", st("input_select.maui_house_mode", "Vacation", {})],
    ["device_tracker.tom_iphone17_temp", st("device_tracker.tom_iphone17_temp", "not_home", {}, "2026-11-20T10:00:00Z")],
  ]);
  assert.equal(modeGuard(m, now).ownersLocked, true);
  m.set("input_select.maui_house_mode", st("input_select.maui_house_mode", "Suspend", {}));
  assert.equal(modeGuard(m, now).ownersLocked, false);
});
