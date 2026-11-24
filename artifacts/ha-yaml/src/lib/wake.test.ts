import { test } from "node:test";
import assert from "node:assert/strict";
import { prettyTime, shiftTime, readWake, suiteOccupied } from "./wake.ts";

test("time helpers", () => {
  assert.equal(prettyTime("07:05"), "7:05 AM");
  assert.equal(prettyTime("00:30"), "12:30 AM");
  assert.equal(prettyTime("13:00"), "1:00 PM");
  assert.equal(shiftTime("23:55", 10), "00:05");
  assert.equal(shiftTime("00:05", -10), "23:55");
});

test("readWake", () => {
  const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes, last_changed: "", last_updated: "" });
  const m = new Map([
    st("input_datetime.wake_molokini_time", "06:45:00"),
    st("input_boolean.wake_molokini_enabled", "on"),
    st("input_select.wake_molokini_repeat", "Every day until I leave"),
    st("input_datetime.wake_molokini_until", "2026-11-30"),
  ].map((s) => [s.entity_id, s]));
  const w = readWake(m, "molokini");
  assert.equal(w.time, "06:45"); assert.equal(w.enabled, true); assert.equal(w.repeat, "Every day until I leave"); assert.equal(w.until, "2026-11-30");
  assert.equal(readWake(new Map(), "beach").available, false);
});

test("suiteOccupied follows the wake-up", () => {
  const st = (entity_id: string, state: string) => ({ entity_id, state, attributes: {}, last_changed: "", last_updated: "" });
  const on = new Map([st("input_datetime.wake_molokini_time", "06:45:00"), st("input_boolean.wake_molokini_enabled", "on")].map((s) => [s.entity_id, s]));
  const off = new Map([st("input_datetime.wake_molokini_time", "06:45:00"), st("input_boolean.wake_molokini_enabled", "off")].map((s) => [s.entity_id, s]));
  assert.equal(suiteOccupied(on, "molokini", "2026-11-23"), true);
  assert.equal(suiteOccupied(off, "molokini", "2026-11-23"), false);
});

import { nextWakeDay, WAKE_PRESETS } from "./wake.ts";

test("nextWakeDay: later today vs tomorrow", () => {
  assert.equal(nextWakeDay("07:00", "06:17"), "today");
  assert.equal(nextWakeDay("07:00", "07:00"), "tomorrow");
  assert.equal(nextWakeDay("06:30", "22:10"), "tomorrow");
  assert.ok(WAKE_PRESETS.includes("07:00"));
});
