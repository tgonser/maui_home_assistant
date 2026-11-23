import { test } from "node:test";
import assert from "node:assert/strict";
import { shadeView, SHADE_IDS } from "./shades.ts";

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) =>
  ({ entity_id, state, attributes, last_changed: "", last_updated: "" });

test("shadeView labels position and movement", () => {
  const m = new Map([
    st("cover.a", "open", { current_position: 100 }),
    st("cover.b", "open", { current_position: 42 }),
    st("cover.c", "closing", { current_position: 60 }),
    st("cover.d", "unavailable"),
  ].map((s) => [s.entity_id, s]));
  assert.equal(shadeView(m, "cover.a", "A").label, "Open");
  assert.equal(shadeView(m, "cover.b", "B").label, "42% open");
  assert.equal(shadeView(m, "cover.c", "C").label, "Closing…");
  assert.equal(shadeView(m, "cover.d", "D").label, "Offline");
  assert.equal(shadeView(m, "cover.x", "X").available, false);
});

test("all twelve shades are listed once and the garage is not", () => {
  assert.equal(SHADE_IDS.length, 12);
  assert.equal(new Set(SHADE_IDS).size, 12);
  assert.equal(SHADE_IDS.some((id) => id.includes("garage")), false);
});
