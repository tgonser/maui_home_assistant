import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateGridCosts,
  GRID_EXPORT_STAT_IDS,
  GRID_IMPORT_STAT_IDS,
  GRID_RATES,
  hstRate,
  type GridStatistics,
} from "./gridCost.ts";

const hour = (
  start: string,
  change: number,
): { start: string; end: string; change: number } => ({
  start,
  end: new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString(),
  change,
});

function completeStats(): GridStatistics {
  return Object.fromEntries(
    [...GRID_IMPORT_STAT_IDS, ...GRID_EXPORT_STAT_IDS].map((id) => [id, []]),
  );
}

function addZeroHours(
  stats: GridStatistics,
  startIso: string,
  endIso: string,
) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  for (const id of [...GRID_IMPORT_STAT_IDS, ...GRID_EXPORT_STAT_IDS]) {
    stats[id] = [];
    for (let t = start; t < end; t += 60 * 60 * 1000) {
      stats[id].push(hour(new Date(t).toISOString(), 0));
    }
  }
}

test("uses the Hawaii rate schedule", () => {
  assert.equal(hstRate(8), GRID_RATES.midPeak);
  assert.equal(hstRate(9), GRID_RATES.offPeak);
  assert.equal(hstRate(16), GRID_RATES.offPeak);
  assert.equal(hstRate(17), GRID_RATES.peak);
  assert.equal(hstRate(20), GRID_RATES.peak);
  assert.equal(hstRate(21), GRID_RATES.midPeak);
});

test("today is the Hawaii calendar day, not a rolling 24-hour window", () => {
  const stats = completeStats();
  stats[GRID_IMPORT_STAT_IDS[0]] = [
    // Aug 18 at 11pm HST: same rolling 24h, but not Hawaii today.
    hour("2026-08-19T09:00:00.000Z", 10),
    // Aug 19 at 10am HST: Hawaii today, off-peak.
    hour("2026-08-19T20:00:00.000Z", 10),
  ];

  const result = calculateGridCosts(
    stats,
    new Date("2026-08-19T22:00:00.000Z").getTime(),
  );

  assert.equal(result.currentDayKey, "2026-08-19");
  assert.equal(result.todayCost, 10 * GRID_RATES.offPeak);
  assert.equal(result.dailyPoints.length, 2);
});

test("month-to-date and today share the same hourly contributions", () => {
  const stats = completeStats();
  stats[GRID_IMPORT_STAT_IDS[0]] = [
    // Earlier this month: $3.50 import cost.
    hour("2026-08-05T10:00:00.000Z", 10),
    // Today at 5pm HST: $5.20 import cost.
    hour("2026-08-20T03:00:00.000Z", 10),
  ];
  stats[GRID_EXPORT_STAT_IDS[0]] = [
    // Earlier this month: $0.40 export credit.
    hour("2026-08-06T20:00:00.000Z", 10),
    // Today: $0.08 export credit.
    hour("2026-08-19T20:00:00.000Z", 2),
  ];

  const result = calculateGridCosts(
    stats,
    new Date("2026-08-20T05:00:00.000Z").getTime(),
  );

  assert.ok(Math.abs(result.todayCost - 5.12) < 1e-9);
  assert.ok(Math.abs(result.beforeTodayCost - 3.1) < 1e-9);
  assert.ok(Math.abs(result.currentMonthCost - 8.22) < 1e-9);
  assert.ok(
    Math.abs(
      result.currentMonthCost -
        (result.beforeTodayCost + result.todayCost),
    ) < 1e-9,
  );
});

test("reports missing and invalid statistics instead of silently trusting them", () => {
  const stats: GridStatistics = {
    [GRID_IMPORT_STAT_IDS[0]]: [
      hour("2026-08-19T20:00:00.000Z", -100),
    ],
  };
  const result = calculateGridCosts(
    stats,
    new Date("2026-08-19T22:00:00.000Z").getTime(),
  );

  assert.equal(result.missingStatisticIds.length, 3);
  assert.equal(result.invalidPointCount, 1);
  assert.equal(result.todayCost, 0);
  assert.equal(result.isTodayComplete, false);
  assert.equal(result.isCurrentMonthComplete, false);
  assert.ok(result.dataIssues.length > 0);
});

test("marks one stale source as partial even when the others are current", () => {
  const stats = completeStats();
  addZeroHours(
    stats,
    "2026-08-01T10:00:00.000Z",
    "2026-08-19T22:00:00.000Z",
  );
  // Remove the last six hours from just one import stream.
  stats[GRID_IMPORT_STAT_IDS[1]] = stats[GRID_IMPORT_STAT_IDS[1]].slice(
    0,
    -6,
  );

  const result = calculateGridCosts(
    stats,
    new Date("2026-08-19T22:30:00.000Z").getTime(),
  );

  assert.equal(result.isTodayComplete, false);
  assert.equal(result.isCurrentMonthComplete, false);
  assert.equal(
    result.monthlyCosts.find((m) => m.key === "2026-08")?.partial,
    true,
  );
});

test("proves complete current-day and month coverage per source", () => {
  const stats = completeStats();
  addZeroHours(
    stats,
    "2026-08-01T10:00:00.000Z",
    "2026-08-19T22:00:00.000Z",
  );

  const result = calculateGridCosts(
    stats,
    new Date("2026-08-19T22:30:00.000Z").getTime(),
  );

  assert.equal(result.isTodayComplete, true);
  assert.equal(result.isCurrentMonthComplete, true);
  assert.equal(
    result.monthlyCosts.find((m) => m.key === "2026-08")?.partial,
    false,
  );
});

test("ignores the current incomplete hour and rejects malformed intervals", () => {
  const stats = completeStats();
  const now = new Date("2026-08-19T22:30:00.000Z").getTime();
  stats[GRID_IMPORT_STAT_IDS[0]] = [
    // Current 12–1pm HST bucket is not complete at 12:30pm.
    hour("2026-08-19T22:00:00.000Z", 100),
    // A malformed completed two-hour bucket.
    {
      start: "2026-08-19T19:00:00.000Z",
      end: "2026-08-19T21:00:00.000Z",
      change: 100,
    },
  ];

  const result = calculateGridCosts(stats, now);

  assert.equal(result.todayCost, 0);
  assert.equal(result.invalidPointCount, 1);
});

test("rejects overlapping different-start intervals and marks totals partial", () => {
  const stats = completeStats();
  addZeroHours(
    stats,
    "2026-08-01T10:00:00.000Z",
    "2026-08-19T22:00:00.000Z",
  );
  stats[GRID_IMPORT_STAT_IDS[0]].push({
    // Overlaps the valid 10–11am HST bucket by 30 minutes.
    start: "2026-08-19T20:30:00.000Z",
    end: "2026-08-19T21:30:00.000Z",
    change: 100,
  });

  const result = calculateGridCosts(
    stats,
    new Date("2026-08-19T22:30:00.000Z").getTime(),
  );

  assert.equal(result.todayCost, 0);
  assert.equal(result.invalidPointCount, 1);
  assert.equal(result.isTodayComplete, false);
  assert.equal(result.isCurrentMonthComplete, false);
});