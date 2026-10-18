import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateSolarPeriods,
  energyToKwh,
  solarWindow,
  SOLAR_HOUR_MS,
  SOLAR_REFRESH_MS,
  SOLAR_SOURCE_IDS,
  SOLAR_STALE_MS,
  type SolarSnapshot,
  type SolarStatisticPoint,
} from "./solarEnergy.ts";

const now = Date.parse("2026-09-30T22:05:00Z");
const HOUR = SOLAR_HOUR_MS;

function complete(
  at = now,
  production: (start: number) => number = () => 1,
  unit = "kWh",
): SolarSnapshot {
  const window = solarWindow(at);
  const factor = unit === "MWh" ? 1000 : unit === "Wh" ? 0.001 : 1;
  let state = 25_900;
  let sum = 500;
  const points: SolarStatisticPoint[] = [];
  for (let start = window.requestStartMs; start < window.throughMs; start += HOUR) {
    if (start !== window.requestStartMs) {
      state += production(start);
      sum += production(start);
    }
    points.push({
      start,
      end: start + HOUR,
      state: state / factor,
      sum: sum / factor,
    });
  }
  return { points, unit, fetchedAtMs: at, requestedAtMs: at };
}

function near(actual: number | null, expected: number) {
  assert.notEqual(actual, null);
  assert.ok(Math.abs(actual! - expected) < 1e-7, `${actual} != ${expected}`);
}

test("pins the surveyed Main Envoy source and refresh contract", () => {
  assert.deepEqual(SOLAR_SOURCE_IDS, {
    live: "sensor.envoy_202445013483_current_power_production",
    today: "sensor.envoy_202445013483_energy_production_today",
    sevenDay: "sensor.envoy_202445013483_energy_production_last_seven_days",
    lifetime: "sensor.envoy_202445013483_lifetime_energy_production",
  });
  assert.equal(SOLAR_REFRESH_MS, 300_000);
  assert.equal(SOLAR_STALE_MS, 600_000);
});

test("separate today and seven-calendar-day totals use identical lifetime hourly differences", () => {
  const result = calculateSolarPeriods(complete(), now);
  assert.equal(result.today.status, "ready");
  assert.equal(result.sevenDay.status, "ready");
  near(result.today.kwh, 12);
  near(result.sevenDay.kwh, 156);
  assert.equal(result.today.throughMs, Date.parse("2026-09-30T22:00:00Z"));
});

test("equal totals, including zero and nonzero, are legitimate", () => {
  for (const amount of [0, 2]) {
    const day = solarWindow(now).dayStartMs;
    const result = calculateSolarPeriods(complete(now, t => t >= day ? amount : 0), now);
    assert.equal(result.today.status, "ready");
    assert.equal(result.sevenDay.status, "ready");
    near(result.today.kwh, amount * 12);
    near(result.sevenDay.kwh, amount * 12);
  }
});

test("bad native screenshot/survey totals never become derived totals or a lifetime fallback", () => {
  for (const native of [25946.9, 25948.87]) {
    const snapshot = complete(now, () => 0);
    for (const point of snapshot.points) point.state = native;
    const result = calculateSolarPeriods(snapshot, now);
    near(result.today.kwh, 0);
    near(result.sevenDay.kwh, 0);
    snapshot.points = snapshot.points.slice(-1);
    assert.equal(calculateSolarPeriods(snapshot, now).today.kwh, null);
  }
});

test("Wh/kWh/MWh conversion and realistic 25.94887 MWh lifetime differences", () => {
  for (const unit of ["Wh", "kWh", "MWh"]) {
    const snapshot = complete(now, () => 0.25, unit);
    const result = calculateSolarPeriods(snapshot, now);
    near(result.today.kwh, 3);
    near(result.sevenDay.kwh, 39);
  }
  const snapshot = complete(now, () => 0, "MWh");
  const day = solarWindow(now).dayStartMs;
  for (const point of snapshot.points) {
    const delta = Number(point.start) >= day ? 0.002 : 0;
    point.state = 25.94687 + delta;
    point.sum = 0.94687 + delta;
  }
  near(calculateSolarPeriods(snapshot, now).today.kwh, 2);
});

test("null/empty data is unavailable; partial data and absent baseline are not zero", () => {
  assert.equal(calculateSolarPeriods(null, now).today.status, "unavailable");
  const snapshot = complete();
  snapshot.points = [];
  assert.equal(calculateSolarPeriods(snapshot, now).today.status, "unavailable");
  snapshot.points = complete().points.filter(p => Number(p.start) >= solarWindow(now).dayStartMs);
  const result = calculateSolarPeriods(snapshot, now);
  assert.equal(result.today.status, "incomplete");
  assert.equal(result.today.kwh, null);
  assert.match(result.today.detail, /baseline/);
});

test("historical gaps invalidate only the week, daily gaps invalidate both", () => {
  for (const historical of [true, false]) {
    const snapshot = complete();
    const target = historical ? solarWindow(now).weekStartMs + HOUR : solarWindow(now).dayStartMs + HOUR;
    snapshot.points = snapshot.points.filter(p => p.start !== target);
    const result = calculateSolarPeriods(snapshot, now);
    assert.equal(result.today.status, historical ? "ready" : "incomplete");
    assert.equal(result.sevenDay.status, "incomplete");
    assert.equal(result.sevenDay.kwh, null);
  }
});

test("recorder behind expected hour is incomplete even with a fresh fetch", () => {
  const snapshot = complete();
  snapshot.points.pop();
  const result = calculateSolarPeriods(snapshot, now);
  assert.equal(result.today.status, "incomplete");
  assert.match(result.today.detail, /behind/);
  assert.equal(result.today.throughMs, solarWindow(now).throughMs);
});

test("stale age threshold is strictly greater than ten minutes", () => {
  const snapshot = complete();
  assert.equal(calculateSolarPeriods(snapshot, now + SOLAR_STALE_MS).today.status, "ready");
  const result = calculateSolarPeriods(snapshot, now + SOLAR_STALE_MS + 1);
  assert.equal(result.today.status, "stale");
  assert.equal(result.sevenDay.kwh, null);
});

test("request spanning Hawaii midnight is stale even when returned after midnight", () => {
  const at = Date.parse("2027-01-01T10:01:00Z");
  const snapshot = complete(at);
  snapshot.requestedAtMs = Date.parse("2027-01-01T09:59:00Z");
  assert.equal(calculateSolarPeriods(snapshot, at).today.status, "stale");
});

test("Hawaii midnight, seven-day year rollover, and first completed hour", () => {
  const at = Date.parse("2027-01-01T10:30:00Z");
  const window = solarWindow(at);
  assert.equal(window.dayStartMs, Date.parse("2027-01-01T10:00:00Z"));
  assert.equal(window.weekStartMs, Date.parse("2026-12-26T10:00:00Z"));
  assert.equal(window.requestStartMs, Date.parse("2026-12-26T09:00:00Z"));
  const result = calculateSolarPeriods(complete(at), at);
  assert.equal(result.today.status, "unavailable");
  assert.equal(result.today.kwh, null);
  assert.match(result.today.detail, /first completed/);
  near(result.sevenDay.kwh, 144);
  const first = Date.parse("2027-01-01T11:00:00Z");
  near(calculateSolarPeriods(complete(first), first).today.kwh, 1);
  assert.equal(solarWindow(Date.parse("2027-01-01T09:59:00Z")).dayStartMs,
    Date.parse("2026-12-31T10:00:00Z"));
});

test("sum decreases, lifetime resets, and sum/state mismatches cannot fabricate energy", () => {
  for (const field of ["sum", "state", "mismatch"] as const) {
    const snapshot = complete();
    const point = snapshot.points.at(-1)!;
    if (field === "mismatch") point.sum! += 2;
    else point[field] = 0;
    const result = calculateSolarPeriods(snapshot, now);
    assert.equal(result.today.status, "incomplete");
    assert.equal(result.today.kwh, null);
    assert.match(result.today.detail, field === "mismatch" ? /disagrees/ : /decreased\/reset/);
  }
});

test("exact duplicate copies dedupe, conflicting copies invalidate only affected periods", () => {
  const snapshot = complete();
  snapshot.points.push({ ...snapshot.points[0] });
  near(calculateSolarPeriods(snapshot, now).sevenDay.kwh, 156);
  const conflicting = { ...snapshot.points[0], sum: snapshot.points[0].sum! + 1 };
  snapshot.points.push(conflicting);
  const result = calculateSolarPeriods(snapshot, now);
  assert.equal(result.today.status, "ready");
  assert.equal(result.sevenDay.status, "incomplete");
  snapshot.points.push({ ...snapshot.points.at(-3)!, start: solarWindow(now).dayStartMs, end: solarWindow(now).dayStartMs + HOUR });
  assert.equal(calculateSolarPeriods(snapshot, now).today.status, "incomplete");
});

test("overlaps, shifted hours, long buckets, and malformed old records are period-local", () => {
  for (const offset of [0, HOUR / 2]) {
    const snapshot = complete();
    const start = solarWindow(now).weekStartMs + offset;
    snapshot.points.push({ start, end: start + 2 * HOUR, sum: 1, state: 1 });
    const result = calculateSolarPeriods(snapshot, now);
    assert.equal(result.today.status, "ready");
    assert.equal(result.sevenDay.status, "incomplete");
  }
  const snapshot = complete();
  snapshot.points.at(-1)!.start = Number(snapshot.points.at(-1)!.start) + 1;
  assert.equal(calculateSolarPeriods(snapshot, now).today.status, "incomplete");
});

test("strict source energy conversion refuses empty, null, NaN, junk, and unknown units", () => {
  for (const value of [null, undefined, NaN, Infinity, "", " ", "12kWh", "1.2oops", true, {}, "0x10"]) {
    assert.equal(energyToKwh(value, "kWh"), null);
  }
  assert.equal(energyToKwh(1, "unknown"), null);
  assert.equal(energyToKwh("25.94887", "MWh"), 25948.87);
  assert.equal(energyToKwh("0", "Wh"), 0);
});

test("recorder sums/states are strictly numeric and timestamps cannot be coerced", () => {
  for (const field of ["sum", "state", "start", "end"] as const) {
    const invalids: unknown[] = field === "start" || field === "end"
      ? [null, NaN, "", "invalid", "2026-02-30T22:00:00Z", "123"]
      : [null, NaN, "", undefined, "1", Infinity];
    for (const invalid of invalids) {
      const snapshot = complete();
      Object.assign(snapshot.points.at(-1)!, { [field]: invalid });
      const result = calculateSolarPeriods(snapshot, now);
      assert.equal(result.today.status, "incomplete", `${field}: ${String(invalid)}`);
      assert.equal(result.today.kwh, null);
    }
  }
});

test("ongoing hourly bucket is excluded, never added or used as a substitute for a missing hour", () => {
  const snapshot = complete();
  const start = solarWindow(now).throughMs;
  snapshot.points.push({ start, end: start + HOUR, sum: 999999, state: 999999 });
  near(calculateSolarPeriods(snapshot, now).today.kwh, 12);
  snapshot.points.splice(snapshot.points.length - 2, 1);
  assert.equal(calculateSolarPeriods(snapshot, now).today.status, "incomplete");
});