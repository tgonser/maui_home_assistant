import { test } from "node:test";
import assert from "node:assert/strict";
import { planSpotify, parsePlaylists, wallPlaylists } from "./spotify.ts";

const st = (entity_id: string, friendly: string) => ({ entity_id, state: "idle", attributes: { friendly_name: friendly }, last_changed: "", last_updated: "" });
const m = new Map([
  st("media_player.great_room_lanai", "Great Room Lanai"),
  st("media_player.master_bed", "Master Bed"),
  st("media_player.molokini_guest_bed", "Molokini Guest Bed"),
  st("media_player.spotify_gonzomatic", "Spotify gonzomatic"),
].map((s) => [s.entity_id, s]));
const sources = ["Great Room Lanai", "Master Bed", "Master Sitting Room"];

test("planSpotify starts on a picked room Spotify can see", () => {
  const p = planSpotify(m, sources, ["media_player.molokini_guest_bed", "media_player.master_bed"]);
  assert.deepEqual(p, { device: "Master Bed", leader: "media_player.master_bed", joiners: ["media_player.molokini_guest_bed"], extraRoom: false });
});

test("planSpotify falls back to any visible speaker and flags the extra room", () => {
  const p = planSpotify(m, sources, ["media_player.molokini_guest_bed"]);
  assert.equal(p?.leader, "media_player.great_room_lanai");
  assert.equal(p?.extraRoom, true);
  assert.equal(planSpotify(m, [], ["media_player.master_bed"]), null);
});

test("parsePlaylists keeps spotify URIs", () => {
  assert.deepEqual(parsePlaylists({ children: [{ title: " MauiCool ", media_content_id: "spotify:playlist:0m" }, { title: "x", media_content_id: "other" }] }), [{ title: "MauiCool", uri: "spotify:playlist:0m" }]);
});

test("wallPlaylists keeps only house-named playlists when there are any", () => {
  const all = [{ title: "MauiCool", uri: "a" }, { title: "Boats", uri: "b" }, { title: "Mākena Morning", uri: "c" }];
  assert.deepEqual(wallPlaylists(all).shown.map((p) => p.title), ["MauiCool", "Mākena Morning"]);
  assert.equal(wallPlaylists([{ title: "Boats", uri: "b" }]).filtered, false);
});
