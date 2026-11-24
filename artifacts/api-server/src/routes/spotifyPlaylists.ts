import { Router, type IRouter } from "express";
import { readStore, writeStore } from "../fileStore";

// Shared copy of T2's Spotify playlist list. HA's Spotify entity can only list
// playlists while the account is active, so whichever tablet last saw the list
// saves it here and every tablet (and the wake-up screen) can use it.

const router: IRouter = Router();
const FILE = "spotify-playlists";

type Playlist = { title: string; uri: string };

export function cleanPlaylists(input: unknown): Playlist[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 300) return null;
  const out: Playlist[] = [];
  for (const p of input) {
    const title = typeof p?.title === "string" ? p.title.trim().slice(0, 200) : "";
    const uri = typeof p?.uri === "string" ? p.uri.trim() : "";
    if (!title || !/^spotify:[A-Za-z0-9:_-]{1,200}$/.test(uri)) return null;
    out.push({ title, uri });
  }
  return out;
}

router.get("/spotify-playlists", (_req, res) => {
  const s = readStore(FILE);
  try { return res.json({ playlists: JSON.parse(s.json ?? "[]"), savedAt: s.savedAt ?? null }); }
  catch { return res.json({ playlists: [], savedAt: null }); }
});

router.put("/spotify-playlists", (req, res) => {
  const list = cleanPlaylists(req.body?.playlists);
  if (!list) return res.status(400).json({ error: "Invalid playlists" });
  writeStore(FILE, { json: JSON.stringify(list), savedAt: new Date().toISOString() });
  return res.json({ ok: true, count: list.length });
});

export default router;
