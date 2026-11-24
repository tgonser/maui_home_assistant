import { useEffect, useState } from "react";
import { haWsBatch, type HAState } from "@/lib/ha";
import { parsePlaylists, PLAYLIST_CACHE_KEY, spotifyEntity, type Playlist } from "@/lib/spotify";

/** T2's Spotify playlists (cached on the tablet, refreshed on open). */
export function usePlaylists(states: Map<string, HAState>): { spId: string | undefined; lists: Playlist[] } {
  const spId = spotifyEntity(states)?.entity_id;
  const [lists, setLists] = useState<Playlist[]>(() => { try { return JSON.parse(localStorage.getItem(PLAYLIST_CACHE_KEY) ?? "[]") as Playlist[]; } catch { return []; } });
  useEffect(() => {
    if (!spId) return;
    void haWsBatch([{ type: "media_player/browse_media", entity_id: spId, media_content_type: "current_user_playlists", media_content_id: "current_user_playlists" }]).then((r) => {
      const got = r.ok && r.results[0]?.success ? parsePlaylists(r.results[0].result) : [];
      if (got.length) { setLists(got); try { localStorage.setItem(PLAYLIST_CACHE_KEY, JSON.stringify(got)); } catch { /* ignore */ } }
    });
  }, [spId]);
  return { spId, lists };
}
