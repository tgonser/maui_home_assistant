import { test } from "node:test";
import assert from "node:assert/strict";
import { BALANCE_BOUGHT, BALANCE_MOVED, SOC5_S2, balanceDays } from "./balanceLog.ts";

// Seconds for a time in HST (UTC−10).
const hst = (iso: string) => Date.parse(iso + "-10:00") / 1000;

test("daily peak of the running totals, 5 PM charge, newest first, empty early days dropped", () => {
  const rows = balanceDays({
    [BALANCE_MOVED]: [
      { s: "0", lu: hst("2026-11-22T00:00:00") }, { s: "2.645", lu: hst("2026-11-22T15:00:00") },
      { s: "0", lu: hst("2026-11-23T00:00:00") }, { s: "8.226", lu: hst("2026-11-23T16:00:00") },
      { s: "unavailable", lu: hst("2026-11-23T16:30:00") },
    ],
    [BALANCE_BOUGHT]: [{ s: "5.999", lu: hst("2026-11-23T16:00:00") }],
    [SOC5_S2]: [{ s: "58", lu: hst("2026-11-22T17:00:00") }, { s: "68", lu: hst("2026-11-23T17:00:00") }],
  }, Date.parse("2026-11-24T12:00:00-10:00"), 14);
  assert.deepEqual(rows.map((r) => r.day), ["2026-11-24", "2026-11-23", "2026-11-22"]);
  assert.deepEqual(rows[1], { day: "2026-11-23", moved: 8.226, bought: 5.999, soc1: null, soc2: 68 });
  assert.equal(rows[2].moved, 2.645);
  assert.equal(rows[0].moved, null);
});
