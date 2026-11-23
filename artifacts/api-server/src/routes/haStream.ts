import { Router, type IRouter } from "express";
import { resolveHaCredentials } from "./ha";
import { shouldStreamEntity } from "../lib/streamFilter";

// Live state push for the wall tablets.
//
// POST /api/ha/stream  { url, token }  →  newline-delimited JSON, one line per
// change: {"e":"light.kitchen","s":{...new state...}} (s is null when an
// entity is removed). A {"hb":1} line is sent every 20 s so the tablet can
// tell a quiet house from a dead connection. Each tablet gets its own
// upstream Home Assistant websocket; it closes when the tablet disconnects.
const router: IRouter = Router();
const HEARTBEAT_MS = 20_000;

router.post("/ha/stream", (req, res) => {
  const creds = resolveHaCredentials(req.body?.url, req.body?.token);
  if ("err" in creds) {
    res.status(400).json({ error: creds.err });
    return;
  }
  let base: URL;
  try {
    base = new URL(creds.url);
  } catch {
    res.status(400).json({ error: "Invalid 'url'" });
    return;
  }
  const wsScheme = base.protocol === "https:" ? "wss:" : "ws:";
  const basePath = base.pathname === "/" ? "" : base.pathname.replace(/\/$/, "");
  const wsUrl = `${wsScheme}//${base.host}${basePath}/api/websocket`;

  res.status(200);
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let closed = false;
  const ws = new WebSocket(wsUrl);
  const write = (obj: unknown) => {
    if (!closed) res.write(JSON.stringify(obj) + "\n");
  };
  const end = (reason?: string) => {
    if (closed) return;
    if (reason) write({ end: reason });
    closed = true;
    clearInterval(hb);
    try { ws.close(); } catch { /* ignore */ }
    res.end();
  };
  const hb = setInterval(() => write({ hb: 1 }), HEARTBEAT_MS);

  req.on("close", () => end());
  ws.addEventListener("error", () => end("upstream error"));
  ws.addEventListener("close", () => end("upstream closed"));
  ws.addEventListener("message", (ev) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    if (msg.type === "auth_required") {
      ws.send(JSON.stringify({ type: "auth", access_token: creds.token }));
    } else if (msg.type === "auth_invalid") {
      end("auth rejected");
    } else if (msg.type === "auth_ok") {
      ws.send(JSON.stringify({ id: 1, type: "subscribe_events", event_type: "state_changed" }));
      write({ ready: 1 });
    } else if (msg.type === "event") {
      const data = (msg.event as { data?: { entity_id?: string; new_state?: unknown } } | undefined)?.data;
      const id = data?.entity_id;
      if (typeof id === "string" && shouldStreamEntity(id)) {
        write({ e: id, s: data?.new_state ?? null });
      }
    }
  });
});

export default router;
