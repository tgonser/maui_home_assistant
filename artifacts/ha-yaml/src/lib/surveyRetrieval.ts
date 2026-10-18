import type { HACallResult, HAWsResult, HAState } from "./ha.ts";
import type { SurveyData, SurveyProgress } from "./survey.ts";

export type ConfigurationRetrieval = {
  entityId: string;
  domain: "automation" | "script" | "scene";
  configId?: string;
  source: string;
  status: "retrieved" | "missing_id" | "unavailable";
  error?: string;
  configuration?: Record<string, unknown>;
};

export type SurveySource = {
  source: string;
  status: "retrieved" | "unavailable";
  error?: string;
};

export type SurveyTransport = {
  call: <T>(path: string) => Promise<HACallResult<T>>;
  wsBatch: (commands: Array<{ type: string }>) => Promise<{
    ok: boolean;
    results: HAWsResult[];
    error?: string;
  }>;
};

export const CONFIGURATION_CONCURRENCY = 4;
export const registryCommands = [
  ["areas", "config/area_registry/list"],
  ["floors", "config/floor_registry/list"],
  ["devices", "config/device_registry/list"],
  ["entities", "config/entity_registry/list"],
  ["configEntries", "config_entries/get"],
  ["dashboards", "lovelace/dashboards/list"],
] as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function validRegistryRows(key: string, rows: unknown[]): boolean {
  const identity = key === "areas" ? "area_id" : key === "floors" ? "floor_id"
    : key === "devices" ? "id" : key === "entities" ? "entity_id"
    : key === "configEntries" ? "entry_id" : "url_path";
  return rows.every((row) => isObject(row) && typeof row[identity] === "string"
    && (!(key === "areas" || key === "floors") || typeof row.name === "string"));
}

async function safeCall<T>(transport: SurveyTransport, path: string): Promise<HACallResult<T>> {
  try {
    return await transport.call<T>(path);
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : "Request failed" };
  }
}

const httpError = (r: { status: number; error: string }) =>
  `${r.status ? `HTTP ${r.status}` : "Transport failure"}: ${r.error}`;

/** Read-only: states are the inventory; per-entity config is optional evidence. */
export async function collectSurvey(
  transport: SurveyTransport,
  onProgress: SurveyProgress = () => {},
): Promise<{ ok: boolean; data?: SurveyData; error?: string }> {
  onProgress("Fetching live states & instance config…", 5);
  const [statesRes, configRes] = await Promise.all([
    safeCall<HAState[]>(transport, "/api/states"),
    safeCall<Record<string, unknown>>(transport, "/api/config"),
  ]);
  if (!statesRes.ok) return { ok: false, error: `Live inventory unavailable — ${httpError(statesRes)}` };
  if (!Array.isArray(statesRes.data) || statesRes.data.some(
    (s) => !isObject(s) || typeof s.entity_id !== "string" || typeof s.state !== "string" || !isObject(s.attributes),
  )) return { ok: false, error: "Live inventory unavailable — /api/states returned invalid state data" };

  const warnings: string[] = [];
  const sources: Record<string, SurveySource> = {
    states: { source: "GET /api/states", status: "retrieved" },
  };
  const configValid = configRes.ok && isObject(configRes.data);
  sources.config = {
    source: "GET /api/config",
    status: configValid ? "retrieved" : "unavailable",
    ...(!configValid ? { error: configRes.ok ? "Expected an object" : httpError(configRes) } : {}),
  };
  if (!configValid) warnings.push(`Instance config unavailable: ${sources.config.error}`);

  onProgress("Fetching registries (individual failures will be reported)…", 25);
  let ws: Awaited<ReturnType<SurveyTransport["wsBatch"]>>;
  try {
    ws = await transport.wsBatch(registryCommands.map(([, type]) => ({ type })));
  } catch (error) {
    ws = { ok: false, results: [], error: error instanceof Error ? error.message : "WebSocket request failed" };
  }
  if (!ws.ok) warnings.push(`Registry WebSocket batch incomplete: ${ws.error ?? "Batch failed"}`);
  const registries: Record<string, unknown[]> = {};
  registryCommands.forEach(([key, command], index) => {
    // The proxy returns command IDs starting at 1; do not associate a reordered
    // or missing response with another registry.
    const response = ws.results.find((result) => result.id === index + 1);
    const valid = response?.success === true && Array.isArray(response.result) && validRegistryRows(key, response.result);
    const error = valid ? undefined : response?.error
      ? `${response.error.code}: ${response.error.message}`
      : response?.success ? "Expected an array of valid registry records" : `Missing response${ws.error ? `: ${ws.error}` : ""}`;
    sources[key] = { source: `WS ${command}`, status: valid ? "retrieved" : "unavailable", ...(error ? { error } : {}) };
    registries[key] = valid ? response.result as unknown[] : [];
    if (error) warnings.push(`${key} unavailable (${command}): ${error}`);
  });

  onProgress("Reading individual automation / script / scene configs…", 60);
  const inventory = statesRes.data.filter((s) => /^(automation|script|scene)\./.test(s.entity_id));
  const configurationRetrieval: ConfigurationRetrieval[] = new Array(inventory.length);
  let next = 0;
  let completed = 0;
  await Promise.all(Array.from({ length: Math.min(CONFIGURATION_CONCURRENCY, inventory.length) }, async () => {
    while (next < inventory.length) {
      const index = next++;
      const state = inventory[index];
      const domain = state.entity_id.split(".")[0] as ConfigurationRetrieval["domain"];
      const rawId = domain === "automation" ? state.attributes.id :
        domain === "scene" && state.attributes.id != null ? state.attributes.id :
        state.entity_id.slice(domain.length + 1);
      const configId = typeof rawId === "string" && rawId.trim() ? rawId : undefined;
      const source = configId
        ? `GET /api/config/${domain}/config/${encodeURIComponent(configId)}`
        : "GET /api/states (configuration ID missing)";
      const entry: ConfigurationRetrieval = { entityId: state.entity_id, domain, configId, source, status: "missing_id" };
      if (!configId) {
        entry.error = domain === "automation"
          ? "Missing attributes.id; the entity object ID is not an automation configuration ID"
          : "Missing entity object ID";
      } else {
        const response = await safeCall<unknown>(transport, source.slice(4));
        if (response.ok && isObject(response.data)) {
          entry.status = "retrieved";
          entry.configuration = response.data;
        } else {
          entry.status = "unavailable";
          entry.error = response.ok ? "Expected a configuration object" : httpError(response);
        }
      }
      configurationRetrieval[index] = entry;
      if (entry.error) warnings.push(`${entry.entityId}: ${entry.error} (${source})`);
      completed++;
      onProgress(`Read configuration coverage: ${completed}/${inventory.length}`, 60 + Math.round(30 * completed / inventory.length));
    }
  }));

  onProgress("Done — building reports", 95);
  return {
    ok: true,
    data: {
      config: configValid && configRes.ok ? configRes.data : {},
      states: statesRes.data,
      areas: registries.areas as SurveyData["areas"],
      floors: registries.floors as SurveyData["floors"],
      devices: registries.devices as SurveyData["devices"],
      entities: registries.entities as SurveyData["entities"],
      configEntries: registries.configEntries as SurveyData["configEntries"],
      dashboards: registries.dashboards,
      automations: configurationRetrieval.filter((r) => r.domain === "automation" && r.status === "retrieved").map((r) => r.configuration),
      scripts: configurationRetrieval.filter((r) => r.domain === "script" && r.status === "retrieved").map((r) => r.configuration),
      scenes: configurationRetrieval.filter((r) => r.domain === "scene" && r.status === "retrieved").map((r) => r.configuration),
      configurationRetrieval,
      sources,
      warnings,
      generatedAt: new Date().toISOString(),
    },
  };
}
