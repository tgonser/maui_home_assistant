import { test } from "node:test";
import assert from "node:assert/strict";
import { cameraName, listCameras } from "./cameras.ts";

const st = (entity_id: string, state: string, friendly: string) =>
  ({ entity_id, state, attributes: { friendly_name: friendly }, last_changed: "", last_updated: "" });

test("cameraName strips channel and model", () => {
  assert.equal(cameraName("Master Lanai G6 PTZ High resolution channel"), "Master Lanai");
  assert.equal(cameraName("Mud room door hub - Entry Medium resolution channel"), "Mud room door hub");
  assert.equal(cameraName("G6 Instant High resolution channel"), "G6 Instant");
  assert.equal(cameraName("G6 Pro Entry High resolution channel"), "Entry");
});

test("listCameras keeps one live channel per camera", () => {
  const m = new Map([
    st("camera.mud_room_door_hub_entry_medium_resolution_channel", "recording", "Mud room door hub - Entry Medium resolution channel"),
    st("camera.mud_room_door_hub_entry_high_resolution_channel", "unavailable", "Mud room door hub - Entry High resolution channel"),
    st("camera.garage_g5_ptz_high_resolution_channel", "unavailable", "Garage G5 PTZ High resolution channel"),
    st("camera.bbq_g6_ptz_high_resolution_channel", "idle", "BBQ G6 PTZ High resolution channel"),
  ].map((s) => [s.entity_id, s]));
  const c = listCameras(m);
  assert.equal(c.length, 3);
  assert.equal(c.find((x) => x.name.startsWith("Mud"))?.id, "camera.mud_room_door_hub_entry_medium_resolution_channel");
  assert.equal(c.find((x) => x.name === "BBQ")?.motionId, "binary_sensor.bbq_g6_ptz_motion");
  assert.equal(c[c.length - 1].available, false);
});

test("duplicate clean names keep their model", () => {
  const m = new Map([
    st("camera.entry_g6_ptz_high_resolution_channel", "recording", "Entry G6 PTZ High resolution channel"),
    st("camera.g6_pro_entry_high_resolution_channel", "recording", "G6 Pro Entry High resolution channel"),
  ].map((s) => [s.entity_id, s]));
  const names = listCameras(m).map((c) => c.name).sort();
  assert.deepEqual(names, ["Entry G6 PTZ", "G6 Pro Entry"]);
});
