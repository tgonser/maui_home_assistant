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
  options: { method?: string; body?: unknown } = {},
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
