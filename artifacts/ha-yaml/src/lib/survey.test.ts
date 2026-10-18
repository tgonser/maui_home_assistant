import test from "node:test";
import assert from "node:assert/strict";
import { load } from "js-yaml";
import { collectSurvey, CONFIGURATION_CONCURRENCY, registryCommands, type SurveyTransport } from "./surveyRetrieval.ts";
import { buildAllReports, buildExistingYaml, buildExecutiveSummary, buildPackage, getSurveyWarnings } from "./survey.ts";
import { sanitizeSurvey } from "./surveySanitize.ts";
import type { HAState } from "./ha.ts";

const state = (entity_id: string, attributes: Record<string, unknown> = {}): HAState => ({
  entity_id, attributes, state: "off", last_changed: "", last_updated: "",
});
const ok = <T>(data: T) => ({ ok: true as const, status: 200, data });

function transport(states: HAState[], overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const api: SurveyTransport = {
    async call<T>(path: string) {
      calls.push(path);
      const value = path in overrides ? overrides[path] :
        path === "/api/states" ? states : path === "/api/config" ? { location_name: "Home" } : { alias: "Existing config" };
      if (value instanceof Error) throw value;
      if (value && typeof value === "object" && "ok" in value) return value as Awaited<ReturnType<SurveyTransport["call"]>> as { ok: true; status: number; data: T };
      return ok(value as T);
    },
    async wsBatch() {
      return { ok: true, results: registryCommands.map((_, index) => ({ id: index + 1, success: true, result: [] })) };
    },
  };
  return { api, calls };
}

test("scene configuration uses its stored ID when available", async () => {
  const { api, calls } = transport([state("scene.relax", { id: "stored-scene" })]);
  await collectSurvey(api);
  assert.ok(calls.includes("/api/config/scene/config/stored-scene"));
  assert.ok(!calls.includes("/api/config/scene/config/relax"));
});

test("inventory stays accurate with failed config endpoints; automation IDs are not entity object IDs", async () => {
  const { api, calls } = transport([
    state("automation.friendly_slug", { id: "123/id" }),
    state("automation.yaml_without_id"),
    state("script.bedtime"),
    state("scene.relax"),
  ], {
    "/api/config/automation/config/123%2Fid": { ok: false, status: 403, error: "Forbidden" },
    "/api/config/script/config/bedtime": { ok: false, status: 404, error: "Not found" },
    "/api/config/scene/config/relax": { ok: false, status: 500, error: "Server failed" },
  });
  const result = await collectSurvey(api);
  assert.equal(result.ok, true);
  const data = result.data!;
  assert.equal(data.states.length, 4);
  assert.equal(data.automations.length, 0);
  assert.equal(data.configurationRetrieval?.[1].status, "missing_id");
  assert.ok(calls.includes("/api/config/automation/config/123%2Fid"));
  assert.ok(!calls.some((path) => path.endsWith("/friendly_slug") || path.endsWith("/yaml_without_id")));
  // /api/config itself is required; no nonexistent collection-config endpoints.
  assert.ok(calls.includes("/api/config"));
  assert.ok(!calls.includes("/api/config/automation/config"));
  const summary = buildExecutiveSummary(data);
  assert.match(summary, /Automations \(live states\): \*\*2\*\*/);
  assert.match(summary, /Scripts \(live states\): \*\*1\*\*/);
  const reference = buildExistingYaml(data);
  assert.match(reference, /HTTP 403/);
  assert.match(reference, /HTTP 404/);
  assert.match(reference, /HTTP 500/);
  assert.match(reference, /Missing attributes.id/);
  assert.doesNotMatch(reference, /_\(none\)_/);
  assert.match(buildPackage(data), /automation\.yaml_without_id/);
  assert.match(buildPackage(data), /scene\.relax/);
});

test("per-entity config reads use bounded concurrency, preserve association and only perform reads", async () => {
  const { api, calls } = transport(Array.from({ length: 13 }, (_, index) => state(`script.test_${index}`)));
  const original = api.call;
  let active = 0;
  let peak = 0;
  api.call = async <T>(path: string) => {
    if (!path.startsWith("/api/config/script/config/")) return original<T>(path);
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, path.endsWith("0") ? 6 : 1));
    active--;
    calls.push(path);
    return ok({ alias: path } as T);
  };
  const { data } = await collectSurvey(api);
  assert.equal(peak, CONFIGURATION_CONCURRENCY);
  assert.equal(data?.scripts.length, 13);
  data?.configurationRetrieval?.forEach((entry, index) => {
    assert.equal(entry.entityId, `script.test_${index}`);
    assert.equal(entry.configuration?.alias, `/api/config/script/config/test_${index}`);
  });
  assert.ok(calls.every((path) => !/services|reload|turn_on/.test(path)));
});

test("individual registry failures and missing results are explicit even when batch succeeds", async () => {
  const { api } = transport([state("script.real")]);
  api.wsBatch = async () => ({
    ok: true,
    results: [
      { id: 3, success: true, result: [] },
      { id: 1, success: false, error: { code: "unauthorized", message: "Admin required" } },
      { id: 4, success: true, result: "unexpected" },
      { id: 5, success: true, result: [] },
      { id: 6, success: false, error: { code: "unknown_command", message: "Unsupported" } },
    ],
  });
  const { data } = await collectSurvey(api);
  assert.equal(data?.sources?.areas.status, "unavailable");
  assert.equal(data?.sources?.devices.status, "retrieved");
  assert.equal(data?.sources?.floors.status, "unavailable");
  assert.equal(data?.sources?.entities.status, "unavailable");
  const reports = buildAllReports(data!);
  assert.match(reports["ha_survey_warnings.md"], /unauthorized: Admin required/);
  assert.match(reports["ha_survey_warnings.md"], /floors.*Missing response/);
  assert.match(reports["ha_survey_warnings.md"], /entities.*Expected an array/);
  assert.match(reports["ha_executive_summary.md"], /Areas: \*\*unavailable\*\* \(not zero\)/);
  assert.match(reports["ha_existing_yaml.md"], /does not mean no dashboards/);
});

test("instance-config and entire WS failure do not discard an available live inventory", async () => {
  const { api } = transport([state("automation.live", { id: "777" })], {
    "/api/config": { ok: false, status: 401, error: "Unauthorized" },
  });
  api.wsBatch = async () => { throw new Error("Connection lost"); };
  const { ok: succeeded, data } = await collectSurvey(api);
  assert.equal(succeeded, true);
  assert.equal(data?.automations.length, 1);
  assert.match(getSurveyWarnings(data!).join("\n"), /Instance config unavailable: HTTP 401/);
  assert.match(getSurveyWarnings(data!).join("\n"), /Connection lost/);
  assert.equal(Object.values(data!.sources!).filter((s) => s.status === "unavailable").length, 7);
});

test("unavailable or invalid live states never produce a successful empty inventory", async () => {
  for (const value of [{ ok: false, status: 503, error: "Unavailable" }, {}, [null]]) {
    const { api } = transport([], { "/api/states": value });
    const result = await collectSurvey(api);
    assert.equal(result.ok, false);
    assert.match(result.error!, /Live inventory unavailable/);
  }
});

test("proper YAML serialization round-trips nested sequences, multiline templates, quoted values and keys", async () => {
  const config = {
    alias: "true",
    "odd: key": "null",
    sequence: [
      { choose: [{ conditions: "{{ states('sensor.x') == 'on' }}\n", sequence: [{ action: "light.turn_on", target: { entity_id: ["light.a", "light.b"] } }] }] },
      { delay: "00:01:00" },
    ],
  };
  const { api } = transport([state("script.existing")], { "/api/config/script/config/existing": config });
  const { data } = await collectSurvey(api);
  const report = buildExistingYaml(data!);
  const blocks = [...report.matchAll(/```yaml\n([\s\S]*?)\n```/g)];
  assert.equal(blocks.length, 1);
  assert.deepEqual(load(blocks[0][1]), config);
  assert.match(report, /Source: GET \/api\/config\/script\/config\/existing/);
});

test("all reports redact nested credentials, token entity states and URLs without mutating source", async () => {
  const configuration = {
    alias: "Safe",
    nested: { access_token: "secret-token-value", apiKey: "secret-api-value", password: "secret-password-value" },
    sequence: [{ data: { url: "https://user:pass@private.example/secret?token=abc" } }],
    description: "Fetch https://private.example/path?token=abc with Bearer privateBearer123",
  };
  const { api } = transport([
    state("script.existing"),
    { ...state("input_text.approval_token"), state: "secret-state-value" },
    state("sensor.solar", { entity_picture: "https://private.example/image", friendly_name: "Solar" }),
  ], { "/api/config/script/config/existing": configuration });
  const { data } = await collectSurvey(api);
  const before = JSON.stringify(data);
  const reports = buildAllReports(data!);
  const combined = Object.values(reports).join("\n");
  assert.doesNotMatch(combined, /secret-(?:token|api|password|state)-value|private\.example|privateBearer123/);
  assert.match(combined, /REDACTED/);
  assert.match(reports["ha_package.md"], /sensor\.solar/);
  assert.match(reports["ha_package.md"], /inventory_source: GET \/api\/states/);
  assert.equal(JSON.stringify(data), before);
  assert.equal(configuration.nested.access_token, "secret-token-value");
  assert.deepEqual(sanitizeSurvey({ headers: { Authorization: "Basic private" } }), { headers: { Authorization: "[REDACTED]" } });
});

test("empty live domains are described as live-only absence, not proof of missing configuration", async () => {
  const { api } = transport([]);
  const { data } = await collectSurvey(api);
  const reports = buildAllReports(data!);
  assert.match(reports["ha_existing_yaml.md"], /No entities in live states.*non-live configurations are unknown/);
  assert.match(reports["ha_package.md"], /not a complete configuration export/);
});
