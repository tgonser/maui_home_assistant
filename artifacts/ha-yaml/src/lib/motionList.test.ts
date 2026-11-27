import { test } from "node:test";
import assert from "node:assert/strict";
import { agoText, isMotionSensor, lastMotionFromHistory, recentMotion } from "./motionList.ts";
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
  const lastOn = new Map([["binary_sensor.a", Date.parse("2026-11-24T10:00:00Z")], ["binary_sensor.b", Date.parse("2026-11-24T11:00:00Z")]]);
  assert.deepEqual(recentMotion(m, lastOn).map((x) => x.name), ["C", "B", "A"]);
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

test("a restart is not motion: idle sensors use history, not their reset last_changed", () => {
  const restart = "2026-11-27T16:01:00Z";
  const m = new Map([
    ["a", st("binary_sensor.a", "off", { device_class: "motion", friendly_name: "A" }, restart)],
    ["b", st("binary_sensor.b", "off", { device_class: "motion", friendly_name: "B" }, restart)],
  ]);
  const hist = lastMotionFromHistory({
    "binary_sensor.a": [{ s: "off", lu: 1795700000 }, { s: "on", lu: 1795701000 }, { s: "off", lu: 1795701100 }, { s: "unavailable", lu: 1795795200 }, { s: "on", lu: 1795795260 }, { s: "off", lu: 1795795300 }],
    "binary_sensor.b": [{ s: "unknown", lu: 1795795260 }, { s: "off", lu: 1795795261 }],
  });
  assert.equal(hist.get("binary_sensor.a"), 1795701000 * 1000);
  assert.equal(hist.has("binary_sensor.b"), false);
  const r = recentMotion(m, hist);
  assert.deepEqual(r.map((x) => [x.name, x.changed]), [["A", 1795701000 * 1000], ["B", null]]);
});
