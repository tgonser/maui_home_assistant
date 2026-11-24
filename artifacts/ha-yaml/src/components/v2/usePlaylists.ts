import { useEffect, useState } from "react";
import { getApiBase, haWsBatch, type HAState } from "@/lib/ha";
import { parsePlaylists, PLAYLIST_CACHE_KEY, spotifyEntity, type Playlist } from "@/lib/spotify";

/** T2's Spotify playlists. HA can only list them while Spotify is active, so a
 *  fresh list is saved to the wall server and every tablet falls back to that
 *  shared copy (then to its own cache). */
export function usePlaylists(states: Map<string, HAState>): { spId: string | undefined; lists: Playlist[] } {
  const spId = spotifyEntity(states)?.entity_id;
  const [lists, setLists] = useState<Playlist[]>(() => { try { return JSON.parse(localStorage.getItem(PLAYLIST_CACHE_KEY) ?? "[]") as Playlist[]; } catch { return []; } });
  useEffect(() => {
    if (!spId) return;
    let live = true;
    const keep = (got: Playlist[]) => { if (!live || !got.length) return; setLists(got); try { localStorage.setItem(PLAYLIST_CACHE_KEY, JSON.stringify(got)); } catch { /* ignore */ } };
    const shared = `${getApiBase()}/api/spotify-playlists`;
    void haWsBatch([{ type: "media_player/browse_media", entity_id: spId, media_content_type: "current_user_playlists", media_content_id: "current_user_playlists" }]).then(async (r) => {
      const got = r.ok && r.results[0]?.success ? parsePlaylists(r.results[0].result) : [];
      if (got.length) {
        keep(got);
        void fetch(shared, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playlists: got }) }).catch(() => undefined);
        return;
      }
      try {
        const j = (await fetch(shared).then((x) => x.json())) as { playlists?: Playlist[] };
        if (j.playlists?.length) keep(j.playlists);
        else {
          // Server has none yet: share this tablet's own cached list.
          const mine = JSON.parse(localStorage.getItem(PLAYLIST_CACHE_KEY) ?? "[]") as Playlist[];
          if (mine.length) void fetch(shared, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playlists: mine }) }).catch(() => undefined);
        }
      } catch { /* ignore */ }
    });
    return () => { live = false; };
  }, [spId]);
  return { spId, lists };
}
