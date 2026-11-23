import test from "node:test";
import assert from "node:assert/strict";
import { buildNetGridSeries } from "./netGrid.ts";

const M = 60_000;

test("carries each system's last value forward instead of treating a missing update as 0", () => {
  // System 1 exports 5 kW from t=0; System 2 imports 3 kW from t=1 min and never changes again.
  const s = buildNetGridSeries(
    [{ t: 0, v: -5 }],
    [{ t: 1 * M, v: 3 }],
    0,
    30 * M,
  );
  assert.ok(s.length >= 6);
  for (const p of s) assert.equal(p.net, 2); // 5 exported − 3 imported, every slot
});

test("does not plot slots before both systems have reported", () => {
  const s = buildNetGridSeries([{ t: 0, v: -1 }], [{ t: 12 * M, v: 0 }], 0, 30 * M);
  assert.equal(s[0].t, 15 * M);
});

test("export and import areas are continuous across a zero crossing", () => {
  const s = buildNetGridSeries(
    [{ t: 0, v: -1 }, { t: 10 * M, v: 1 }],
    [{ t: 0, v: 0 }],
    0,
    20 * M,
  );
  for (const p of s) {
    assert.equal(typeof p.exp, "number");
    assert.equal(typeof p.imp, "number");
    assert.ok(p.exp >= 0 && p.imp <= 0);
  }
  assert.equal(s.find((p) => p.t === 5 * M)?.exp, 1);
  assert.equal(s.find((p) => p.t === 10 * M)?.imp, -1);
});

test("ignores non-finite samples and empty windows", () => {
  assert.deepEqual(buildNetGridSeries([{ t: 0, v: NaN }], [{ t: 0, v: 1 }], 0, 10 * M), []);
  assert.deepEqual(buildNetGridSeries([{ t: 0, v: 1 }], [{ t: 0, v: 1 }], 10, 10), []);
});
