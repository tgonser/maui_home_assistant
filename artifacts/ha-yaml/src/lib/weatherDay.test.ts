import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, clockText, hoursText, daytimeCloud, mauiDay, solarEstimate, solarForecastFor, sunTimes, sunWords, waterTemps } from "./weatherDay.ts";

test("sun times for Nov 27 2026 match the weather app within 3 min", () => {
  const s = sunTimes("2026-11-27");
  // The app uses Kihei town; the house is a few miles south, so allow 3 minutes.
  const near = (ms: number, hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); const want = Date.UTC(2026, 10, 27, h + 10, m); assert.ok(Math.abs(ms - want) <= 3 * 60_000, `${clockText(ms)} vs ${hhmm}`); };
  near(s.firstLight, "06:21"); near(s.sunrise, "06:44"); near(s.sunset, "17:45"); near(s.lastLight, "18:08");
  assert.ok(Math.abs(s.dayHours - 11) < 0.05, String(s.dayHours));
  assert.ok(Math.abs(s.dayHours + s.nightHours - 24) < 1e-9);
});

test("days, cloud and solar", () => {
  assert.equal(mauiDay(Date.parse("2026-11-27T09:00:00Z")), "2026-11-26");
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  const hours = [9, 10, 11, 12, 13, 14, 15, 16].map((h) => ({ datetime: new Date(Date.UTC(2026, 10, 28, h + 10)).toISOString(), cloud_coverage: h < 12 ? 20 : 60 }));
  assert.equal(daytimeCloud(hours, "2026-11-28"), (3 * 20 + 4 * 60) / 7);
  assert.equal(daytimeCloud(hours, "2026-11-29"), null);
  assert.equal(solarEstimate(100, 0), 100);
  assert.equal(solarEstimate(100, 100), 30);
  assert.equal(sunWords(10), "Sunny");
  assert.equal(hoursText(10.999), "11 h 0 min");
  assert.equal(hoursText(13.25), "13 h 15 min");
  assert.equal(sunWords(75), "Mostly cloudy");
});

test("water temps: ocean, pool and spa found by name; air and room sensors ignored", () => {
  const st = (state: string, attributes: Record<string, unknown>) => ({ state, attributes });
  const w = waterTemps([
    ["sensor.pool_double_sliders_temperature", st("78", { device_class: "temperature", friendly_name: "Pool double sliders Temperature" })],
    ["sensor.omnilogic_spa_water_temperature", st("101.4", { device_class: "temperature", friendly_name: "Spa Water Temperature" })],
    ["sensor.omnilogic_pool_water_temperature", st("80.2", { device_class: "temperature", friendly_name: "Pool Water Temperature" })],
    ["sensor.omnilogic_air_temperature", st("75", { device_class: "temperature", friendly_name: "Pool Air Temperature" })],
    ["sensor.ocean_temperature", st("78.6", { device_class: "temperature", friendly_name: "Ocean temperature" })],
    ["sensor.spa_water_temperature_2", st("unavailable", { device_class: "temperature" })],
  ]);
  assert.deepEqual(w.map((x) => `${x.label}:${x.value}`), ["Ocean:78.6", "Pool:80.2", "Spa:101.4"]);
});

test("solar forecast only for today and tomorrow", () => {
  assert.equal(solarForecastFor("2026-11-28", "2026-11-27", "2026-11-28", 59.2, 63.7), 64);
  assert.equal(solarForecastFor("2026-11-27", "2026-11-27", "2026-11-28", 59.2, 63.7), 59);
  assert.equal(solarForecastFor("2026-11-29", "2026-11-27", "2026-11-28", 59.2, 63.7), null);
  assert.equal(solarForecastFor("2026-11-28", "2026-11-27", "2026-11-28", 59.2, null), null);
});
