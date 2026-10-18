import type { HAState, HAWsResult } from "./ha";
import {
  energyToKwh,
  SOLAR_SOURCE_IDS,
  solarWindow,
  type SolarSnapshot,
  type SolarStatisticPoint,
} from "./solarEnergy.ts";

type WsBatch = (commands: Array<Record<string, unknown> & { type: string }>) =>
  Promise<{ ok: boolean; results: HAWsResult[]; error?: string }>;

/**
 * One bounded, read-only batch: validate the recorder source and obtain at most
 * seven days plus one baseline hour. Request an explicit statistics unit rather
 * than assuming it matches the entity's current display unit.
 */
export async function loadSolarSnapshot(
  batch: WsBatch,
  requestedAtMs = Date.now(),
  clock = Date.now,
): Promise<SolarSnapshot> {
  const window = solarWindow(requestedAtMs);
  const id = SOLAR_SOURCE_IDS.lifetime;
  const response = await batch([
    { type: "recorder/get_statistics_metadata", statistic_ids: [id] },
    {
      type: "recorder/statistics_during_period",
      statistic_ids: [id],
      period: "hour",
      start_time: new Date(window.requestStartMs).toISOString(),
      end_time: new Date(window.throughMs).toISOString(),
      types: ["sum", "state"],
      units: { energy: "kWh" },
    },
  ]);
  if (!response.ok) throw new Error(response.error ?? "Solar recorder request failed");
  const [metadataResult, statisticsResult] = response.results;
  for (const result of [metadataResult, statisticsResult]) {
    if (!result?.success) {
      throw new Error(result?.error?.message ?? "Solar recorder response is missing");
    }
  }
  const metadata = metadataResult.result;
  const source = Array.isArray(metadata)
    ? metadata.find((item) => item?.statistic_id === id)
    : null;
  if (
    !source || source.has_sum !== true ||
    energyToKwh(1, source.unit_of_measurement) === null ||
    (source.unit_class != null && source.unit_class !== "energy")
  ) {
    throw new Error("Main Envoy lifetime energy statistics are unavailable or have unverified units");
  }
  const data = statisticsResult.result;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid solar recorder response");
  }
  const points = (data as Record<string, unknown>)[id];
  if (!Array.isArray(points) || points.length > 200 ||
      points.some((point) => !point || typeof point !== "object" || Array.isArray(point))) {
    throw new Error("Main Envoy lifetime energy history is missing or invalid");
  }
  return {
    points: points as SolarStatisticPoint[],
    unit: "kWh",
    requestedAtMs,
    fetchedAtMs: clock(),
  };
}

/** A static counter can legitimately have an old last_updated overnight.
 * HA's last_reported detects a stalled integration even when values don't change.
 * On older HA responses without it, allow a full day of unchanged energy.
 */
export function solarSourceIssue(states: HAState[], nowMs: number): string | null {
  const source = states.find((state) => state.entity_id === SOLAR_SOURCE_IDS.lifetime);
  const kwh = source ? energyToKwh(source.state, source.attributes.unit_of_measurement) : null;
  if (!source || kwh === null || kwh < 0) {
    return "Main Envoy lifetime energy sensor is unavailable or invalid";
  }
  if (source.attributes.device_class !== "energy" ||
      !["total", "total_increasing"].includes(String(source.attributes.state_class))) {
    return "Main Envoy lifetime sensor is not a verified cumulative energy source";
  }
  const reportedAt = Date.parse(source.last_reported ?? source.last_updated);
  const maxAge = source.last_reported ? 15 * 60_000 : 26 * 60 * 60_000;
  if (!Number.isFinite(reportedAt) || reportedAt > nowMs + 60_000 || nowMs - reportedAt > maxAge) {
    return "Main Envoy lifetime energy sensor is stale";
  }
  return null;
}