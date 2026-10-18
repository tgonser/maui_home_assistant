import assert from "node:assert/strict";
import test from "node:test";
import { loadSolarSnapshot, solarSourceIssue } from "./solarRecorder.ts";
import { SOLAR_SOURCE_IDS, solarWindow } from "./solarEnergy.ts";

const now = Date.parse("2026-09-30T21:07:31.814Z");
const id = SOLAR_SOURCE_IDS.lifetime;
const metadata = { statistic_id: id, has_sum: true, unit_of_measurement: "MWh", unit_class: "energy" };
const reply = (meta: unknown = [metadata], data: unknown = { [id]: [] }) => ({
  ok: true,
  results: [
    { id: 1, success: true, result: meta },
    { id: 2, success: true, result: data },
  ],
});
const sensor = (overrides: Record<string, unknown> = {}) => ({
  entity_id: id,
  state: "25.94887",
  attributes: { unit_of_measurement: "MWh", device_class: "energy", state_class: "total_increasing" },
  last_updated: new Date(now).toISOString(),
  last_changed: new Date(now).toISOString(),
  ...overrides,
});

test("requests only the verified lifetime source with one bounded baseline and explicit kWh conversion", async () => {
  const window = solarWindow(now);
  const snapshot = await loadSolarSnapshot(async (commands) => {
    assert.equal(commands.length, 2);
    assert.deepEqual(commands[0], {
      type: "recorder/get_statistics_metadata", statistic_ids: [id],
    });
    assert.deepEqual(commands[1], {
      type: "recorder/statistics_during_period",
      statistic_ids: [id], period: "hour",
      start_time: new Date(window.requestStartMs).toISOString(),
      end_time: new Date(window.throughMs).toISOString(),
      types: ["sum", "state"], units: { energy: "kWh" },
    });
    assert.ok(window.throughMs - window.requestStartMs <= 169 * 3600_000);
    return reply();
  }, now, () => now + 500);
  assert.equal(snapshot.unit, "kWh"); // Not the current sensor's MWh unit.
  assert.equal(snapshot.requestedAtMs, now);
  assert.equal(snapshot.fetchedAtMs, now + 500);
});

test("rejects unverified metadata instead of using another Envoy or native period sensor", async () => {
  for (const meta of [
    [],
    [{ ...metadata, statistic_id: SOLAR_SOURCE_IDS.today }],
    [{ ...metadata, has_sum: false }],
    [{ ...metadata, unit_of_measurement: "kW" }],
    [{ ...metadata, unit_class: "power" }],
  ]) {
    await assert.rejects(loadSolarSnapshot(async () => reply(meta), now), /unavailable|unverified/);
  }
});

test("surfaces recorder failures and malformed payloads", async () => {
  await assert.rejects(loadSolarSnapshot(async () => ({
    ok: false, results: [], error: "Timed out",
  }), now), /Timed out/);
  await assert.rejects(loadSolarSnapshot(async () => ({
    ok: true, results: [{ id: 1, success: false, error: { code: "failed", message: "Recorder offline" } }],
  }), now), /Recorder offline/);
  for (const data of [null, {}, [], { [id]: [null] }, { [id]: Array(201).fill({}) }]) {
    await assert.rejects(loadSolarSnapshot(async () => reply([metadata], data), now));
  }
});

test("requires a valid cumulative energy source, never silently coercing missing data to zero", () => {
  assert.equal(solarSourceIssue([sensor()], now), null);
  assert.ok(solarSourceIssue([], now));
  for (const state of ["unavailable", "unknown", "", "25.9junk", "Infinity", "-1"]) {
    assert.ok(solarSourceIssue([sensor({ state })], now));
  }
  assert.ok(solarSourceIssue([sensor({ attributes: { unit_of_measurement: "MWh", state_class: "measurement" } })], now));
  assert.equal(solarSourceIssue([sensor({ state: "0" })], now), null);
});

test("last_reported detects stalled sources without rejecting an unchanged overnight counter", () => {
  const overnight = new Date(now - 12 * 3600_000).toISOString();
  assert.equal(solarSourceIssue([sensor({ last_updated: overnight, last_reported: new Date(now).toISOString() })], now), null);
  assert.match(solarSourceIssue([sensor({ last_reported: new Date(now - 16 * 60_000).toISOString() })], now)!, /stale/);
  assert.equal(solarSourceIssue([sensor({ last_updated: overnight })], now), null);
  for (const last_updated of ["invalid", new Date(now - 27 * 3600_000).toISOString(), new Date(now + 3600_000).toISOString()]) {
    assert.match(solarSourceIssue([sensor({ last_updated })], now)!, /stale/);
  }
});