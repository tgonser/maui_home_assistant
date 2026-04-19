import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/ha/call", async (req, res) => {
  const { url, token, path, method, body } = req.body ?? {};

  if (typeof url !== "string" || !url) {
    return res.status(400).json({ error: "Missing 'url'" });
  }
  if (typeof token !== "string" || !token) {
    return res.status(400).json({ error: "Missing 'token'" });
  }
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
      signal: AbortSignal.timeout(15_000),
    });

    const text = await upstream.text();
    let parsed: unknown = text;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    res.status(upstream.status).json({
      ok: upstream.ok,
      status: upstream.status,
      data: parsed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err, target }, "HA proxy request failed");
    res.status(502).json({ error: "Upstream request failed", detail: message });
  }
});

export default router;
