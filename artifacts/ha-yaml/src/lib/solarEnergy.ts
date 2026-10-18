import { hstDayStartMs } from "./gridCost.ts";

// Main Envoy, confirmed by the 2026-09-30 survey. Native today/week readings
// (25948.87 kWh in that survey) are not inputs to the period calculator.
export const SOLAR_SOURCE_IDS = {
  live: "sensor.envoy_202445013483_current_power_production",
  today: "sensor.envoy_202445013483_energy_production_today",
  sevenDay: "sensor.envoy_202445013483_energy_production_last_seven_days",
  lifetime: "sensor.envoy_202445013483_lifetime_energy_production",
} as const;

export const SOLAR_HOUR_MS = 60 * 60 * 1000;
export const SOLAR_REFRESH_MS = 300_000;
export const SOLAR_STALE_MS = 600_000;

export type SolarStatisticPoint = {
  start: string | number;
  end: string | number;
  sum?: number;
  state?: number;
};

export type SolarSnapshot = {
  points: SolarStatisticPoint[];
  unit: string;
  fetchedAtMs: number;
  requestedAtMs: number;
};

export type SolarPeriodTotal = {
  kwh: number | null;
  status: "ready" | "unavailable" | "incomplete" | "stale";
  detail: string;
  throughMs: number | null;
};

export function solarWindow(nowMs: number) {
  const dayStartMs = hstDayStartMs(nowMs);
  const weekStartMs = dayStartMs - 6 * 24 * SOLAR_HOUR_MS;
  return {
    dayStartMs,
    weekStartMs,
    throughMs: Math.floor(nowMs / SOLAR_HOUR_MS) * SOLAR_HOUR_MS,
    requestStartMs: weekStartMs - SOLAR_HOUR_MS,
  };
}

/** Accept numeric HA states, but never parse partial strings or coerce null. */
export function energyToKwh(value: unknown, unit: unknown): number | null {
  const factor = unit === "Wh" ? 0.001 : unit === "kWh" ? 1 : unit === "MWh" ? 1000 : null;
  if (factor === null) return null;
  let numeric: number;
  if (typeof value === "number") {
    numeric = value;
  } else if (
    typeof value === "string" &&
    /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())
  ) {
    numeric = Number(value.trim());
  } else {
    return null;
  }
  const converted = numeric * factor;
  return Number.isFinite(converted) ? converted : null;
}

function timestamp(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && Number.isFinite(new Date(value).getTime())
      ? value
      : null;
  }
  if (typeof value !== "string") return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!parts) return null;
  const [, y, m, d, h, min, s] = parts.map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (m < 1 || m > 12 || d < 1 || d > days || h > 23 || min > 59 || s > 59) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

type Bucket = {
  start: number;
  end: number;
  sum: number;
  state: number;
};

export function calculateSolarPeriods(snapshot: SolarSnapshot | null, nowMs: number): {
  today: SolarPeriodTotal;
  sevenDay: SolarPeriodTotal;
} {
  const window = solarWindow(nowMs);
  const result = (
    status: SolarPeriodTotal["status"],
    detail: string,
    kwh: number | null = null,
  ): SolarPeriodTotal => ({
    kwh,
    status,
    detail,
    throughMs: Number.isFinite(window.throughMs) ? window.throughMs : null,
  });
  const both = (status: SolarPeriodTotal["status"], detail: string) => ({
    today: result(status, detail),
    sevenDay: result(status, detail),
  });
  if (!Number.isFinite(nowMs) || timestamp(nowMs) === null) {
    return both("unavailable", "Invalid current timestamp.");
  }
  if (!snapshot) return both("unavailable", "Lifetime recorder statistics are unavailable.");
  if (
    timestamp(snapshot.fetchedAtMs) === null ||
    timestamp(snapshot.requestedAtMs) === null ||
    snapshot.fetchedAtMs > nowMs ||
    snapshot.requestedAtMs > snapshot.fetchedAtMs
  ) return both("stale", "Recorder snapshot has invalid request or fetch timestamps.");
  if (
    nowMs - snapshot.fetchedAtMs > SOLAR_STALE_MS ||
    hstDayStartMs(snapshot.requestedAtMs) !== window.dayStartMs
  ) return both("stale", "Recorder snapshot is over ten minutes old or was requested on a different Hawaii day.");
  if (energyToKwh(1, snapshot.unit) === null) {
    return both("unavailable", "Recorder energy unit must be Wh, kWh, or MWh.");
  }
  if (!Array.isArray(snapshot.points)) {
    return both("unavailable", "Lifetime recorder statistics are unavailable.");
  }

  const calculate = (periodStart: number): SolarPeriodTotal => {
    if (periodStart === window.throughMs) {
      return result("unavailable", "Awaiting the first completed hourly interval of this Hawaii day.");
    }
    if (snapshot.points.length === 0) {
      return result("unavailable", "Lifetime recorder returned no hourly statistics.");
    }
    const baselineStart = periodStart - SOLAR_HOUR_MS;
    const buckets = new Map<number, Bucket>();
    for (const point of snapshot.points) {
      const start = timestamp(point?.start);
      const end = timestamp(point?.end);
      // An unlocatable malformed point cannot safely be assigned to either period.
      if (start === null || end === null) {
        return result("incomplete", "Recorder contains an invalid hourly timestamp.");
      }
      // Do not use the ongoing hour, future hours, or unrelated older history.
      if (start >= window.throughMs || (end <= baselineStart && start < baselineStart)) continue;
      if (
        start < baselineStart ||
        start % SOLAR_HOUR_MS !== 0 ||
        end % SOLAR_HOUR_MS !== 0 ||
        end - start !== SOLAR_HOUR_MS ||
        end > window.throughMs
      ) return result("incomplete", "Recorder contains an overlapping or non-hourly interval.");
      if (
        typeof point.sum !== "number" || !Number.isFinite(point.sum) ||
        typeof point.state !== "number" || !Number.isFinite(point.state)
      ) return result("incomplete", "Recorder sum or lifetime state is missing or not a finite number.");
      const sum = energyToKwh(point.sum, snapshot.unit);
      const state = energyToKwh(point.state, snapshot.unit);
      if (sum === null || state === null || state < 0) {
        return result("incomplete", "Recorder lifetime energy is invalid.");
      }
      const bucket = { start, end, sum, state };
      const duplicate = buckets.get(start);
      if (duplicate && (
        duplicate.end !== end || duplicate.sum !== sum || duplicate.state !== state
      )) return result("incomplete", "Recorder contains conflicting duplicate hourly buckets.");
      buckets.set(start, bucket);
    }
    let previous = buckets.get(baselineStart);
    if (!previous) {
      return result("incomplete", "Missing immediately preceding hourly baseline; lifetime is not a period total.");
    }
    let total = 0;
    for (let t = periodStart; t < window.throughMs; t += SOLAR_HOUR_MS) {
      const current = buckets.get(t);
      if (!current) {
        return result("incomplete", t === window.throughMs - SOLAR_HOUR_MS
          ? "Recorder is behind the current last completed hour."
          : "Recorder has a gap in the required hourly intervals.");
      }
      const sumDelta = current.sum - previous.sum;
      const stateDelta = current.state - previous.state;
      if (sumDelta < 0 || stateDelta < 0) {
        return result("incomplete", "Recorder sum or lifetime state decreased/reset; energy cannot be inferred.");
      }
      const tolerance = Math.max(
        1e-7,
        64 * Number.EPSILON * Math.max(
          Math.abs(current.sum), Math.abs(previous.sum),
          Math.abs(current.state), Math.abs(previous.state), 1,
        ),
      );
      if (Math.abs(sumDelta - stateDelta) > tolerance) {
        return result("incomplete", "Recorder sum delta disagrees with the lifetime state delta.");
      }
      total += sumDelta;
      previous = current;
    }
    if (!Number.isFinite(total)) return result("incomplete", "Recorder period energy overflowed.");
    return result("ready", "Complete hourly differences from the Main Envoy lifetime recorder.", total);
  };
  return {
    today: calculate(window.dayStartMs),
    sevenDay: calculate(window.weekStartMs),
  };
}