import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, clockText, hoursText, daytimeCloud, mauiDay, solarEstimate, sunTimes, sunWords } from "./weatherDay.ts";

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
