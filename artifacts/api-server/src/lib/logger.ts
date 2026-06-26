import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

// In production use pino.destination() (SonicBoom → no worker threads).
// In dev use pino-pretty transport (spawns a thread, which is fine locally).
export const logger = isProduction
  ? pino(
      {
        level: process.env.LOG_LEVEL ?? "info",
        redact: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers['set-cookie']",
        ],
      },
      pino.destination(1),
    )
  : pino({
      level: process.env.LOG_LEVEL ?? "info",
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers['set-cookie']",
      ],
      transport: {
        target: "pino-pretty",
        options: { colorize: true },
      },
    });
