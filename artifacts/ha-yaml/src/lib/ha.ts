import { create } from "zustand";
import { persist } from "zustand/middleware";

export type HAState = {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
};

export type HAConfig = {
  location_name: string;
  version: string;
  time_zone: string;
  unit_system?: Record<string, string>;
  components?: string[];
};

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

type HAStore = {
  url: string;
  token: string;
  status: ConnectionStatus;
  errorMessage: string | null;
  config: HAConfig | null;
  setCredentials: (url: string, token: string) => void;
  clear: () => void;
  setStatus: (status: ConnectionStatus, error?: string | null) => void;
  setConfig: (config: HAConfig | null) => void;
};

export const useHAStore = create<HAStore>()(
  persist(
    (set) => ({
      url: "",
      token: "",
      status: "disconnected",
      errorMessage: null,
      config: null,
      setCredentials: (url, token) =>
        set({ url: url.trim().replace(/\/$/, ""), token: token.trim() }),
      clear: () =>
        set({
          url: "",
          token: "",
          status: "disconnected",
          errorMessage: null,
          config: null,
        }),
      setStatus: (status, error = null) =>
        set({ status, errorMessage: error }),
      setConfig: (config) => set({ config }),
    }),
    {
      name: "ha-yaml:ha-connection",
      partialize: (s) => ({ url: s.url, token: s.token }),
    },
  ),
);

const proxyBase = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/ha/call`;

export type HACallResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

export async function haCall<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; binary?: boolean } = {},
): Promise<HACallResult<T>> {
  const { url, token } = useHAStore.getState();
  if (!url || !token) {
    return { ok: false, status: 0, error: "Not connected to Home Assistant" };
  }
  try {
    const res = await fetch(proxyBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        token,
        path,
        method: options.method ?? "GET",
        body: options.body,
        binary: options.binary ?? false,
      }),
    });
    const json = await res.json();
    if (json.ok) {
      return { ok: true, status: json.status, data: json.data as T };
    }
    return {
      ok: false,
      status: json.status ?? res.status,
      error:
        typeof json.data === "string"
          ? json.data
          : json.error ?? `HTTP ${json.status ?? res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export async function haTest() {
  const config = await haCall<HAConfig>("/api/config");
  if (!config.ok) return config;
  useHAStore.getState().setConfig(config.data);
  return config;
}

export async function haStates() {
  return haCall<HAState[]>("/api/states");
}

export async function haCameraImage(entityId: string) {
  return haCall<string>(`/api/camera_proxy/${entityId}`, { binary: true });
}

export type HAHistoryPoint = {
  state: string;
  last_changed: string;
  last_updated?: string;
};

export type HAHistoryPointFull = {
  state: string;
  last_changed: string;
  attributes?: Record<string, unknown>;
};

export async function haHistory(entityId: string, hoursBack = 24) {
  const end = new Date();
  const start = new Date(end.getTime() - hoursBack * 3600_000);
  const path = `/api/history/period/${encodeURIComponent(
    start.toISOString(),
  )}?filter_entity_id=${encodeURIComponent(
    entityId,
  )}&end_time=${encodeURIComponent(
    end.toISOString(),
  )}&minimal_response&no_attributes&significant_changes_only`;
  return haCall<HAHistoryPoint[][]>(path);
}

export async function haHistoryFull(entityId: string, hoursBack = 24) {
  const end = new Date();
  const start = new Date(end.getTime() - hoursBack * 3600_000);
  const path = `/api/history/period/${encodeURIComponent(
    start.toISOString(),
  )}?filter_entity_id=${encodeURIComponent(
    entityId,
  )}&end_time=${encodeURIComponent(end.toISOString())}&significant_changes_only`;
  return haCall<HAHistoryPointFull[][]>(path);
}

export type HAForecastPoint = {
  datetime: string;
  temperature?: number;
  templow?: number;
  condition?: string;
  precipitation?: number;
};

export async function haForecast(
  entityId: string,
  type: "hourly" | "daily" | "twice_daily" = "hourly",
) {
  const res = await haCall<{
    service_response?: Record<string, { forecast?: HAForecastPoint[] }>;
  }>(`/api/services/weather/get_forecasts?return_response`, {
    method: "POST",
    body: { entity_id: entityId, type },
  });
  if (!res.ok) return res;
  const forecast = res.data.service_response?.[entityId]?.forecast ?? [];
  return { ok: true as const, status: res.status, data: forecast };
}

export type HAWsResult = {
  id: number;
  success: boolean;
  result?: unknown;
  error?: { code: string; message: string };
};

const wsBase = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/ha/ws-batch`;

export async function haWsBatch(
  commands: Array<Record<string, unknown> & { type: string }>,
): Promise<{ ok: boolean; results: HAWsResult[]; error?: string }> {
  const { url, token } = useHAStore.getState();
  if (!url || !token) {
    return { ok: false, results: [], error: "Not connected to Home Assistant" };
  }
  try {
    const res = await fetch(wsBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, token, commands }),
    });
    const json = await res.json();
    return {
      ok: !!json.ok,
      results: (json.results as HAWsResult[]) ?? [],
      error: json.error ? `${json.error}: ${json.detail ?? ""}` : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      results: [],
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

// Render a Jinja template against HA and return the raw text body.
// HA's /api/template returns plain text (not JSON), so we accept either a
// string (success) or surface the error.
export async function haTemplate(template: string): Promise<HACallResult<string>> {
  const r = await haCall<unknown>("/api/template", {
    method: "POST",
    body: { template },
  });
  if (!r.ok) return r;
  return { ok: true, status: r.status, data: String(r.data ?? "") };
}

// Returns the set of entity_ids that belong to a given HA integration
// (e.g. "totalconnect"). Uses HA's `integration_entities()` template helper.
export async function haIntegrationEntities(integration: string): Promise<string[]> {
  const r = await haTemplate(
    `{{ integration_entities('${integration}') | list | tojson }}`,
  );
  if (!r.ok) return [];
  try {
    const parsed = JSON.parse(r.data);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function haCallService(
  domain: string,
  service: string,
  data: Record<string, unknown> = {},
) {
  return haCall(`/api/services/${domain}/${service}`, {
    method: "POST",
    body: data,
  });
}

export type HAStatisticPoint = {
  statistic_id: string;
  start: string;
  end: string;
  change?: number;
  mean?: number;
  min?: number;
  max?: number;
  sum?: number;
  state?: number;
};

export async function haStatistics(
  statisticIds: string[],
  period: "5minute" | "hour" | "day" | "month",
  startTime: Date,
  endTime?: Date,
  types: string[] = ["change"],
) {
  return haCall<Record<string, HAStatisticPoint[]>>(
    "/api/statistics_during_period",
    {
      method: "POST",
      body: {
        start_time: startTime.toISOString(),
        ...(endTime ? { end_time: endTime.toISOString() } : {}),
        period,
        statistic_ids: statisticIds,
        types,
      },
    },
  );
}
