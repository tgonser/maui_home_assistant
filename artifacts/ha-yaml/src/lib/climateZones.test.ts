import { test } from "node:test";
import assert from "node:assert/strict";
import { zoneViews, openSliderTip, holdTimer } from "./climateZones.ts";

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) =>
  ({ entity_id, state, attributes, last_changed: "", last_updated: "" });

test("zoneViews reads targets, holds and open doors", () => {
  const m = new Map([
    st("climate.atrium", "cool", { temperature: 78, current_temperature: 77.4, hvac_action: "cooling" }),
    st("climate.master_bed_2", "cool", { temperature: 75, current_temperature: 76 }),
    st("timer.maui_hold_master_bed_2", "active", { finishes_at: "2026-11-24T04:30:00+00:00" }),
    st("binary_sensor.makena_alarm_zone_18", "on"),
  ].map((s) => [s.entity_id, s]));
  const v = zoneViews(m);
  const gr = v.find((z) => z.id === "climate.atrium")!;
  assert.equal(gr.now, 77); assert.equal(gr.target, 78); assert.equal(gr.doorOpen, true);
  assert.equal(v.find((z) => z.id === "climate.kitchen")!.doorOpen, true); // shared Great Room/Kitchen rule
  assert.equal(v.find((z) => z.id === "climate.kitchen")!.available, false);
  const m2 = v.find((z) => z.id === "climate.master_bed_2")!;
  assert.equal(m2.held, true); assert.equal(m2.heldUntil, "2026-11-24T04:30:00+00:00");
  assert.equal(holdTimer("climate.upper_mauka"), "timer.maui_hold_upper_mauka");
});

test("openSliderTip only in the cool hours and when clearly cooler", () => {
  assert.match(openSliderTip(72, 78, 20) ?? "", /slider/);
  assert.equal(openSliderTip(72, 78, 13), null);
  assert.equal(openSliderTip(77, 78, 20), null);
});
