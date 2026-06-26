import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Allow the module to load without DATABASE_URL so the server can start in
// DB-less environments (e.g. the HA add-on).  Routes that actually call db
// or pool will fail at request time with a clear runtime error, which is
// acceptable — those routes are never reached from the kiosk panel.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _undef: any = undefined;

export const pool: pg.Pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : _undef;

export const db: ReturnType<typeof drizzle<typeof schema>> =
  process.env.DATABASE_URL ? drizzle(pool, { schema }) : _undef;

export * from "./schema";
