// Daily record of the battery balancer, for the Energy screen.
// Built from Home Assistant history (minimal response: {s, lu} points):
// - "moved" / "bought" are running totals that reset at midnight HST, so a
//   day's figure is that day's highest value;
// - the 5 PM charge sensors change once a day at 5 PM.

export const BALANCE_MOVED = "sensor.maui_balance_moved_today";
export const BALANCE_BOUGHT = "sensor.maui_balance_bought_during_boost_today";
export const SOC5_S1 = "sensor.maui_system_1_charge_at_5_pm";
export const SOC5_S2 = "sensor.maui_system_2_charge_at_5_pm";

export type BalanceDay = { day: string; moved: number | null; bought: number | null; soc1: number | null; soc2: number | null };
type Point = { s: string; lu?: number; lc?: number };

const hstDay = (ms: number) => new Date(ms - 10 * 3600_000).toISOString().slice(0, 10);

function byDay(points: Point[] | undefined, pick: "max" | "last"): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of points ?? []) {
    const v = Number(p.s);
    const t = (p.lc ?? p.lu ?? NaN) * 1000;
    if (!Number.isFinite(v) || !Number.isFinite(t)) continue;
    const d = hstDay(t);
    // The 5 PM sensors are re-recorded on every restart; only a reading taken
    // at 5 PM or later counts for that day.
    if (pick === "last" && new Date(t - 10 * 3600_000).getUTCHours() < 17) continue;
    out.set(d, pick === "max" ? Math.max(out.get(d) ?? 0, v) : v);
  }
  return out;
}

/** Rows for the last `days` days (newest first), from history keyed by entity id. */
export function balanceDays(history: Record<string, Point[]>, nowMs: number, days = 14): BalanceDay[] {
  const moved = byDay(history[BALANCE_MOVED], "max");
  const bought = byDay(history[BALANCE_BOUGHT], "max");
  const s1 = byDay(history[SOC5_S1], "last");
  const s2 = byDay(history[SOC5_S2], "last");
  const rows: BalanceDay[] = [];
  for (let i = 0; i < days; i++) {
    const day = hstDay(nowMs - i * 86_400_000);
    rows.push({ day, moved: moved.get(day) ?? null, bought: bought.get(day) ?? null, soc1: s1.get(day) ?? null, soc2: s2.get(day) ?? null });
  }
  // Drop the oldest days that have no data at all (before tracking began).
  while (rows.length && Object.values(rows[rows.length - 1]).slice(1).every((v) => v == null)) rows.pop();
  return rows;
}
