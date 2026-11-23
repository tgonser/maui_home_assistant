import { useMemo, useState } from "react";
import { haCall, haCallService, type HAState } from "@/lib/ha";
import { LIGHT_SECTIONS, roomStatus } from "@/lib/houseMap";
import { buildSceneConfig, PLANNED_SCENES, sceneSlug } from "@/lib/scenes";

// Lights: every room by floor (tap = on/off, whole house fits on one screen)
// and a Scenes tab with "Save as scene" capture.

type Props = { states: Map<string, HAState>; now: number };

export function LightsScreen({ states, now }: Props) {
  const [tab, setTab] = useState<"rooms" | "scenes">("rooms");
  const status = useMemo(() => roomStatus(states, now), [states, now]);
  const lit = [...status.values()].reduce((a, s) => a + s.lightsOn, 0);
  const roomsLit = LIGHT_SECTIONS.flatMap((s) => s.groups).filter(([g]) => (status.get(g)?.lightsOn ?? 0) > 0).length;
  return (
    <div className="v2-lights">
      <div className="v2-tabs-row">
        <div className="v2-seg" role="tablist" aria-label="Lights view">
          {(["rooms", "scenes"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {t === "rooms" ? "Rooms" : "Scenes"}
            </button>
          ))}
        </div>
        <span className="v2-muted">{lit ? `${lit} lights on in ${roomsLit} rooms` : "Everything is off"}</span>
      </div>
      {tab === "rooms" ? <Rooms status={status} /> : <Scenes states={states} status={status} />}
    </div>
  );
}

function Rooms({ status }: { status: ReturnType<typeof roomStatus> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const toggle = async (key: string, ids: string[], on: boolean) => {
    if (!ids.length) return;
    setBusy(key);
    await haCallService("light", on ? "turn_on" : "turn_off", { entity_id: ids });
    setBusy(null);
  };
  return (
    <div className="v2-light-sections">
      {LIGHT_SECTIONS.map((sec) => {
        const secOn = sec.groups.flatMap(([g]) => ((status.get(g)?.lightsOn ?? 0) > 0 ? status.get(g)!.lightIds : []));
        return (
          <section key={sec.title} className="v2-card v2-light-sec" aria-label={sec.title}>
            <div className="v2-sec-head">
              <span className="v2-h">{sec.title}</span>
              <button type="button" className="v2-mini" disabled={!secOn.length || busy === sec.title} onClick={() => toggle(sec.title, secOn, false)}>
                {sec.title === "Outside" ? "All outside off" : `${sec.title} off`}
              </button>
            </div>
            <div className="v2-light-grid">
              {sec.groups.map(([g, name]) => {
                const s = status.get(g);
                const n = s?.lightIds.length ?? 0;
                const c = s?.lightsOn ?? 0;
                const state = n === 0 ? "No lights" : c === 0 ? "Off" : c === n ? "On" : `Mixed · ${c}/${n}`;
                const cls = c === 0 ? "" : c === n ? " all" : " some";
                return (
                  <button
                    key={g}
                    type="button"
                    className={`v2-ltile${cls}`}
                    aria-pressed={c > 0}
                    aria-label={`${name}, ${state}. Tap to turn ${c > 0 ? "off" : "on"}`}
                    disabled={n === 0 || busy === g}
                    onClick={() => toggle(g, s!.lightIds, c === 0)}
                  >
                    <span className="v2-ltile-name">{name}</span>
                    <span className="v2-ltile-state">{busy === g ? "…" : state}</span>
                    <span className="v2-ltile-bar"><i style={{ width: n ? `${Math.round((100 * c) / n)}%` : 0 }} /></span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

type SceneItem = { key: string; name: string; entity?: string; kind: "scene" | "script" | "planned"; wall: boolean; sub: string };

function ago(iso: string | undefined, now: number) {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "";
  const m = Math.round((now - t) / 60_000);
  if (m < 1) return "Ran just now";
  if (m < 60) return `Ran ${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `Ran ${h} h ago` : `Ran ${Math.round(h / 24)} days ago`;
}

function Scenes({ states, status }: { states: Map<string, HAState>; status: ReturnType<typeof roomStatus> }) {
  const now = Date.now();
  const [busy, setBusy] = useState<string | null>(null);
  const [capture, setCapture] = useState<{ name: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const items: SceneItem[] = useMemo(() => {
    const list: SceneItem[] = [];
    const leave = states.get("script.maui_leave");
    if (leave) list.push({ key: leave.entity_id, entity: leave.entity_id, name: "Leave", kind: "script", wall: false, sub: "All lights off, all shades closed" });
    const scenes = [...states.values()].filter((s) => s.entity_id.startsWith("scene."));
    for (const s of scenes) {
      const id = String(s.attributes.id ?? "");
      list.push({ key: s.entity_id, entity: s.entity_id, name: String(s.attributes.friendly_name ?? s.entity_id), kind: "scene", wall: id.startsWith("wall_"), sub: ago(s.state, now) || "Scene" });
    }
    const have = new Set(scenes.map((s) => String(s.attributes.id ?? "")));
    for (const p of PLANNED_SCENES) if (!have.has(sceneSlug(p))) list.push({ key: `planned:${p}`, name: p, kind: "planned", wall: true, sub: "Not set up yet — set the lights, then save" });
    return list;
  }, [states, now]);

  const run = async (it: SceneItem) => {
    if (it.kind === "planned") { setCapture({ name: it.name }); return; }
    setBusy(it.key);
    await haCallService(it.kind === "script" ? "script" : "scene", "turn_on", { entity_id: it.entity });
    setBusy(null);
  };

  return (
    <div className="v2-scenes">
      {msg && <div className="v2-alert" role="status">{msg}</div>}
      <div className="v2-scene-grid">
        {items.map((it) => (
          <div key={it.key} className={`v2-scene${it.kind === "planned" ? " planned" : ""}`}>
            <button type="button" className="v2-scene-run" disabled={busy === it.key} onClick={() => run(it)} aria-label={it.kind === "planned" ? `Set up ${it.name}` : `Run ${it.name}`}>
              <span className="v2-scene-name">{it.name}</span>
              <span className="v2-scene-sub">{busy === it.key ? "Running…" : it.sub}</span>
            </button>
            {it.wall && it.kind === "scene" && (
              <button type="button" className="v2-mini" onClick={() => setCapture({ name: it.name })}>Re-capture</button>
            )}
          </div>
        ))}
        <button type="button" className="v2-scene v2-scene-new" onClick={() => setCapture({ name: "" })}>
          <span className="v2-scene-name">+ Save as scene</span>
          <span className="v2-scene-sub">Set the lights how you like them, then tap here</span>
        </button>
      </div>
      {capture && (
        <CaptureDialog
          initialName={capture.name}
          states={states}
          status={status}
          onClose={(m) => { setCapture(null); if (m) { setMsg(m); window.setTimeout(() => setMsg(null), 6000); } }}
        />
      )}
    </div>
  );
}

function CaptureDialog({ initialName, states, status, onClose }: { initialName: string; states: Map<string, HAState>; status: ReturnType<typeof roomStatus>; onClose: (msg?: string) => void }) {
  const [name, setName] = useState(initialName);
  const [scope, setScope] = useState("house");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const scopes: Array<[string, string]> = [["house", "Whole house (lights + shades)"], ...LIGHT_SECTIONS.map((s) => [`sec:${s.title}`, s.title] as [string, string]), ...LIGHT_SECTIONS.flatMap((s) => s.groups.filter(([g]) => (status.get(g)?.lightIds.length ?? 0) > 0))];
  const ids = useMemo(() => {
    if (scope === "house") {
      const lights = [...status.values()].flatMap((s) => s.lightIds);
      const shades = [...states.values()].filter((s) => s.entity_id.startsWith("cover.") && s.attributes.device_class === "shade").map((s) => s.entity_id);
      return [...lights, ...shades];
    }
    if (scope.startsWith("sec:")) {
      const sec = LIGHT_SECTIONS.find((s) => `sec:${s.title}` === scope);
      return (sec?.groups ?? []).flatMap(([g]) => status.get(g)?.lightIds ?? []);
    }
    return status.get(scope)?.lightIds ?? [];
  }, [scope, status, states]);
  const picked = ids.map((id) => states.get(id)).filter((s): s is HAState => !!s);
  const onCount = picked.filter((s) => s.entity_id.startsWith("light.") && s.state === "on").length;
  const shadeCount = picked.filter((s) => s.entity_id.startsWith("cover.")).length;
  const exists = [...states.values()].some((s) => s.entity_id.startsWith("scene.") && s.attributes.id === sceneSlug(name));

  const save = async () => {
    const clean = name.trim();
    if (!clean) { setErr("Give the scene a name."); return; }
    setSaving(true); setErr(null);
    const cfg = buildSceneConfig(clean, picked);
    const r = await haCall(`/api/config/scene/config/${cfg.id}`, { method: "POST", body: cfg });
    if (!r.ok) { setSaving(false); setErr(`Couldn't save: ${r.error}`); return; }
    await haCallService("scene", "reload", {});
    onClose(`Saved "${clean}" — ${onCount} lights on${shadeCount ? `, ${shadeCount} shades` : ""}.`);
  };

  return (
    <div className="v2-modal" role="dialog" aria-modal="true" aria-label="Save as scene">
      <div className="v2-card v2-modal-card">
        <div className="v2-h">Save as scene</div>
        <p className="v2-muted">Captures exactly what's on now and at what level. Running the scene later puts it back.</p>
        <label className="v2-field">Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dinner" autoFocus />
        </label>
        <label className="v2-field">What to capture
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            {scopes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <div className="v2-muted">{picked.length} lights{shadeCount ? ` and ${shadeCount} shades` : ""} · {onCount} on now{exists ? " · replaces the saved version" : ""}</div>
        {err && <div className="v2-alert">{err}</div>}
        <div className="v2-modal-actions">
          <button type="button" className="v2-btn" onClick={() => onClose()}>Cancel</button>
          <button type="button" className="v2-btn v2-primary" disabled={saving || picked.length === 0} onClick={save}>{saving ? "Saving…" : exists ? "Replace scene" : "Save scene"}</button>
        </div>
      </div>
    </div>
  );
}
