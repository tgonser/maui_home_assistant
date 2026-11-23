import { useEffect, useMemo, useState } from "react";
import { haAutoConnectIfAddon, haCallService, useHAStore, type HAState } from "@/lib/ha";
import { useLiveStates, type LiveMode } from "@/lib/liveStates";
import { energyNow, GUEST_SUITES, restartMinute, roomStatus, ROOM_CLIMATE, suiteInUse, FLOORS } from "@/lib/houseMap";
import { HouseMap } from "./HouseMap";
import { LightsScreen } from "./LightsScreen";
import "./wall-v2.css";

// The redesigned wall (sand palette, menu across the top). Screens are added
// one at a time; until a screen exists here its tab opens the classic wall.

export const UI_KEY = "wall:ui";
export function setWallUi(ui: "v2" | "classic") {
  try { localStorage.setItem(UI_KEY, ui); } catch { /* private mode */ }
  window.location.reload();
}
export function wantsWallV2(): boolean {
  try { return localStorage.getItem(UI_KEY) === "v2"; } catch { return false; }
}

const NAV = ["Home", "Rooms", "Lights", "Climate", "Shades", "Music", "Energy", "Alarm", "Cameras"] as const;
type Nav = (typeof NAV)[number];
const BUILT: Nav[] = ["Home", "Lights"];
const MAUI_TZ = "Pacific/Honolulu";

export function WallV2() {
  const url = useHAStore((s) => s.url);
  const [tab, setTab] = useState<Nav>("Home");
  const [now, setNow] = useState(Date.now());
  const { states, mode, error } = useLiveStates();

  useEffect(() => { if (!url) void haAutoConnectIfAddon(); }, [url]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const houseMode = states.get("input_select.maui_house_mode")?.state ?? "";
  const outside = Number(states.get("sensor.makena_4_temperature")?.state);
  const d = new Date(now);
  const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: MAUI_TZ });
  const [hm, ampm] = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: MAUI_TZ }).split(" ");

  if (!url) {
    return <div className="v2-root v2-center">Connecting to Home Assistant…</div>;
  }

  return (
    <div className="v2-root">
      <header className="v2-header">
        <div className="v2-brand">
          <span className="v2-title">Mākena</span>
          <span className="v2-sub">{dateStr}{houseMode ? ` · ${houseMode}` : ""}</span>
        </div>
        <div className="v2-header-right">
          <LiveDot mode={mode} error={error} />
          {Number.isFinite(outside) && <span className="v2-chip">Outside {Math.round(outside)}°</span>}
          <span className="v2-clock">{hm} <small>{ampm}</small></span>
          <button type="button" className="v2-link" onClick={() => setWallUi("classic")}>Classic view</button>
        </div>
      </header>
      <nav className="v2-nav" aria-label="Sections">
        {NAV.map((n) => (
          <button key={n} type="button" aria-current={tab === n ? "page" : undefined} className={tab === n ? "v2-nav-on" : ""} onClick={() => setTab(n)}>
            {n}
          </button>
        ))}
      </nav>
      <main className="v2-main">
        {tab === "Home" ? (
          <HomeScreen states={states} now={now} />
        ) : tab === "Lights" ? (
          <LightsScreen states={states} now={now} />
        ) : (
          <NotYet name={tab} built={BUILT} />
        )}
      </main>
    </div>
  );
}

function LiveDot({ mode, error }: { mode: LiveMode; error: string | null }) {
  const label = mode === "live" ? "Live" : mode === "polling" ? "Updating every 6 s" : mode === "error" ? `Offline: ${error ?? ""}` : "Connecting";
  return <span className={`v2-live v2-live-${mode}`} title={label} role="status" aria-label={label}><i />{mode === "live" ? "Live" : mode === "polling" ? "Polling" : mode === "error" ? "Offline" : "…"}</span>;
}

function NotYet({ name }: { name: string; built: Nav[] }) {
  return (
    <section className="v2-card v2-center v2-notyet">
      <div className="v2-h">{name} is next in line</div>
      <p>This screen hasn't been rebuilt in the new design yet. The classic wall still has it.</p>
      <button type="button" className="v2-btn" onClick={() => setWallUi("classic")}>Open classic view</button>
    </section>
  );
}

function HomeScreen({ states, now }: { states: Map<string, HAState>; now: number }) {
  const status = useMemo(() => roomStatus(states, now), [states, now]);
  const inUse = useMemo(() => { const boot = restartMinute(states); return new Set(GUEST_SUITES.filter((s) => suiteInUse(states, s, now, boot)).map((s) => s.id)); }, [states, now]);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const onRoomTap = async (group: string) => {
    const s = status.get(group);
    if (!s || s.lightIds.length === 0) return;
    setBusy(group);
    await haCallService("light", s.lightsOn > 0 ? "turn_off" : "turn_on", { entity_id: s.lightIds });
    setBusy(null);
  };

  const lightsOnIds = useMemo(() => [...status.values()].flatMap((s) => (s.lightsOn > 0 ? s.lightIds : [])), [status]);
  const roomsOn = [...status.entries()].filter(([, s]) => s.lightsOn > 0).length;
  const shades = useMemo(() => [...states.values()].filter((s) => s.entity_id.startsWith("cover.") && s.attributes.device_class === "shade"), [states]);
  const shadesOpen = shades.filter((s) => s.state === "open").length;

  const doors = FLOORS.flatMap((f) => f.doors).filter((d) => d.sensor && states.get(d.sensor)?.state === "on");
  const paused = [...new Set(doors.flatMap((d) => d.pauses ?? []))];
  const roomName = (climateId: string) => {
    const g = Object.entries(ROOM_CLIMATE).find(([, id]) => id === climateId)?.[0];
    return FLOORS.flatMap((f) => f.rooms).find((r) => r.id === g)?.name ?? climateId;
  };
  const doorName = (sensor: string) => String(states.get(sensor)?.attributes.friendly_name ?? sensor).replace(/^Makena Alarm /, "");

  const temps = Object.values(ROOM_CLIMATE).map((id) => Number(states.get(id)?.attributes.current_temperature)).filter(Number.isFinite);
  const avg = temps.length ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null;
  const cooling = Object.values(ROOM_CLIMATE).filter((id) => states.get(id)?.attributes.hvac_action === "cooling").length;
  const alarm = [...states.values()].find((s) => s.entity_id.startsWith("alarm_control_panel."));
  const playing = [...states.values()].filter((s) => s.entity_id.startsWith("media_player.") && s.state === "playing" && !/tv|oled|frame|jbl|speaker|apple/i.test(s.entity_id));
  const song = playing.find((p) => p.attributes.media_title);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    if (confirm !== key) { setConfirm(key); window.setTimeout(() => setConfirm((c) => (c === key ? null : c)), 5000); return; }
    setConfirm(null); setBusy(key); await fn(); setBusy(null);
  };

  return (
    <div className="v2-home">
      <EnergyStrip states={states} />
      <div className="v2-home-body">
        <section className="v2-card v2-map-card" aria-label="House map">
          <div className="v2-map-head">
            <span className="v2-h">House</span>
            <span className="v2-muted">tap a room to switch its lights · ← ocean{busy && busy.length < 12 ? " · working…" : ""}</span>
          </div>
          <div className="v2-legend">
            <span><i className="lg-lit" />Lights on</span>
            <span><i className="lg-temp" />Cool → warm</span>
            <span><i className="lg-door" />Door</span>
            <span><i className="lg-open" />Open</span>
            <span><i className="lg-motion" />Motion</span>
            <span>♪ Music · G In use today</span>
          </div>
          <HouseMap states={states} status={status} inUse={inUse} onRoomTap={onRoomTap} />
        </section>
        <section className="v2-card v2-now" aria-label="Right now">
          <div className="v2-h">Right now</div>
          {doors.length > 0 && (
            <div className="v2-alert">
              {doors.map((d) => doorName(d.sensor!)).join(", ")} open
              {paused.length > 0 ? ` — ${paused.map(roomName).join(", ")} AC should pause` : ""}
            </div>
          )}
          <Row label="Suites in use today" value={inUse.size ? GUEST_SUITES.filter((s) => inUse.has(s.id)).map((s) => s.name).join(" · ") : "None"} sub={GUEST_SUITES.filter((s) => !inUse.has(s.id)).map((s) => s.name).join(", ") + " quiet 24 h+"} />
          <Row label="Music" value={playing.length ? playing.map((p) => String(p.attributes.friendly_name)).join(" + ") : "Nothing playing"} sub={song ? `${song.attributes.media_title}${song.attributes.media_artist ? ` · ${song.attributes.media_artist}` : ""}` : ""} />
          <Row label="Climate" value={avg != null ? `Inside avg ${avg}°` : "—"} sub={`${cooling} of ${temps.length} zones cooling`} />
          <Row label="Security" value={alarm ? titleCase(alarm.state) : "—"} sub={doors.length ? `${doors.length} door${doors.length > 1 ? "s" : ""} open` : "All doors closed"} />
          <Row label="Lights" value={roomsOn ? `On in ${roomsOn} room${roomsOn > 1 ? "s" : ""}` : "All off"} sub={`Shades: ${shadesOpen} of ${shades.length} open`} />
          <div className="v2-grow" />
          <div className="v2-quick">
            <button type="button" className={confirm === "off" ? "v2-btn v2-confirm" : "v2-btn"} disabled={busy === "off" || lightsOnIds.length === 0} onClick={() => run("off", () => haCallService("light", "turn_off", { entity_id: lightsOnIds }))}>
              {confirm === "off" ? `Tap again: ${lightsOnIds.length} off` : "All lights off"}
            </button>
            <button type="button" className={confirm === "open" ? "v2-btn v2-confirm" : "v2-btn"} disabled={busy === "open"} onClick={() => run("open", () => haCallService("cover", "open_cover", { entity_id: shades.map((s) => s.entity_id) }))}>
              {confirm === "open" ? "Tap again to open" : "Open shades"}
            </button>
            <button type="button" className={confirm === "close" ? "v2-btn v2-confirm" : "v2-btn"} disabled={busy === "close"} onClick={() => run("close", () => haCallService("cover", "close_cover", { entity_id: shades.map((s) => s.entity_id) }))}>
              {confirm === "close" ? "Tap again to close" : "Close shades"}
            </button>
            <button type="button" className={confirm === "leave" ? "v2-btn v2-primary v2-confirm" : "v2-btn v2-primary"} disabled={busy === "leave"} onClick={() => run("leave", () => haCallService("script", "turn_on", { entity_id: "script.maui_leave" }))}>
              {confirm === "leave" ? "Tap again: all off + close" : "Leave"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="v2-row">
      <div className="v2-row-label">{label}</div>
      <div className="v2-row-val"><div>{value}</div>{sub ? <small>{sub}</small> : null}</div>
    </div>
  );
}

function Flow({ kw, label }: { kw: number; label: string }) {
  const active = Math.abs(kw) >= 0.05;
  const speed = active ? Math.max(0.6, Math.min(3, 3 / Math.abs(kw))) : 0;
  return (
    <div className="v2-flow">
      <div className="v2-flow-line">
        {active && [0, 1, 2].map((i) => <span key={i} className="v2-dot" style={{ animationDuration: `${speed}s`, animationDelay: `${(-speed * i) / 3}s` }} />)}
      </div>
      <div className="v2-flow-label">{label}</div>
    </div>
  );
}

function Node({ top, big, unit, sub, color }: { top: string; big: string; unit: string; sub: string; color: string }) {
  return (
    <div className="v2-node">
      <div className="v2-muted">{top}</div>
      <div><span className="v2-big" style={{ color }}>{big}</span> <span className="v2-muted">{unit}</span></div>
      <div className="v2-small">{sub}</div>
    </div>
  );
}

const kw = (n: number) => (Math.abs(n) < 10 ? n.toFixed(1) : n.toFixed(0));

function EnergyStrip({ states }: { states: Map<string, HAState> }) {
  const e = energyNow(states);
  const charging = e.batteryKw < -0.05, discharging = e.batteryKw > 0.05;
  const selling = e.gridKw < -0.05, buying = e.gridKw > 0.05;
  const socAvg = e.soc1 != null && e.soc2 != null ? (e.soc1 + e.soc2) / 2 : e.soc1 ?? e.soc2;
  return (
    <section className="v2-card v2-strip" aria-label="Energy right now">
      <Node top="Sun" big={kw(e.solarKw)} unit="kW" sub="both systems" color="#B07800" />
      <Flow kw={Math.min(e.solarKw, e.houseKw)} label={`${kw(Math.min(e.solarKw, e.houseKw))} kW to house`} />
      <Node top="House" big={kw(e.houseKw)} unit="kW" sub="using now" color="#1E2A2E" />
      <Flow kw={e.batteryKw} label={charging ? `${kw(-e.batteryKw)} kW charging` : discharging ? `${kw(e.batteryKw)} kW from batteries` : "batteries idle"} />
      <Node top="Powerwalls" big={socAvg != null ? String(Math.round(socAvg)) : "—"} unit="%" sub={`S1 ${e.soc1 != null ? Math.round(e.soc1) : "—"}% · S2 ${e.soc2 != null ? Math.round(e.soc2) : "—"}%`} color="#0E5A6B" />
      <Flow kw={e.gridKw} label={selling ? `${kw(-e.gridKw)} kW selling` : buying ? `${kw(e.gridKw)} kW buying` : "grid idle"} />
      <Node top="Grid" big={kw(Math.abs(e.gridKw))} unit="kW" sub={selling ? "selling now" : buying ? "buying now" : "not in use"} color={buying ? "#7A2E14" : "#2E6B3A"} />
    </section>
  );
}
