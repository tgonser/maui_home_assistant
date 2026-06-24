import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ── Add-on config ──────────────────────────────────────────────────────────────
// Tells the frontend whether it is running inside an HA add-on so it can
// auto-connect using the supervisor token (which never leaves the server).
router.get("/addon-config", (_req, res) => {
  if (process.env.SUPERVISOR_TOKEN) {
    res.json({ addon: true });
  } else {
    res.json({ addon: false });
  }
});

// ── Supervisor helpers ─────────────────────────────────────────────────────────
// When running as an HA add-on the server has SUPERVISOR_TOKEN and can reach
// HA at http://supervisor/core.  The client signals this by sending
// url="__supervisor__" — the browser never sees the real token.
const SUPERVISOR_URL = "http://supervisor/core";

function resolveHaCredentials(clientUrl: unknown, clientToken: unknown) {
  if (clientUrl === "__supervisor__") {
    const tok = process.env.SUPERVISOR_TOKEN;
    if (!tok) return { err: "SUPERVISOR_TOKEN not set — not running as HA add-on" };
    return { url: SUPERVISOR_URL, token: tok };
  }
  if (typeof clientUrl !== "string" || !clientUrl) return { err: "Missing 'url'" };
  if (typeof clientToken !== "string" || !clientToken) return { err: "Missing 'token'" };
  return { url: clientUrl, token: clientToken };
}

router.post("/ha/call", async (req, res) => {
  const { url: clientUrl, token: clientToken, path, method, body, binary } = req.body ?? {};

  const creds = resolveHaCredentials(clientUrl, clientToken);
  if ("err" in creds) return res.status(400).json({ error: creds.err });
  const { url, token } = creds;

  if (typeof path !== "string" || !path.startsWith("/")) {
    return res.status(400).json({ error: "Missing or invalid 'path'" });
  }

  let base: URL;
  try {
    base = new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid 'url'" });
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") {
    return res.status(400).json({ error: "URL must be http(s)" });
  }

  const target = `${base.origin}${path}`;
  const httpMethod = (typeof method === "string" ? method : "GET").toUpperCase();

  try {
    const upstream = await fetch(target, {
      method: httpMethod,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body:
        httpMethod === "GET" || httpMethod === "HEAD" || body === undefined
          ? undefined
          : JSON.stringify(body),
      // Honeywell TCC and a few other cloud-backed climate integrations
      // routinely take 10-20s to ack a write (HA -> Nabu Casa -> HA -> cloud
      // -> thermostat over a slow IoT channel). 15s was too tight and gave
      // false "Upstream request failed" toasts even when the change had
      // actually applied. 45s covers the slowest real case we've seen
      // without letting the connection hang forever.
      signal: AbortSignal.timeout(45_000),
    });

    if (binary) {
      const buf = Buffer.from(await upstream.arrayBuffer());
      const contentType =
        upstream.headers.get("content-type") ?? "application/octet-stream";
      const dataUrl = `data:${contentType};base64,${buf.toString("base64")}`;
      return res.status(upstream.status).json({
        ok: upstream.ok,
        status: upstream.status,
        data: dataUrl,
      });
    }

    const text = await upstream.text();
    let parsed: unknown = text;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    return res.status(upstream.status).json({
      ok: upstream.ok,
      status: upstream.status,
      data: parsed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err, target }, "HA proxy request failed");
    return res
      .status(502)
      .json({ error: "Upstream request failed", detail: message });
  }
});

type WsCommand = Record<string, unknown> & { type: string };

router.post("/ha/ws-batch", async (req, res) => {
  const { url: clientUrl, token: clientToken, commands } = req.body ?? {};

  const creds = resolveHaCredentials(clientUrl, clientToken);
  if ("err" in creds) return res.status(400).json({ error: creds.err });
  const { url, token } = creds;

  if (!Array.isArray(commands) || commands.length === 0) {
    return res.status(400).json({ error: "Missing 'commands'" });
  }

  let base: URL;
  try {
    base = new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid 'url'" });
  }
  const wsScheme = base.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${wsScheme}//${base.host}/api/websocket`;

  type Result = {
    id: number;
    type: string;
    success: boolean;
    result?: unknown;
    error?: { code: string; message: string };
  };

  const results: Result[] = [];

  try {
    const ws = new WebSocket(wsUrl);
    const overall = AbortSignal.timeout(60_000);
    overall.addEventListener("abort", () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    });

    let nextId = 1;
    let authed = false;
    const pending = new Map<number, (r: Result) => void>();

    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("error", (e) => {
        reject(new Error(`WS error: ${(e as ErrorEvent).message ?? "unknown"}`));
      });
      ws.addEventListener("close", () => {
        if (!authed) reject(new Error("WS closed before auth"));
      });
      ws.addEventListener("message", async (ev) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        if (msg.type === "auth_required") {
          ws.send(JSON.stringify({ type: "auth", access_token: token }));
          return;
        }
        if (msg.type === "auth_invalid") {
          reject(new Error("HA rejected token"));
          return;
        }
        if (msg.type === "auth_ok") {
          authed = true;
          try {
            for (const cmd of commands as WsCommand[]) {
              const id = nextId++;
              const payload = { ...cmd, id };
              const result = await new Promise<Result>((r) => {
                pending.set(id, r);
                ws.send(JSON.stringify(payload));
              });
              results.push(result);
            }
          } catch (err) {
            reject(err);
            return;
          } finally {
            ws.close();
          }
          resolve();
          return;
        }
        if (msg.type === "result" && typeof msg.id === "number") {
          const cb = pending.get(msg.id);
          if (cb) {
            pending.delete(msg.id);
            cb({
              id: msg.id,
              type: "result",
              success: msg.success === true,
              result: msg.result,
              error: msg.error as Result["error"],
            });
          }
        }
      });
    });

    return res.json({ ok: true, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err, wsUrl }, "HA WS batch failed");
    return res
      .status(502)
      .json({ ok: false, error: "WS request failed", detail: message, results });
  }
});

export default router;
