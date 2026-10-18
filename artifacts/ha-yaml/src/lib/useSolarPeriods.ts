import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { haWsBatch, useHAStore, type HAState } from "./ha";
import {
  calculateSolarPeriods,
  solarWindow,
  SOLAR_REFRESH_MS,
  SOLAR_STALE_MS,
  type SolarPeriodTotal,
} from "./solarEnergy";
import { loadSolarSnapshot, solarSourceIssue } from "./solarRecorder";

// Credentials never become query keys or persisted diagnostics. A changed
// connection gets an independent cache, including while old requests finish.
let scope = { url: "", token: "", serial: 0 };
function connectionScope(url: string, token: string) {
  if (scope.url !== url || scope.token !== token) {
    scope = { url, token, serial: scope.serial + 1 };
  }
  return scope.serial;
}

export function useSolarPeriods(states: HAState[]) {
  const { url, token, status } = useHAStore();
  const [, setClock] = useState(Date.now);
  // A network response can arrive between timer ticks: evaluate it against
  // actual render time, not the pre-request tick (which would look "future").
  const nowMs = Date.now();
  useEffect(() => {
    const tick = () => setClock(Date.now());
    const timer = window.setInterval(tick, 15_000);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, []);
  const dayStartMs = solarWindow(nowMs).dayStartMs;
  const query = useQuery({
    queryKey: ["solar-periods", connectionScope(url, token), dayStartMs],
    queryFn: () => loadSolarSnapshot(haWsBatch),
    enabled: Boolean(url && token),
    staleTime: SOLAR_REFRESH_MS,
    refetchInterval: SOLAR_REFRESH_MS,
    refetchIntervalInBackground: true,
    gcTime: SOLAR_STALE_MS,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const totals = calculateSolarPeriods(query.data ?? null, nowMs);
  const issue = !url || !token
    ? "Connect to Home Assistant to load solar history"
    : status === "error" || status === "disconnected"
      ? "Home Assistant state updates are unavailable"
      : solarSourceIssue(states, nowMs);
  const row = (total: SolarPeriodTotal, period: string) => {
    const error = issue ?? (query.isError ? query.error.message : null);
    const ready = !error && total.status === "ready" && total.kwh !== null;
    const value = ready
      ? `${total.kwh!.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`
      : error ? "Unavailable"
        : query.isPending ? "Loading…"
          : total.status === "stale" ? "Stale"
            : total.status === "incomplete" ? "Incomplete" : "Unavailable";
    const through = ready && total.throughMs !== null
      ? `Through ${new Date(total.throughMs).toLocaleTimeString("en-US", {
          timeZone: "Pacific/Honolulu", hour: "numeric", minute: "2-digit",
        })} HST · hourly records`
      : error ?? (query.isPending ? "Loading Main Envoy history" : total.detail);
    return { value, detail: `${period} · ${through}`, warning: !ready };
  };
  return {
    today: row(totals.today, "Hawaii today"),
    sevenDay: row(totals.sevenDay, "Today + previous 6 Hawaii days"),
  };
}