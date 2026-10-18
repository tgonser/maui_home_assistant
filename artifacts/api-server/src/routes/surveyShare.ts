import { Router, type IRouter } from "express";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const router: IRouter = Router();
const tickets = new Map<string, number>();
// This inbox belongs to the development workspace, never the HA add-on or deployment.
const enabled = () => process.env.NODE_ENV === "development" && Boolean(process.env.REPL_ID) && !process.env.STATIC_DIR;
const folder = path.resolve(process.cwd(), "../../.local/ha-surveys");
router.use("/ha/survey-share", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!enabled()) { res.status(404).json({ error: "Sharing is available only in the connected Replit development Studio. Use Download all here." }); return; }
  const origin = req.get("origin");
  const host = req.get("x-forwarded-host") || req.get("host");
  try {
    if (!origin || new URL(origin).host !== host) {
      res.status(403).json({ error: "Open this action from the development Studio." }); return;
    }
  } catch { res.status(403).json({ error: "Invalid origin." }); return; }
  next();
});
router.post("/ha/survey-share/prepare", (_req, res) => {
  for (const [key, expiry] of tickets) if (expiry < Date.now()) tickets.delete(key);
  if (tickets.size >= 20) { res.status(429).json({ error: "Please wait before trying again." }); return; }
  const ticket = randomBytes(24).toString("hex");
  tickets.set(ticket, Date.now() + 300_000);
  res.json({ ticket });
});
router.post("/ha/survey-share", async (req, res) => {
  const { ticket, reports } = req.body ?? {};
  const expiry = typeof ticket === "string" ? tickets.get(ticket) : undefined;
  if (!expiry || expiry < Date.now()) { res.status(403).json({ error: "Share confirmation expired. Try again." }); return; }
  tickets.delete(ticket);
  if (!reports || typeof reports !== "object" || Array.isArray(reports) ||
      Object.keys(reports).length > 12 || !Object.entries(reports).every(([name, value]) =>
        /^ha_[a-z_]+\.md$/.test(name) && typeof value === "string")) {
    res.status(400).json({ error: "Invalid survey reports." }); return;
  }
  const content = JSON.stringify({ received_at: new Date().toISOString(), reports }, null, 2);
  if (Buffer.byteLength(content) > 8_000_000) { res.status(413).json({ error: "Survey too large; use downloads instead." }); return; }
  try {
    await mkdir(folder, { recursive: true, mode: 0o700 });
    if ((await readdir(folder)).length >= 20) {
      res.status(409).json({ error: "Survey inbox is full. Ask the agent to remove older snapshots before sharing again." }); return;
    }
    const name = `${randomUUID()}.json`;
    await writeFile(path.join(folder, name), content, { flag: "wx", mode: 0o600 });
    res.json({ ok: true, reference: `.local/ha-surveys/${name}` });
  } catch {
    res.status(500).json({ error: "Could not save survey. Nothing was sent to Home Assistant." });
  }
});
export default router;
