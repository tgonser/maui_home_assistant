export const GRID_RATES = {
  sell: 0.04,
  offPeak: 0.17,
  peak: 0.52,
  midPeak: 0.35,
} as const;

export const GRID_IMPORT_STAT_IDS = [
  "sensor.gonser_4680_system_1_grid_imported",
  "sensor.4680_system_2_grid_imported",
] as const;

export const GRID_EXPORT_STAT_IDS = [
  "sensor.gonser_4680_system_1_grid_exported",
  "sensor.4680_system_2_grid_exported",
] as const;

export const GRID_STAT_IDS = [
  ...GRID_IMPORT_STAT_IDS,
  ...GRID_EXPORT_STAT_IDS,
] as const;

export const GRID_HISTORY_LOOKBACK_MONTHS = 6;
export const GRID_LIVE_STALE_AFTER_MS = 10 * 60_000;

export type GridStatisticPoint = {
  start: string | number;
  end: string | number;
  change?: number;
};

export type GridStatistics = Record<string, GridStatisticPoint[]>;

export type GridStatisticsResult =
  | { ok: true; data: GridStatistics }
  | { ok: false; error: string };

export type GridStatisticsSnapshot = {
  data: GridStatistics | null;
  lastAttemptMs: number | null;
  lastSuccessMs: number | null;
  error: string | null;
};

export type GridStatisticsWindow = {
  startMs: number;
  endMs: number;
};

export type DailyCostPoint = {
  t: number;
  cum: number;
  pos: number | null;
  neg: number | null;
};

export type MonthlyCost = {
  key: string;
  cost: number;
  partial: boolean;
};

export type GridCostSummary = {
  dailyPoints: DailyCostPoint[];
  todayBalance: number;
  todayCost: number;
  monthlyCosts: MonthlyCost[];
  currentMonthCost: number;
  beforeTodayCost: number;
  currentDayKey: string;
  currentMonthKey: string;
  dayStartMs: number;
  latestBucketStartMs: number | null;
  latestBucketEndMs: number | null;
  missingStatisticIds: string[];
  invalidPointCount: number;
  hasTodayData: boolean;
  isTodayComplete: boolean;
  isCurrentMonthComplete: boolean;
  dataIssues: string[];
};

const HST_OFFSET_MS = 10 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const INTERVAL_TOLERANCE_MS = 60 * 1000;
/** A gap whose bridging hourly bucket is at or below this is treated as zero energy. */
const ZERO_GAP_KWH = 0.01;

export function hstRate(hstHour: number) {
  if (hstHour >= 9 && hstHour < 17) return GRID_RATES.offPeak;
  if (hstHour >= 17 && hstHour < 21) return GRID_RATES.peak;
  return GRID_RATES.midPeak;
}

function timestamp(value: string | number) {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function hstDate(ms: number) {
  return new Date(ms - HST_OFFSET_MS);
}

export function hstHour(ms: number) {
  return hstDate(ms).getUTCHours();
}

export function hstDayKey(ms: number) {
  const d = hstDate(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function hstMonthKey(ms: number) {
  return hstDayKey(ms).slice(0, 7);
}

export function hstDayStartMs(ms: number) {
  const d = hstDate(ms);
  return (
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) +
    HST_OFFSET_MS
  );
}

function hstHourStartMs(ms: number) {
  return (
    Math.floor((ms - HST_OFFSET_MS) / HOUR_MS) * HOUR_MS +
    HST_OFFSET_MS
  );
}

export function hstMonthStartMs(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return Date.UTC(year, month - 1, 1) + HST_OFFSET_MS;
}

export function nextHstMonthStartMs(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return Date.UTC(year, month, 1) + HST_OFFSET_MS;
}

export function hstCurrentMonthStartMs(ms: number) {
  return hstMonthStartMs(hstMonthKey(ms));
}

function shiftHstCalendarMonths(ms: number, months: number) {
  const d = hstDate(ms);
  const targetMonthStart = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth() + months,
    1,
  );
  const targetMonth = new Date(targetMonthStart);
  const lastDay = new Date(
    Date.UTC(
      targetMonth.getUTCFullYear(),
      targetMonth.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  return (
    Date.UTC(
      targetMonth.getUTCFullYear(),
      targetMonth.getUTCMonth(),
      Math.min(d.getUTCDate(), lastDay),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds(),
    ) + HST_OFFSET_MS
  );
}

/**
 * Returns month-bounded history requests ending at the current Hawaii month.
 * The current month is intentionally excluded because it has its own small,
 * frequently refreshed request.
 */
export function buildGridHistoryWindows(
  nowMs: number,
  lookbackMonths = GRID_HISTORY_LOOKBACK_MONTHS,
): GridStatisticsWindow[] {
  const historyEndMs = hstCurrentMonthStartMs(nowMs);
  let cursor = shiftHstCalendarMonths(historyEndMs, -lookbackMonths);
  const windows: GridStatisticsWindow[] = [];

  while (cursor < historyEndMs) {
    const endMs = Math.min(
      nextHstMonthStartMs(hstMonthKey(cursor)),
      historyEndMs,
    );
    if (endMs <= cursor) break;
    windows.push({ startMs: cursor, endMs });
    cursor = endMs;
  }
  return windows;
}

/**
 * Merges recorder responses without double-counting exact copies that can
 * occur at chunk boundaries. Conflicting records remain visible so the cost
 * validator can flag the overlap instead of silently choosing one.
 */
export function mergeGridStatistics(
  ...sources: Array<GridStatistics | null | undefined>
): GridStatistics {
  const merged: GridStatistics = {};
  const seenById = new Map<string, Set<string>>();

  for (const source of sources) {
    if (!source) continue;
    for (const [id, points] of Object.entries(source)) {
      const target = (merged[id] ??= []);
      const seen = seenById.get(id) ?? new Set<string>();
      seenById.set(id, seen);
      for (const point of points ?? []) {
        const startMs = timestamp(point.start);
        const endMs = timestamp(point.end);
        const key = `${startMs ?? String(point.start)}:${
          endMs ?? String(point.end)
        }:${String(point.change)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        target.push(point);
      }
    }
  }

  for (const points of Object.values(merged)) {
    points.sort((a, b) => {
      const aStart = timestamp(a.start) ?? Number.POSITIVE_INFINITY;
      const bStart = timestamp(b.start) ?? Number.POSITIVE_INFINITY;
      return aStart - bStart;
    });
  }
  return merged;
}

export function gridStatisticsBefore(
  statistics: GridStatistics,
  endExclusiveMs: number,
): GridStatistics {
  return Object.fromEntries(
    Object.entries(statistics).map(([id, points]) => [
      id,
      points.filter((point) => {
        const startMs = timestamp(point.start);
        return startMs !== null && startMs < endExclusiveMs;
      }),
    ]),
  );
}

export function createGridStatisticsSnapshot(): GridStatisticsSnapshot {
  return {
    data: null,
    lastAttemptMs: null,
    lastSuccessMs: null,
    error: null,
  };
}

/**
 * Retains the last successful recorder payload when a refresh fails. Callers
 * can keep rendering that snapshot only when they also surface error/age as a
 * stale partial state.
 */
export function applyGridStatisticsRefresh(
  previous: GridStatisticsSnapshot,
  result: GridStatisticsResult,
  attemptedAtMs: number,
  merge = false,
): GridStatisticsSnapshot {
  if (!result.ok) {
    return {
      ...previous,
      lastAttemptMs: attemptedAtMs,
      error: result.error,
    };
  }
  return {
    data:
      merge && previous.data
        ? mergeGridStatistics(previous.data, result.data)
        : result.data,
    lastAttemptMs: attemptedAtMs,
    lastSuccessMs: attemptedAtMs,
    error: null,
  };
}

export function isGridStatisticsSnapshotStale(
  snapshot: GridStatisticsSnapshot,
  nowMs: number,
  staleAfterMs = GRID_LIVE_STALE_AFTER_MS,
) {
  if (snapshot.error !== null || snapshot.lastSuccessMs === null) return true;
  if (nowMs - snapshot.lastSuccessMs > staleAfterMs) return true;
  return hstDayKey(nowMs) !== hstDayKey(snapshot.lastSuccessMs);
}

/**
 * Converts HA's hourly total-increasing statistics into one shared cost model.
 * Both Tesla systems share one utility meter, so each hour is priced on the net
 * of all systems: net import is a cost at that hour's rate, net export a credit. Both the daily running balance and
 * monthly bars are derived from the exact same hourly contributions.
 */
export function calculateGridCosts(
  statistics: GridStatistics,
  nowMs = Date.now(),
): GridCostSummary {
  const currentDayKey = hstDayKey(nowMs);
  const currentMonthKey = hstMonthKey(nowMs);
  const dayStartMs = hstDayStartMs(nowMs);
  const currentMonthStartMs = hstMonthStartMs(currentMonthKey);
  const completedThroughMs = hstHourStartMs(nowMs);
  const monthly = new Map<string, number>();
  const daily = new Map<
    number,
    { plotAt: number; balanceChange: number }
  >();
  const missingStatisticIds = GRID_STAT_IDS.filter(
    (id) => !Array.isArray(statistics[id]),
  );
  const acceptedById = new Map<
    string,
    Array<{ startMs: number; endMs: number }>
  >(GRID_STAT_IDS.map((id) => [id, []]));
  const invalidMonthKeys = new Set<string>();
  const hourly = new Map<
    number,
    { importKwh: number; exportKwh: number; endMs: number }
  >();

  let latestBucketStartMs: number | null = null;
  let latestBucketEndMs: number | null = null;
  let invalidPointCount = 0;

  const consume = (ids: readonly string[], kind: "import" | "export") => {
    for (const id of ids) {
      let lastAcceptedEndMs: number | null = null;
      const points = [...(statistics[id] ?? [])].sort((a, b) => {
        const aStart = timestamp(a.start) ?? Number.POSITIVE_INFINITY;
        const bStart = timestamp(b.start) ?? Number.POSITIVE_INFINITY;
        return aStart - bStart;
      });
      for (const point of points) {
        const startMs = timestamp(point.start);
        const endMs = timestamp(point.end);
        const rawChange = point.change;
        const duration =
          startMs !== null && endMs !== null ? endMs - startMs : NaN;

        // HA may return the current, not-yet-complete hour. It is deliberately
        // excluded from both cards so the shared totals only use completed
        // hourly energy buckets.
        if (
          startMs !== null &&
          endMs !== null &&
          startMs < nowMs &&
          endMs > completedThroughMs + INTERVAL_TOLERANCE_MS
        ) {
          continue;
        }

        if (
          startMs === null ||
          endMs === null ||
          !Number.isFinite(rawChange) ||
          (rawChange ?? 0) < 0 ||
          endMs <= startMs ||
          Math.abs(duration - HOUR_MS) > INTERVAL_TOLERANCE_MS ||
          startMs >= nowMs ||
          endMs > nowMs + INTERVAL_TOLERANCE_MS ||
          (lastAcceptedEndMs !== null &&
            startMs < lastAcceptedEndMs - INTERVAL_TOLERANCE_MS)
        ) {
          invalidPointCount += 1;
          if (startMs !== null) invalidMonthKeys.add(hstMonthKey(startMs));
          continue;
        }
        const kwh = rawChange ?? 0;

        // HA skips hourly rows while a sensor is unavailable (Tesla's daily export
        // counter goes blank overnight until the first export), and the first row
        // after the gap carries everything accrued during it. The gap is therefore
        // safe to treat as covered when (a) it is an export (flat sell rate, so hour
        // attribution can't change the credit) or (b) the bridging bucket shows
        // essentially no energy. A real import inside a gap stays "incomplete".
        if (
          lastAcceptedEndMs !== null &&
          startMs > lastAcceptedEndMs + INTERVAL_TOLERANCE_MS &&
          (kind === "export" || kwh <= ZERO_GAP_KWH)
        ) {
          acceptedById.get(id)?.push({ startMs: lastAcceptedEndMs, endMs: startMs });
        }

        lastAcceptedEndMs = endMs;
        acceptedById.get(id)?.push({ startMs, endMs });
        // Both Tesla systems sit behind ONE utility meter. Energy one system
        // exports while the other imports in the same hour never crosses the
        // meter, so it is neither bought nor sold. Collect both systems' hourly
        // imports and exports here and price only the hourly net (below).
        const hour = hourly.get(startMs) ?? { importKwh: 0, exportKwh: 0, endMs };
        if (kind === "import") hour.importKwh += kwh;
        else hour.exportKwh += kwh;
        hour.endMs = Math.max(hour.endMs, endMs);
        hourly.set(startMs, hour);

        if (latestBucketStartMs === null || startMs > latestBucketStartMs) {
          latestBucketStartMs = startMs;
        }
        if (latestBucketEndMs === null || endMs > latestBucketEndMs) {
          latestBucketEndMs = endMs;
        }
      }
    }
  };

  consume(GRID_IMPORT_STAT_IDS, "import");
  consume(GRID_EXPORT_STAT_IDS, "export");

  // Price each hour at the shared meter: net import at that hour's rate,
  // net export at the flat sell rate.
  for (const [startMs, hour] of hourly) {
    const netKwh = hour.importKwh - hour.exportKwh;
    const costChange =
      netKwh >= 0
        ? netKwh * hstRate(hstHour(startMs))
        : netKwh * GRID_RATES.sell;
    const monthKey = hstMonthKey(startMs);
    monthly.set(monthKey, (monthly.get(monthKey) ?? 0) + costChange);

    if (hstDayKey(startMs) === currentDayKey) {
      // A positive cost is a negative balance; an export credit is positive.
      daily.set(startMs, {
        plotAt: Math.min(hour.endMs, nowMs),
        balanceChange: -costChange,
      });
    }
  }

  const incompleteIdsForPeriod = (periodStart: number, periodEnd: number) => {
    if (periodEnd <= periodStart) return [] as string[];
    return GRID_STAT_IDS.filter((id) => {
      const intervals = (acceptedById.get(id) ?? [])
        .filter(
          ({ startMs, endMs }) =>
            endMs > periodStart && startMs < periodEnd,
        )
        .sort((a, b) => a.startMs - b.startMs);
      let coveredThrough = periodStart;
      for (const interval of intervals) {
        if (interval.endMs <= coveredThrough) continue;
        if (
          interval.startMs >
          coveredThrough + INTERVAL_TOLERANCE_MS
        ) {
          return true;
        }
        coveredThrough = Math.max(coveredThrough, interval.endMs);
      }
      return coveredThrough < periodEnd - INTERVAL_TOLERANCE_MS;
    });
  };

  const incompleteTodayIds = incompleteIdsForPeriod(
    dayStartMs,
    completedThroughMs,
  );
  const incompleteCurrentMonthIds = incompleteIdsForPeriod(
    currentMonthStartMs,
    completedThroughMs,
  );

  let balance = 0;
  const dailyPoints: DailyCostPoint[] = [
    { t: dayStartMs, cum: 0, pos: 0, neg: null },
  ];
  for (const event of Array.from(daily.entries()).sort(
    ([a], [b]) => a - b,
  )) {
    balance += event[1].balanceChange;
    dailyPoints.push({
      t: event[1].plotAt,
      cum: balance,
      pos: balance >= 0 ? balance : null,
      neg: balance < 0 ? balance : null,
    });
  }

  // Always include the current month, even if every stream is missing. A
  // visible partial $0 is safer than silently omitting the month altogether.
  if (!monthly.has(currentMonthKey)) monthly.set(currentMonthKey, 0);
  const monthlyCosts = Array.from(monthly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, cost]) => {
      const periodStart = hstMonthStartMs(key);
      const periodEnd =
        key === currentMonthKey
          ? completedThroughMs
          : nextHstMonthStartMs(key);
      return {
        key,
        cost,
        partial:
          invalidMonthKeys.has(key) ||
          incompleteIdsForPeriod(periodStart, periodEnd).length > 0,
      };
    });
  const currentMonthCost = monthly.get(currentMonthKey) ?? 0;
  const todayCost = balance === 0 ? 0 : -balance;
  const isTodayComplete =
    incompleteTodayIds.length === 0 &&
    !invalidMonthKeys.has(currentMonthKey);
  const isCurrentMonthComplete =
    incompleteCurrentMonthIds.length === 0 &&
    !invalidMonthKeys.has(currentMonthKey);
  const dataIssues: string[] = [];
  if (missingStatisticIds.length > 0) {
    dataIssues.push(
      `${missingStatisticIds.length} required energy source${
        missingStatisticIds.length === 1 ? " is" : "s are"
      } missing`,
    );
  }
  if (incompleteTodayIds.length > 0) {
    dataIssues.push(
      `${incompleteTodayIds.length} source${
        incompleteTodayIds.length === 1 ? " has" : "s have"
      } gaps today`,
    );
  }
  if (incompleteCurrentMonthIds.length > 0) {
    dataIssues.push(
      `${incompleteCurrentMonthIds.length} source${
        incompleteCurrentMonthIds.length === 1 ? " is" : "s are"
      } incomplete this month`,
    );
  }
  if (invalidPointCount > 0) {
    dataIssues.push(
      `${invalidPointCount} malformed or duplicate hourly record${
        invalidPointCount === 1 ? " was" : "s were"
      } ignored`,
    );
  }

  return {
    dailyPoints,
    todayBalance: balance,
    todayCost,
    monthlyCosts,
    currentMonthCost,
    beforeTodayCost: currentMonthCost - todayCost,
    currentDayKey,
    currentMonthKey,
    dayStartMs,
    latestBucketStartMs,
    latestBucketEndMs,
    missingStatisticIds,
    invalidPointCount,
    hasTodayData: daily.size > 0,
    isTodayComplete,
    isCurrentMonthComplete,
    dataIssues,
  };
}