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

export type GridStatisticPoint = {
  start: string | number;
  end: string | number;
  change?: number;
};

export type GridStatistics = Record<string, GridStatisticPoint[]>;

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

function hstMonthStartMs(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return Date.UTC(year, month - 1, 1) + HST_OFFSET_MS;
}

function nextHstMonthStartMs(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return Date.UTC(year, month, 1) + HST_OFFSET_MS;
}

/**
 * Converts HA's hourly total-increasing statistics into one shared cost model.
 * Imports are costs; exports are credits. Both the daily running balance and
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
        lastAcceptedEndMs = endMs;
        acceptedById.get(id)?.push({ startMs, endMs });

        const kwh = rawChange ?? 0;
        const costChange =
          kind === "import"
            ? kwh * hstRate(hstHour(startMs))
            : -kwh * GRID_RATES.sell;
        const monthKey = hstMonthKey(startMs);
        monthly.set(monthKey, (monthly.get(monthKey) ?? 0) + costChange);

        if (hstDayKey(startMs) === currentDayKey) {
          const existing = daily.get(startMs) ?? {
            plotAt: Math.min(endMs, nowMs),
            balanceChange: 0,
          };
          existing.plotAt = Math.max(
            existing.plotAt,
            Math.min(endMs, nowMs),
          );
          // A positive cost is a negative balance; an export credit is positive.
          existing.balanceChange -= costChange;
          daily.set(startMs, existing);
        }

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