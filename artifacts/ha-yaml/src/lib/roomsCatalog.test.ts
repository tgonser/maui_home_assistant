import { test } from "node:test";
import assert from "node:assert/strict";
import { lightName, parseRole, roomLights, roomsFor, ROOMS } from "./roomsCatalog.ts";

const st = (entity_id: string, state: string, friendly: string) =>
  ({ entity_id, state, attributes: { friendly_name: friendly }, last_changed: "", last_updated: "" });

test("lightName drops floor and suite prefixes", () => {
  assert.equal(lightName(st("light.x", "on", "Floor 2 Bedroom 4 Suite Bed 4 Bath Toe Kicks")), "Bath toe kicks");
  assert.equal(lightName(st("light.x", "on", "Floor 1 Great Room Kitchen Island Pendants")), "Kitchen island pendants");
});

test("guests never see the master suite", () => {
  const ids = roomsFor({ kind: "guest", room: "molokini" }).map((r) => r.id);
  assert.ok(ids.includes("molokini") && ids.includes("great"));
  assert.ok(!ids.includes("master") && !ids.includes("sitting") && !ids.includes("ext_master"));
  assert.equal(roomsFor({ kind: "owner" }).length, ROOMS.length);
});

test("parseRole only accepts guest suites", () => {
  assert.deepEqual(parseRole('{"kind":"guest","room":"molokini"}'), { kind: "guest", room: "molokini" });
  assert.deepEqual(parseRole('{"kind":"guest","room":"master"}'), { kind: "owner" });
  assert.deepEqual(parseRole("garbage"), { kind: "owner" });
  assert.deepEqual(parseRole(null), { kind: "owner" });
});

test("roomLights picks the suite and its bath", () => {
  const m = new Map([
    st("light.floor_2_bedroom_4_suite_bed_4_bed_downlights", "off", "Floor 2 Bedroom 4 Suite Bed 4 Bed Downlights"),
    st("light.floor_2_bedroom_4_suite_bed_4_bath_toe_kicks", "on", "Floor 2 Bedroom 4 Suite Bed 4 Bath Toe Kicks"),
    st("light.floor_2_bedroom_5_suite_bed_5_bed_downlights", "on", "x"),
  ].map((s) => [s.entity_id, s]));
  const molokini = ROOMS.find((r) => r.id === "molokini")!;
  assert.equal(roomLights(m, molokini).length, 2);
});
