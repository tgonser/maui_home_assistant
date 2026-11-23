import { test } from "node:test";
import assert from "node:assert/strict";
import { applyChange, takeLines } from "./liveStatesCore.ts";

test("takeLines keeps a partial line for the next chunk", () => {
  const { lines, rest } = takeLines('{"hb":1}\n{"e":"light.a","s":null}\n{"e":"li');
  assert.deepEqual(lines, [{ hb: 1 }, { e: "light.a", s: null }]);
  assert.equal(rest, '{"e":"li');
});

test("takeLines skips blank and malformed lines", () => {
  const { lines } = takeLines('\n{bad\n{"ready":1}\n');
  assert.deepEqual(lines, [{ ready: 1 }]);
});

test("applyChange sets, replaces and removes without mutating", () => {
  const s = (state: string) => ({ entity_id: "light.a", state, attributes: {}, last_changed: "", last_updated: "" });
  const a = new Map([["light.a", s("off")]]);
  const b = applyChange(a, "light.a", s("on"));
  assert.equal(a.get("light.a")?.state, "off");
  assert.equal(b.get("light.a")?.state, "on");
  assert.equal(applyChange(b, "light.a", null).has("light.a"), false);
});
