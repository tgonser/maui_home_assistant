import { test } from "node:test";
import assert from "node:assert/strict";
import { lightGroup, roomStatus, suiteInUse, restartMinute, energyNow, energyFlows, fitLabel, FLOORS } from "./houseMap.ts";

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}, last_changed = "2026-11-23T10:00:00Z") =>
  ({ entity_id, state, attributes, last_changed, last_updated: last_changed });

test("suite bath lights do not count as the bedroom", () => {
  assert.equal(lightGroup("light.floor_1_bedroom_2_suite_bed_2_bath_vanity"), "bath2");
  assert.equal(lightGroup("light.floor_1_bedroom_2_suite_bed_2_bed_downlights"), "beach");
  assert.equal(lightGroup("light.floor_2_bedroom_5_suite_bed_5_bath_toe_kick"), "bath5");
  assert.equal(lightGroup("light.floor_2_master_suite_master_bath_shower_downlight"), "mbath");
  assert.equal(lightGroup("light.floor_2_master_suite_master_bed_downlights"), "master");
  assert.equal(lightGroup("light.master_bath_u6_pro_led"), null); // UniFi AP LED
  assert.equal(lightGroup("light.sitting_lights"), null); // helper group, not a load
});

test("roomStatus counts lights, temps, music and recent motion", () => {
  const now = Date.parse("2026-11-23T10:01:00Z");
  const m = new Map([
    st("light.floor_1_bar_pendants", "on"),
    st("light.floor_1_bar_downlights", "off"),
    st("light.floor_1_bar_cove", "unavailable"),
    st("climate.atrium", "cool", { current_temperature: 77.4 }),
    st("media_player.great_room", "playing"),
    st("binary_sensor.usl_motion_sitting", "off", {}, "2026-11-23T10:00:30Z"),
  ].map((s) => [s.entity_id, s]));
  const r = roomStatus(m, now);
  assert.equal(r.get("bar")?.lightsOn, 1);
  assert.equal(r.get("bar")?.lightIds.length, 2);
  assert.equal(r.get("great")?.temp, 77);
  assert.equal(r.get("great")?.playing, true);
  assert.equal(r.get("sitting")?.motion, true);
});

test("suiteInUse looks back 24 hours", () => {
  const now = Date.parse("2026-11-23T10:00:00Z");
  const fresh = new Map([st("light.floor_2_bedroom_4_suite_bed_4_bath_toe_kicks", "off", {}, "2026-11-23T02:00:00Z")].map((s) => [s.entity_id, s]));
  const stale = new Map([st("light.floor_2_bedroom_4_suite_bed_4_bath_toe_kicks", "off", {}, "2026-11-21T02:00:00Z")].map((s) => [s.entity_id, s]));
  assert.equal(suiteInUse(fresh, { id: "molokini", bath: "bath4" }, now), true);
  assert.equal(suiteInUse(stale, { id: "molokini", bath: "bath4" }, now), false);
});

test("energyNow sums both systems", () => {
  const m = new Map([
    st("sensor.gonser_4680_system_1_solar_power", "3.7"), st("sensor.4680_system_2_solar_power", "1.2"),
    st("sensor.gonser_4680_system_1_grid_power", "-1.0"), st("sensor.4680_system_2_grid_power", "0"),
    st("sensor.gonser_4680_system_1_percentage_charged", "66.4"),
  ].map((s) => [s.entity_id, s]));
  const e = energyNow(m);
  assert.ok(Math.abs(e.solarKw - 4.9) < 1e-9);
  assert.equal(e.gridKw, -1);
  assert.equal(e.soc1, 66.4);
  assert.equal(e.soc2, null);
});

test("fitLabel turns narrow tall labels sideways", () => {
  assert.equal(fitLabel("Walkway", 100, 315, 30, 24).rot, true);
  assert.equal(fitLabel("Kitchen", 395, 220, 35, 50).rot, false);
});

test("every room sits inside its floor bounds", () => {
  for (const f of FLOORS) for (const r of f.rooms) {
    assert.ok(r.x0 >= f.ox && r.x1 <= f.ox + f.w && r.y0 >= f.oy && r.y1 <= f.oy + f.h, `${f.id}/${r.id}`);
  }
});

test("a restart stamp is not activity", () => {
  const now = Date.parse("2026-11-23T10:00:00Z");
  const boot = "2026-11-23T03:00:05Z";
  const entries = Array.from({ length: 30 }, (_, i) => st(`sensor.x${i}`, "1", {}, boot));
  entries.push(st("light.floor_2_bedroom_4_suite_bed_4_bath_toe_kicks", "off", {}, boot));
  const m = new Map(entries.map((s) => [s.entity_id, s]));
  assert.notEqual(restartMinute(m), null);
  assert.equal(suiteInUse(m, { id: "molokini", bath: "bath4" }, now), false);
  m.set("light.floor_2_bedroom_4_suite_bed_4_bath_vanity_sconces", st("light.floor_2_bedroom_4_suite_bed_4_bath_vanity_sconces", "off", {}, "2026-11-23T06:10:00Z"));
  assert.equal(suiteInUse(m, { id: "molokini", bath: "bath4" }, now), true);
});

test("energyFlows splits sun between house, batteries and grid", () => {
  const base = { soc1: null, soc2: null };
  assert.deepEqual(energyFlows({ ...base, solarKw: 6, houseKw: 3.9, batteryKw: -2.1, gridKw: 0 }),
    { sunToHouse: 3.9, sunToBattery: 2.1, sunToGrid: 0, batteryToHouse: 0, gridToHouse: 0, gridToBattery: 0 });
  // evening: batteries run the house
  assert.deepEqual(energyFlows({ ...base, solarKw: 0, houseKw: 1.2, batteryKw: 1.2, gridKw: 0 }),
    { sunToHouse: 0, sunToBattery: 0, sunToGrid: 0, batteryToHouse: 1.2, gridToHouse: 0, gridToBattery: 0 });
  // midday surplus: charging and selling
  assert.equal(energyFlows({ ...base, solarKw: 15, houseKw: 2, batteryKw: -5, gridKw: -8 }).sunToGrid, 8);
});
