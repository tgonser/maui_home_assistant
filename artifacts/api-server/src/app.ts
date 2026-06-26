import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import fs from "node:fs";
import path from "node:path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Normalize double-slash URLs (e.g. //wall → /wall).
// HA ingress can produce these when ingress_entry starts with /.
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.url.startsWith("//")) {
    req.url = req.url.replace(/^\/+/, "/");
  }
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
          ingressPath: req.headers["x-ingress-path"],
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

  // SPA catch-all: serve index.html for every non-API route.
  // Under HA ingress, X-Ingress-Path carries the proxy prefix so the
  // client can reconstruct correct absolute URLs.
  app.get("/{*splat}", (req: Request, res: Response, _next: NextFunction) => {
    const indexPath = path.join(staticDir, "index.html");
    let html: string;
    try {
      html = fs.readFileSync(indexPath, "utf8");
    } catch {
      res.status(503).send("Frontend not built");
      return;
    }

    const ingressPath = (req.headers["x-ingress-path"] as string | undefined) ?? "";

    if (ingressPath) {
      // Rewrite root-relative asset paths so they carry the ingress prefix.
      // Vite emits absolute paths (/assets/...) which bypass the <base> tag.
      html = html.replace(/((?:src|href)=")\/(?!\/)/g, `$1${ingressPath}/`);
    }

    // Inject the ingress base as a JS global AND as a <base> tag.
    // The JS global is the reliable source for Wouter's base prop because
    // <base>.getAttribute('href') can return an absolute URL in some browsers.
    const ingressScript = ingressPath
      ? `<script>window.__HA_INGRESS_BASE__=${JSON.stringify(ingressPath)};</script>`
      : "";
    const basePath = ingressPath ? `${ingressPath}/` : "/";
    html = html.replace(
      "<head>",
      `<head><base href="${basePath}">${ingressScript}`,
    );

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  });
}

export default app;
