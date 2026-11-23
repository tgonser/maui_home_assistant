import { test } from "node:test";
import assert from "node:assert/strict";
import { musicGroups, groupFor, pickLeader, describeNowPlaying } from "./music.ts";

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) =>
  ({ entity_id, state, attributes, last_changed: "", last_updated: "" });

test("musicGroups: leader first, solos are groups of one", () => {
  const m = new Map([
    st("media_player.great_room", "playing", { group_members: ["media_player.great_room", "media_player.great_room_lanai"] }),
    st("media_player.great_room_lanai", "playing", { group_members: ["media_player.great_room", "media_player.great_room_lanai"] }),
    st("media_player.master_bed", "idle", { group_members: null }),
  ].map((s) => [s.entity_id, s]));
  const g = musicGroups(m);
  assert.equal(g.length, 2);
  assert.deepEqual(g[0], { leader: "media_player.great_room", members: ["media_player.great_room", "media_player.great_room_lanai"] });
  assert.deepEqual(groupFor(g, "media_player.master_bed")?.members, ["media_player.master_bed"]);
});

test("pickLeader prefers a playing room", () => {
  const m = new Map([st("media_player.master_bed", "idle"), st("media_player.bbq_lanai", "playing")].map((s) => [s.entity_id, s]));
  assert.equal(pickLeader(m, ["media_player.master_bed", "media_player.bbq_lanai"]), "media_player.bbq_lanai");
  assert.equal(pickLeader(m, ["media_player.master_bed"]), "media_player.master_bed");
});

test("describeNowPlaying explains Spotify Connect", () => {
  const d = describeNowPlaying(st("media_player.great_room", "playing", { media_title: "Spotify - playing elsewhere", media_artist: "Lazylife", source: "Spotify" }));
  assert.equal(d.title, "Lazylife");
  assert.match(d.sub, /phone/);
  assert.equal(describeNowPlaying(st("x", "idle", { source: "Spotify" })).title, "Nothing playing");
});
