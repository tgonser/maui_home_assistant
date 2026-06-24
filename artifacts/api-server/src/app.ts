import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import fs from "node:fs";
import path from "node:path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Static file serving for the add-on / self-hosted mode.
// STATIC_DIR points to the Vite build output (artifacts/ha-yaml/dist/public).
const staticDir = process.env.STATIC_DIR;
if (staticDir) {
  // Serve assets (JS, CSS, images) with standard cache headers
  app.use(express.static(staticDir, { index: false }));

  // SPA catch-all: serve index.html for every non-API route, injecting a
  // <base> tag so that root-relative asset/API paths work correctly both
  // through HA ingress (which prefixes a hash path) and via direct access.
  app.get("*", (req: Request, res: Response, _next: NextFunction) => {
    const indexPath = path.join(staticDir, "index.html");
    let html: string;
    try {
      html = fs.readFileSync(indexPath, "utf8");
    } catch {
      res.status(503).send("Frontend not built");
      return;
    }
    // HA ingress sets X-Ingress-Path to the mounted prefix, e.g.
    // /api/hassio_ingress/<hash>  — the browser resolves all paths relative to
    // this base, so we inject it so React Router and fetch() work correctly.
    const ingressPath = (req.headers["x-ingress-path"] as string | undefined) ?? "";
    const basePath = ingressPath ? `${ingressPath}/` : "/";
    html = html.replace("<head>", `<head><base href="${basePath}">`);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  });
}

export default app;
