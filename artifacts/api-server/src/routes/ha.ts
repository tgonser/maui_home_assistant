import { Router, type IRouter, type Request } from "express";
import {
  createStormPrepSession,
  isSensitiveStormPrepCall,
  isSensitiveStormPrepWsCommand,
  isProtectedStormPrepTransport,
  isStormPrepPinConfigured,
  potentialStormPrepControlEntityIds,
  potentialStormPrepWsControlEntityIds,
  stormPrepSessionCookie,
  stormPrepSessionExpiry,
  verifyStormPrepPin,
} from "../lib/stormPrepSecurity";

const router: IRouter = Router();
const failedPinAttempts = new Map<
  string,
  { count: number; blockedUntil: number }
>();
const MAX_PIN_ATTEMPTS = 5;
const PIN_BLOCK_MS = 5 * 60 * 1000;
const PROTECTED_CONTROL_HELPERS = [
  "input_text.maui_storm_prep_control_entity",
  "input_text.maui_storm_prep_verified_control",
  "input_text.maui_storm_prep_requested_control",
  "input_text.maui_storm_prep_previous_entity",
  "input_text.maui_storm_prep_control_entity_2",
  "input_text.maui_storm_prep_verified_control_2",
  "input_text.maui_storm_prep_requested_control_2",
  "input_text.maui_storm_prep_previous_entity_2",
] as const;
const protectedControlCache = new Map<
  string,
  { expiresAt: number; entityIds: Set<string> }
>();

function hasStormPrepSession(cookieHeader: string | undefined): boolean {
  return stormPrepSessionExpiry(cookieHeader) !== undefined;
}

function hasProtectedStormPrepTransport(req: Request): boolean {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const ingressPath = req.headers["x-ingress-path"];
  return isProtectedStormPrepTransport({
    encrypted: req.secure || Boolean((req.socket as { encrypted?: boolean }).encrypted),
    remoteAddress: req.socket.remoteAddress,
    forwardedProto: Array.isArray(forwardedProto)
      ? forwardedProto.join(",")
      : forwardedProto,
    ingressPath: Array.isArray(ingressPath)
      ? ingressPath[0]
      : ingressPath,
    replitProxy: Boolean(process.env.REPL_ID),
  });
}

function stormPrepAccessError(
  cookieHeader: string | undefined,
  protectedTransport: boolean,
): { status: number; code: string; error: string } | undefined {
  if (!protectedTransport) {
    return {
      status: 426,
      code: "STORM_PREP_SECURE_TRANSPORT_REQUIRED",
      error:
        "Storm-prep controls require HTTPS or secure Home Assistant ingress",
    };
  }
  if (!isStormPrepPinConfigured()) {
    return {
      status: 503,
      code: "STORM_PREP_PIN_NOT_CONFIGURED",
      error: "Configure a six-character-or-longer homeowner PIN in the add-on options",
    };
  }
  if (!hasStormPrepSession(cookieHeader)) {
    return {
      status: 403,
      code: "STORM_PREP_LOCKED",
      error: "Homeowner PIN unlock required for storm-prep controls",
    };
  }
  return undefined;
}

async function loadProtectedStormPrepControls(
  baseUrl: string,
  token: string,
): Promise<{ ok: true; entityIds: Set<string> } | { ok: false }> {
  const cached = protectedControlCache.get(baseUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, entityIds: cached.entityIds };
  }
  try {
    const responses = await Promise.all(
      PROTECTED_CONTROL_HELPERS.map((entityId) =>
        fetch(`${baseUrl}/api/states/${entityId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(5_000),
        }),
      ),
    );
    const entityIds = new Set<string>();
    for (const response of responses) {
      if (response.status === 404) continue;
      if (!response.ok) return { ok: false };
      const state = (await response.json()) as { state?: unknown };
      if (
        typeof state.state === "string" &&
        /^(number|select|switch)\.[a-z0-9_]+$/i.test(state.state)
      ) {
        entityIds.add(state.state);
      }
    }
    protectedControlCache.set(baseUrl, {
      expiresAt: Date.now() + 5_000,
      entityIds,
    });
    return { ok: true, entityIds };
  } catch {
    return { ok: false };
  }
}

// ── Add-on config ──────────────────────────────────────────────────────────────
// Tells the frontend whether it is running inside an HA add-on so it can
// auto-connect using the supervisor token (which never leaves the server).
router.get("/addon-config", (_req, res) => {
  if (process.env.SUPERVISOR_TOKEN) {
    res.json({
      addon: true,
      stormPrepPinConfigured: isStormPrepPinConfigured(),
    });
  } else {
    res.json({
      addon: false,
      stormPrepPinConfigured: isStormPrepPinConfigured(),
    });
  }
});

router.get("/ha/storm-prep/security", (req, res) => {
  const secureTransport = hasProtectedStormPrepTransport(req);
  const expiresAt = secureTransport
    ? stormPrepSessionExpiry(req.headers.cookie)
    : undefined;
  res.setHeader("Cache-Control", "no-store");
  res.json({
    pinConfigured: isStormPrepPinConfigured(),
    secureTransport,
    unlocked: expiresAt !== undefined,
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
  });
});

router.post("/ha/storm-prep/unlock", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!hasProtectedStormPrepTransport(req)) {
    return res.status(426).json({
      ok: false,
      code: "STORM_PREP_SECURE_TRANSPORT_REQUIRED",
      error:
        "Open the kiosk over HTTPS or secure Home Assistant ingress before entering the homeowner PIN",
    });
  }
  if (!isStormPrepPinConfigured()) {
    return res.status(503).json({
      ok: false,
      code: "STORM_PREP_PIN_NOT_CONFIGURED",
      error: "Configure a six-character-or-longer homeowner PIN in the add-on options",
    });
  }

  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const attempts = failedPinAttempts.get(key);
  if (attempts && attempts.count >= MAX_PIN_ATTEMPTS && attempts.blockedUntil > now) {
    return res.status(429).json({
      ok: false,
      code: "STORM_PREP_PIN_RATE_LIMITED",
      error: "Too many incorrect PIN attempts; try again in five minutes",
    });
  }
  if (attempts && attempts.blockedUntil <= now) failedPinAttempts.delete(key);

  if (!verifyStormPrepPin(req.body?.pin)) {
    const nextCount = (failedPinAttempts.get(key)?.count ?? 0) + 1;
    failedPinAttempts.set(key, {
      count: nextCount,
      blockedUntil: now + PIN_BLOCK_MS,
    });
    return res.status(403).json({
      ok: false,
      code: "STORM_PREP_PIN_INCORRECT",
      error: "Incorrect homeowner PIN",
    });
  }

  failedPinAttempts.delete(key);
  const session = createStormPrepSession(now);
  res.setHeader("Set-Cookie", stormPrepSessionCookie(session.value));
  return res.json({
    ok: true,
    unlocked: true,
    secureTransport: true,
    expiresAt: new Date(session.expiresAt).toISOString(),
  });
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

  if (isSensitiveStormPrepCall(path, body)) {
    const accessError = stormPrepAccessError(
      req.headers.cookie,
      hasProtectedStormPrepTransport(req),
    );
    if (accessError) {
      return res.status(accessError.status).json({
        ok: false,
        code: accessError.code,
        error: accessError.error,
      });
    }
  }

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

  // Use base.origin + base.pathname so that supervisor URLs like
  // http://supervisor/core correctly become http://supervisor/core/api/states
  // (base.origin alone would drop the /core path segment).
  const basePath = base.pathname === "/" ? "" : base.pathname.replace(/\/$/, "");
  const baseUrl = `${base.origin}${basePath}`;
  const target = `${baseUrl}${path}`;
  const httpMethod = (typeof method === "string" ? method : "GET").toUpperCase();

  const possibleControlIds = potentialStormPrepControlEntityIds(path, body);
  if (possibleControlIds.length > 0) {
    const protectedControls = await loadProtectedStormPrepControls(
      baseUrl,
      token,
    );
    if (
      !protectedControls.ok ||
      possibleControlIds.some((entityId) =>
        protectedControls.entityIds.has(entityId),
      )
    ) {
      const accessError = stormPrepAccessError(
        req.headers.cookie,
        hasProtectedStormPrepTransport(req),
      );
      if (accessError) {
        return res.status(accessError.status).json({
          ok: false,
          code: accessError.code,
          error: accessError.error,
        });
      }
    }
  }

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

    if (
      upstream.ok &&
      typeof path === "string" &&
      path.startsWith("/api/services/input_")
    ) {
      protectedControlCache.delete(baseUrl);
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
  if (commands.some((command) => isSensitiveStormPrepWsCommand(command))) {
    const accessError = stormPrepAccessError(
      req.headers.cookie,
      hasProtectedStormPrepTransport(req),
    );
    if (accessError) {
      return res.status(accessError.status).json({
        ok: false,
        code: accessError.code,
        error: accessError.error,
        results: [],
      });
    }
  }

  let base: URL;
  try {
    base = new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid 'url'" });
  }
  const wsScheme = base.protocol === "https:" ? "wss:" : "ws:";
  const wBasePath = base.pathname === "/" ? "" : base.pathname.replace(/\/$/, "");
  const wsUrl = `${wsScheme}//${base.host}${wBasePath}/api/websocket`;
  const httpBaseUrl = `${base.origin}${wBasePath}`;

  const possibleControlIds = commands.flatMap((command) =>
    potentialStormPrepWsControlEntityIds(command),
  );
  if (possibleControlIds.length > 0) {
    const protectedControls = await loadProtectedStormPrepControls(
      httpBaseUrl,
      token,
    );
    if (
      !protectedControls.ok ||
      possibleControlIds.some((entityId) =>
        protectedControls.entityIds.has(entityId),
      )
    ) {
      const accessError = stormPrepAccessError(
        req.headers.cookie,
        hasProtectedStormPrepTransport(req),
      );
      if (accessError) {
        return res.status(accessError.status).json({
          ok: false,
          code: accessError.code,
          error: accessError.error,
          results: [],
        });
      }
    }
  }

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

    let nextId = 1;
    let authed = false;
    const pending = new Map<number, (r: Result) => void>();

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve();
      };
      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        reject(err);
      };
      const timeoutId = setTimeout(() => {
        fail(new Error("HA WebSocket command timed out after 60 seconds"));
        try {
          ws.close();
        } catch {
          // ignore
        }
      }, 60_000);

      ws.addEventListener("error", (e) => {
        fail(new Error(`WS error: ${(e as ErrorEvent).message ?? "unknown"}`));
      });
      ws.addEventListener("close", () => {
        if (!authed) {
          fail(new Error("WS closed before auth"));
        } else if (pending.size > 0) {
          fail(
            new Error(
              `HA WebSocket closed with ${pending.size} command${
                pending.size === 1 ? "" : "s"
              } still pending`,
            ),
          );
        }
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
          fail(new Error("HA rejected token"));
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
            fail(err instanceof Error ? err : new Error("WS command failed"));
            return;
          } finally {
            ws.close();
          }
          finish();
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
