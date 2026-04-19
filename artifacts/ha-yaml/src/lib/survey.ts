import { haCall, haWsBatch, type HAState } from "./ha";

export type SurveyProgress = (step: string, pct: number) => void;

type Area = { area_id: string; name: string; floor_id?: string };
type FloorEntry = { floor_id: string; name: string; level?: number };
type DeviceEntry = {
  id: string;
  name: string | null;
  name_by_user: string | null;
  model: string | null;
  manufacturer: string | null;
  area_id: string | null;
  config_entries: string[];
  disabled_by: string | null;
};
type EntityEntry = {
  entity_id: string;
  device_id: string | null;
  area_id: string | null;
  name: string | null;
  original_name: string | null;
  platform: string;
  config_entry_id: string | null;
  disabled_by: string | null;
  hidden_by: string | null;
};
type ConfigEntry = {
  entry_id: string;
  domain: string;
  title: string;
  state: string;
};

export type SurveyData = {
  config: Record<string, unknown>;
  states: HAState[];
  areas: Area[];
  floors: FloorEntry[];
  devices: DeviceEntry[];
  entities: EntityEntry[];
  configEntries: ConfigEntry[];
  scripts: unknown[];
  scenes: unknown[];
  automations: unknown[];
  dashboards: unknown[];
  generatedAt: string;
};

export async function runSurvey(
  onProgress: SurveyProgress = () => {},
): Promise<{ ok: boolean; data?: SurveyData; error?: string }> {
  onProgress("Fetching states & config…", 5);
  const [statesRes, configRes] = await Promise.all([
    haCall<HAState[]>("/api/states"),
    haCall<Record<string, unknown>>("/api/config"),
  ]);
  if (!statesRes.ok) return { ok: false, error: `states: ${statesRes.error}` };
  if (!configRes.ok) return { ok: false, error: `config: ${configRes.error}` };

  onProgress("Fetching registries (areas/devices/entities)…", 25);
  const ws = await haWsBatch([
    { type: "config/area_registry/list" },
    { type: "config/floor_registry/list" },
    { type: "config/device_registry/list" },
    { type: "config/entity_registry/list" },
    { type: "config_entries/get" },
    { type: "lovelace/dashboards/list" },
  ]);
  if (!ws.ok) return { ok: false, error: ws.error ?? "WebSocket failed" };

  const [areasR, floorsR, devicesR, entitiesR, configEntriesR, dashboardsR] =
    ws.results;
  const areas = ((areasR?.result as Area[]) ?? []) as Area[];
  const floors = ((floorsR?.result as FloorEntry[]) ?? []) as FloorEntry[];
  const devices = ((devicesR?.result as DeviceEntry[]) ?? []) as DeviceEntry[];
  const entities = ((entitiesR?.result as EntityEntry[]) ??
    []) as EntityEntry[];
  const configEntries = ((configEntriesR?.result as ConfigEntry[]) ??
    []) as ConfigEntry[];
  const dashboards = ((dashboardsR?.result as unknown[]) ?? []) as unknown[];

  onProgress("Fetching automations / scripts / scenes…", 60);
  const [automations, scripts, scenes] = await Promise.all([
    haCall<unknown[]>("/api/config/automation/config").then((r) =>
      r.ok ? (r.data as unknown[]) : [],
    ),
    haCall<unknown[]>("/api/config/script/config").then((r) =>
      r.ok ? (r.data as unknown[]) : [],
    ),
    haCall<unknown[]>("/api/config/scene/config").then((r) =>
      r.ok ? (r.data as unknown[]) : [],
    ),
  ]);

  onProgress("Done — building reports", 95);
  return {
    ok: true,
    data: {
      config: configRes.data,
      states: statesRes.data,
      areas,
      floors,
      devices,
      entities,
      configEntries,
      scripts,
      scenes,
      automations,
      dashboards,
      generatedAt: new Date().toISOString(),
    },
  };
}

const friendly = (s: HAState) =>
  (s.attributes.friendly_name as string | undefined) ?? s.entity_id;
const domainOf = (id: string) => id.split(".")[0] ?? "";

function mdTable(headers: string[], rows: string[][]) {
  const sep = headers.map(() => "---").join(" | ");
  const head = headers.join(" | ");
  const body = rows.map((r) => r.join(" | ")).join("\n");
  return `| ${head} |\n| ${sep} |\n${rows.length ? body.replace(/^/gm, "| ").replace(/$/gm, " |") : "| _(none)_ |"}`;
}

function indexEntities(d: SurveyData) {
  const entitiesByDomain = new Map<string, HAState[]>();
  for (const s of d.states) {
    const dom = domainOf(s.entity_id);
    if (!entitiesByDomain.has(dom)) entitiesByDomain.set(dom, []);
    entitiesByDomain.get(dom)!.push(s);
  }
  const regByEntity = new Map(d.entities.map((e) => [e.entity_id, e]));
  const deviceById = new Map(d.devices.map((dev) => [dev.id, dev]));
  const areaById = new Map(d.areas.map((a) => [a.area_id, a]));
  const configEntryById = new Map(
    d.configEntries.map((c) => [c.entry_id, c]),
  );
  const areaForEntity = (entityId: string): string | undefined => {
    const reg = regByEntity.get(entityId);
    if (!reg) return undefined;
    if (reg.area_id) return areaById.get(reg.area_id)?.name;
    if (reg.device_id) {
      const dev = deviceById.get(reg.device_id);
      if (dev?.area_id) return areaById.get(dev.area_id)?.name;
    }
    return undefined;
  };
  const integrationForEntity = (entityId: string): string | undefined => {
    const reg = regByEntity.get(entityId);
    if (!reg) return undefined;
    if (reg.platform) return reg.platform;
    if (reg.config_entry_id) {
      return configEntryById.get(reg.config_entry_id)?.domain;
    }
    return undefined;
  };
  return {
    entitiesByDomain,
    regByEntity,
    deviceById,
    areaById,
    configEntryById,
    areaForEntity,
    integrationForEntity,
  };
}

export function buildExecutiveSummary(d: SurveyData): string {
  const idx = indexEntities(d);
  const integrations = new Map<string, number>();
  for (const e of d.entities) {
    const k = e.platform || "unknown";
    integrations.set(k, (integrations.get(k) ?? 0) + 1);
  }
  const topIntegrations = [...integrations.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  const audioCount =
    (idx.entitiesByDomain.get("media_player")?.length ?? 0);
  const lightCount = idx.entitiesByDomain.get("light")?.length ?? 0;
  const climateCount = idx.entitiesByDomain.get("climate")?.length ?? 0;
  const cameraCount = idx.entitiesByDomain.get("camera")?.length ?? 0;
  const sensorCount = idx.entitiesByDomain.get("sensor")?.length ?? 0;

  const cfg = d.config as Record<string, unknown>;
  const lines: string[] = [];
  lines.push(`# Home Assistant Executive Summary`);
  lines.push(`_Generated ${d.generatedAt}_\n`);
  lines.push(`**Instance:** ${cfg.location_name ?? "Home Assistant"}  `);
  lines.push(`**Version:** ${cfg.version ?? "?"}  `);
  lines.push(`**Time zone:** ${cfg.time_zone ?? "?"}\n`);
  lines.push(`## Totals`);
  lines.push(`- Areas: **${d.areas.length}**`);
  lines.push(`- Floors: **${d.floors.length}**`);
  lines.push(`- Devices: **${d.devices.length}**`);
  lines.push(`- Entities (registry): **${d.entities.length}**`);
  lines.push(`- Live states: **${d.states.length}**`);
  lines.push(`- Integrations (config entries): **${d.configEntries.length}**`);
  lines.push(`- Automations: **${d.automations.length}**`);
  lines.push(`- Scripts: **${d.scripts.length}**`);
  lines.push(`- Scenes: **${d.scenes.length}**`);
  lines.push(`- Dashboards: **${d.dashboards.length}**\n`);
  lines.push(`## Major systems present`);
  lines.push(`- Media players: ${audioCount}`);
  lines.push(`- Lights: ${lightCount}`);
  lines.push(`- Climate: ${climateCount}`);
  lines.push(`- Cameras: ${cameraCount}`);
  lines.push(`- Sensors: ${sensorCount}\n`);
  lines.push(`## Top integrations by entity count`);
  for (const [k, v] of topIntegrations) lines.push(`- \`${k}\` — ${v}`);
  lines.push(`\n## Strongest dashboard opportunities`);
  if (audioCount > 4) lines.push(`- Multi-room audio scenes (${audioCount} media players)`);
  if (lightCount > 10) lines.push(`- Lighting scene library (${lightCount} lights)`);
  if (climateCount > 1) lines.push(`- Per-zone climate page (${climateCount} thermostats)`);
  if (cameraCount > 1) lines.push(`- Security wall (${cameraCount} cameras)`);
  const energySensors = d.states.filter(
    (s) =>
      domainOf(s.entity_id) === "sensor" &&
      /power|energy|battery|grid|solar|envoy|powerwall|span/i.test(s.entity_id),
  );
  if (energySensors.length > 5)
    lines.push(`- Energy summary (${energySensors.length} energy-related sensors)`);
  lines.push(`\n## Biggest cleanup issues`);
  const noArea = d.entities.filter(
    (e) => !e.area_id && (!e.device_id || !idx.deviceById.get(e.device_id)?.area_id),
  ).length;
  const disabled = d.entities.filter((e) => e.disabled_by).length;
  const hidden = d.entities.filter((e) => e.hidden_by).length;
  const unavailable = d.states.filter(
    (s) => s.state === "unavailable" || s.state === "unknown",
  ).length;
  lines.push(`- Entities without area assignment: **${noArea}**`);
  lines.push(`- Disabled entities: **${disabled}**`);
  lines.push(`- Hidden entities: **${hidden}**`);
  lines.push(`- Currently unavailable / unknown: **${unavailable}**`);
  return lines.join("\n");
}

export function buildAreaMap(d: SurveyData): string {
  const idx = indexEntities(d);
  const lines: string[] = [`# Area Map\n`];
  lines.push(`Total areas: ${d.areas.length}\n`);
  const byArea = new Map<string, { devices: DeviceEntry[]; states: HAState[] }>();
  for (const a of d.areas) byArea.set(a.area_id, { devices: [], states: [] });
  for (const dev of d.devices) {
    if (dev.area_id && byArea.has(dev.area_id)) {
      byArea.get(dev.area_id)!.devices.push(dev);
    }
  }
  for (const s of d.states) {
    const reg = idx.regByEntity.get(s.entity_id);
    if (!reg) continue;
    let aid = reg.area_id;
    if (!aid && reg.device_id) {
      aid = idx.deviceById.get(reg.device_id)?.area_id ?? null;
    }
    if (aid && byArea.has(aid)) byArea.get(aid)!.states.push(s);
  }
  for (const a of d.areas.sort((x, y) => x.name.localeCompare(y.name))) {
    const bucket = byArea.get(a.area_id)!;
    lines.push(`## ${a.name}`);
    lines.push(`Devices: ${bucket.devices.length} · Entities: ${bucket.states.length}\n`);
    if (bucket.devices.length) {
      lines.push(`### Devices`);
      for (const dev of bucket.devices.slice(0, 30)) {
        const name = dev.name_by_user ?? dev.name ?? dev.id;
        lines.push(`- **${name}** — ${dev.manufacturer ?? "?"} ${dev.model ?? ""}`);
      }
      if (bucket.devices.length > 30)
        lines.push(`- _… ${bucket.devices.length - 30} more_`);
      lines.push("");
    }
    const byDomain = new Map<string, HAState[]>();
    for (const s of bucket.states) {
      const dom = domainOf(s.entity_id);
      if (!byDomain.has(dom)) byDomain.set(dom, []);
      byDomain.get(dom)!.push(s);
    }
    const order = [
      "light", "switch", "media_player", "climate", "cover", "camera",
      "lock", "alarm_control_panel", "binary_sensor", "sensor", "scene",
      "script", "fan", "select", "number",
    ];
    const domainsHere = [...byDomain.keys()].sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    if (domainsHere.length) {
      lines.push(`### Entities by domain`);
      for (const dom of domainsHere) {
        const arr = byDomain.get(dom)!;
        lines.push(`- **${dom}** (${arr.length}): ${arr.slice(0, 8).map((s) => `\`${s.entity_id}\``).join(", ")}${arr.length > 8 ? `, _+${arr.length - 8} more_` : ""}`);
      }
    }
    lines.push("");
  }
  const orphans = d.states.filter((s) => {
    const reg = idx.regByEntity.get(s.entity_id);
    if (!reg) return true;
    if (reg.area_id) return false;
    if (reg.device_id && idx.deviceById.get(reg.device_id)?.area_id) return false;
    return true;
  });
  lines.push(`## Unassigned (no area)`);
  lines.push(`Total: ${orphans.length}\n`);
  const orphansByDomain = new Map<string, number>();
  for (const o of orphans) {
    const dom = domainOf(o.entity_id);
    orphansByDomain.set(dom, (orphansByDomain.get(dom) ?? 0) + 1);
  }
  for (const [dom, n] of [...orphansByDomain.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    lines.push(`- ${dom}: ${n}`);
  }
  return lines.join("\n");
}

export function buildAudioInventory(d: SurveyData): string {
  const idx = indexEntities(d);
  const players = idx.entitiesByDomain.get("media_player") ?? [];
  const lines: string[] = [`# Audio / Media Inventory\n`];
  lines.push(`Total media players: **${players.length}**\n`);

  const byIntegration = new Map<string, HAState[]>();
  for (const p of players) {
    const integ = idx.integrationForEntity(p.entity_id) ?? "unknown";
    if (!byIntegration.has(integ)) byIntegration.set(integ, []);
    byIntegration.get(integ)!.push(p);
  }
  lines.push(`## By integration`);
  for (const [integ, arr] of [...byIntegration.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    lines.push(`- **${integ}** — ${arr.length}`);
  }
  lines.push("");

  lines.push(`## All media players`);
  lines.push(
    mdTable(
      ["entity_id", "friendly_name", "area", "integration", "state", "source", "volume"],
      players.map((p) => [
        `\`${p.entity_id}\``,
        friendly(p),
        idx.areaForEntity(p.entity_id) ?? "_unassigned_",
        idx.integrationForEntity(p.entity_id) ?? "?",
        p.state,
        String(p.attributes.source ?? ""),
        p.attributes.volume_level !== undefined
          ? `${Math.round((p.attributes.volume_level as number) * 100)}%`
          : "—",
      ]),
    ),
  );
  lines.push("");

  const bluesound = players.filter(
    (p) =>
      /bluesound|bluos/i.test(p.entity_id) ||
      idx.integrationForEntity(p.entity_id) === "bluesound",
  );
  const sonos = players.filter(
    (p) =>
      /sonos/i.test(p.entity_id) || idx.integrationForEntity(p.entity_id) === "sonos",
  );
  const tvs = players.filter((p) =>
    /tv|appletv|androidtv|firetv|roku|cast|chromecast|samsung|lg/i.test(
      p.entity_id,
    ),
  );

  const dump = (title: string, arr: HAState[]) => {
    lines.push(`## ${title} (${arr.length})`);
    for (const p of arr) {
      lines.push(`### \`${p.entity_id}\``);
      lines.push(`- friendly_name: ${friendly(p)}`);
      lines.push(`- area: ${idx.areaForEntity(p.entity_id) ?? "_unassigned_"}`);
      lines.push(`- state: ${p.state}`);
      const sl = p.attributes.source_list as string[] | undefined;
      if (sl?.length) lines.push(`- source_list: ${sl.join(", ")}`);
      const sf = p.attributes.supported_features;
      if (sf !== undefined) lines.push(`- supported_features: ${sf}`);
      const grp = p.attributes.group_members as string[] | undefined;
      if (grp?.length) lines.push(`- group_members: ${grp.join(", ")}`);
    }
    lines.push("");
  };
  if (bluesound.length) dump("Bluesound / BluOS", bluesound);
  if (sonos.length) dump("Sonos", sonos);
  if (tvs.length) dump("TVs / streamers", tvs);

  lines.push(`## Audio scene candidates`);
  const areasWithAudio = new Map<string, HAState[]>();
  for (const p of players) {
    const area = idx.areaForEntity(p.entity_id) ?? "_unassigned_";
    if (!areasWithAudio.has(area)) areasWithAudio.set(area, []);
    areasWithAudio.get(area)!.push(p);
  }
  lines.push(`### Audio zones (rooms with media players)`);
  for (const [area, arr] of areasWithAudio) {
    lines.push(`- **${area}** — ${arr.map((p) => `\`${p.entity_id}\``).join(", ")}`);
  }
  return lines.join("\n");
}

export function buildEnergyInventory(d: SurveyData): string {
  const idx = indexEntities(d);
  const sensors = idx.entitiesByDomain.get("sensor") ?? [];

  const match = (re: RegExp) =>
    sensors.filter(
      (s) => re.test(s.entity_id) || re.test(friendly(s)),
    );

  const solar = match(/solar|envoy|pv_power|production|panel/i);
  const battery = match(/powerwall|battery|charge_state|gateway/i);
  const grid = match(/grid|import|export|net|utility/i);
  const home = match(/home_power|consumption|load|usage|current_power_consumption/i);
  const dailyEnergy = sensors.filter(
    (s) => (s.attributes.unit_of_measurement as string | undefined) === "kWh",
  );

  const lines: string[] = [`# Energy Inventory\n`];
  const dump = (title: string, arr: HAState[]) => {
    lines.push(`## ${title} (${arr.length})`);
    if (!arr.length) {
      lines.push(`_(none detected)_\n`);
      return;
    }
    lines.push(
      mdTable(
        ["entity_id", "friendly_name", "state", "unit", "area"],
        arr.slice(0, 50).map((s) => [
          `\`${s.entity_id}\``,
          friendly(s),
          s.state,
          (s.attributes.unit_of_measurement as string | undefined) ?? "",
          idx.areaForEntity(s.entity_id) ?? "—",
        ]),
      ),
    );
    if (arr.length > 50) lines.push(`_… +${arr.length - 50} more_`);
    lines.push("");
  };
  dump("Solar production", solar);
  dump("Battery / Powerwall", battery);
  dump("Grid import/export", grid);
  dump("Home / load consumption", home);
  dump("Daily energy totals (kWh sensors)", dailyEnergy);

  lines.push(`## Suggested "Energy at a glance" entities`);
  const pick = (arr: HAState[]) =>
    arr.find(
      (s) => s.state !== "unavailable" && s.state !== "unknown" && !isNaN(parseFloat(s.state)),
    );
  const usingNow = pick(home);
  const creatingNow = pick(solar);
  const batteryNow = pick(battery.filter((s) => s.attributes.unit_of_measurement === "%"));
  const gridToday = pick(grid.filter((s) => s.attributes.unit_of_measurement === "kWh"));
  lines.push(`- **using now**: ${usingNow ? `\`${usingNow.entity_id}\`` : "_none found_"}`);
  lines.push(`- **creating now**: ${creatingNow ? `\`${creatingNow.entity_id}\`` : "_none found_"}`);
  lines.push(`- **battery now**: ${batteryNow ? `\`${batteryNow.entity_id}\`` : "_none found_"}`);
  lines.push(`- **grid used today**: ${gridToday ? `\`${gridToday.entity_id}\`` : "_none found_"}`);
  return lines.join("\n");
}

export function buildExistingYaml(d: SurveyData): string {
  const lines: string[] = [`# Existing YAML / JSON Reference\n`];
  const stringify = (label: string, items: unknown[]) => {
    lines.push(`## ${label} (${items.length})`);
    if (!items.length) {
      lines.push(`_(none)_\n`);
      return;
    }
    lines.push("```yaml");
    for (const item of items) {
      lines.push(`# ---`);
      try {
        lines.push(jsonToYaml(item, 0));
      } catch {
        lines.push(JSON.stringify(item, null, 2));
      }
    }
    lines.push("```\n");
  };
  stringify("Automations", d.automations);
  stringify("Scripts", d.scripts);
  stringify("Scenes", d.scenes);
  lines.push(`## Dashboards`);
  if (!d.dashboards.length) lines.push(`_(none)_`);
  else {
    for (const d2 of d.dashboards as Array<Record<string, unknown>>) {
      lines.push(`- **${d2.title ?? d2.url_path}** — \`${d2.url_path}\` (mode: ${d2.mode ?? "?"})`);
    }
  }
  return lines.join("\n");
}

function jsonToYaml(value: unknown, indent: number): string {
  const pad = "  ".repeat(indent);
  if (value === null) return "null";
  if (typeof value === "string") {
    if (/[:\n#&*?{}\[\]|>!%@`,]/.test(value) || value === "") {
      return JSON.stringify(value);
    }
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return value
      .map((v) => `${pad}- ${jsonToYaml(v, indent + 1).replace(/^/, "").trimStart()}`)
      .join("\n");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (!keys.length) return "{}";
    return keys
      .map((k) => {
        const v = obj[k];
        if (
          v !== null &&
          (typeof v === "object" || Array.isArray(v)) &&
          (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0)
        ) {
          return `${pad}${k}:\n${jsonToYaml(v, indent + 1)}`;
        }
        return `${pad}${k}: ${jsonToYaml(v, indent + 1)}`;
      })
      .join("\n");
  }
  return "";
}

export function buildPackage(d: SurveyData): string {
  const idx = indexEntities(d);
  const lines: string[] = [`# PACKAGE FOR YAML DESIGN\n`];
  lines.push(`## Areas`);
  for (const a of d.areas.sort((x, y) => x.name.localeCompare(y.name))) {
    lines.push(`- ${a.name} (\`${a.area_id}\`)`);
  }
  lines.push(`\n## Existing scripts`);
  for (const s of d.scripts as Array<Record<string, unknown>>) {
    lines.push(`- ${s.alias ?? s.id ?? "?"} (\`script.${s.id}\`)`);
  }
  lines.push(`\n## Existing scenes`);
  for (const s of d.scenes as Array<Record<string, unknown>>) {
    lines.push(`- ${s.name ?? s.id} (\`scene.${s.id}\`)`);
  }
  lines.push(`\n## Existing automations`);
  for (const s of d.automations as Array<Record<string, unknown>>) {
    lines.push(`- ${s.alias ?? s.id ?? "?"}`);
  }
  const promote = (domain: string) => {
    const arr = idx.entitiesByDomain.get(domain) ?? [];
    return arr
      .map((s) => `  - \`${s.entity_id}\` — ${friendly(s)} (${idx.areaForEntity(s.entity_id) ?? "—"})`)
      .join("\n");
  };
  lines.push(`\n## Lights\n${promote("light")}`);
  lines.push(`\n## Switches\n${promote("switch")}`);
  lines.push(`\n## Media players\n${promote("media_player")}`);
  lines.push(`\n## Climate\n${promote("climate")}`);
  lines.push(`\n## Covers\n${promote("cover")}`);
  lines.push(`\n## Cameras\n${promote("camera")}`);
  lines.push(`\n## Locks\n${promote("lock")}`);
  lines.push(`\n## Alarms\n${promote("alarm_control_panel")}`);
  lines.push(`\n## Recommended dashboard structure`);
  lines.push(`- Whole-house overview (Super View tiles already in this app)`);
  for (const a of d.areas.slice(0, 12))
    lines.push(`- Room: ${a.name}`);
  lines.push(`- Audio scenes page`);
  lines.push(`- Energy page`);
  lines.push(`- Security/status page`);
  return lines.join("\n");
}

export function buildAllReports(d: SurveyData): Record<string, string> {
  return {
    "ha_executive_summary.md": buildExecutiveSummary(d),
    "ha_area_map.md": buildAreaMap(d),
    "ha_audio_inventory.md": buildAudioInventory(d),
    "ha_energy_inventory.md": buildEnergyInventory(d),
    "ha_existing_yaml.md": buildExistingYaml(d),
    "ha_package.md": buildPackage(d),
  };
}
