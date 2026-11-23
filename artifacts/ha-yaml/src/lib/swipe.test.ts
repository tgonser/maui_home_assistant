import { test } from "node:test";
import assert from "node:assert/strict";
import { swipeDirection } from "./swipe.ts";

test("swipeDirection", () => {
  assert.equal(swipeDirection(-150, 10, 250), 1);
  assert.equal(swipeDirection(150, -20, 250), -1);
  assert.equal(swipeDirection(-60, 0, 200), 0);     // too short
  assert.equal(swipeDirection(-150, 120, 250), 0);  // diagonal scroll
  assert.equal(swipeDirection(-150, 0, 1200), 0);   // slow drag
});
