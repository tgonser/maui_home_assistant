import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSceneConfig, sceneSlug } from "./scenes.ts";
import { lightGroup } from "./houseMap.ts";

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) =>
  ({ entity_id, state, attributes, last_changed: "", last_updated: "" });

test("sceneSlug is stable and prefixed", () => {
  assert.equal(sceneSlug("Master reading"), "wall_master_reading");
  assert.equal(sceneSlug("Mākena sunset!"), "wall_makena_sunset");
  assert.equal(sceneSlug("  "), "wall_scene");
});

test("buildSceneConfig keeps brightness and shade position, skips unavailable", () => {
  const c = buildSceneConfig("Dinner", [
    st("light.a", "on", { brightness: 128 }),
    st("light.b", "off", { brightness: null }),
    st("light.c", "unavailable"),
    st("cover.s", "open", { current_position: 60 }),
  ]);
  assert.equal(c.id, "wall_dinner");
  assert.deepEqual(c.entities["light.a"], { state: "on", brightness: 128 });
  assert.deepEqual(c.entities["light.b"], { state: "off" });
  assert.equal("light.c" in c.entities, false);
  assert.deepEqual(c.entities["cover.s"], { state: "open", current_position: 60 });
});

test("outside lights get their own groups", () => {
  assert.equal(lightGroup("light.floor_1_exterior_great_room_lanai_cove"), "ext_lanai");
  assert.equal(lightGroup("light.floor_1_exterior_great_rm_lanai_downlights"), "ext_lanai");
  assert.equal(lightGroup("light.floor_2_exterior_bed_4_lanai_sconces"), "ext_suites");
  assert.equal(lightGroup("light.floor_1_lp2_unknown_loads_2_6_2"), "ext_master");
  assert.equal(lightGroup("light.floor_1_lp2_unknown_loads_2_1_1"), null);
});
