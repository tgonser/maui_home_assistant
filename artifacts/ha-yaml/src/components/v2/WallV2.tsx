import { useEffect, useMemo, useRef, useState } from "react";
import { NO_SWIPE_SELECTOR, swipeDirection } from "@/lib/swipe";
import { haAutoConnectIfAddon, haCallService, useHAStore, type HAState } from "@/lib/ha";
import { useLiveStates, type LiveMode } from "@/lib/liveStates";
import { energyBySystem, houseFlows, energyNow, GUEST_SUITES, restartMinute, roomStatus, ROOM_CLIMATE, suiteInUse, FLOORS } from "@/lib/houseMap";
import { HouseMap } from "./HouseMap";
import { LightsScreen } from "./LightsScreen";
import { MusicScreen } from "./MusicScreen";
import { ClimateScreen } from "./ClimateScreen";
import { ShadesScreen } from "./ShadesScreen";
import { EnergyScreen } from "./EnergyScreen";
import { AlarmScreen } from "./AlarmScreen";
import { CamerasScreen } from "./CamerasScreen";
import { RoomsScreen } from "./RoomsScreen";
import { WakeRinging, WakeScreen } from "./WakeScreen";
import { GUEST_SUITE_IDS, parseRole, ROLE_KEY, ROOMS, type TabletRole } from "@/lib/roomsCatalog";
import { haStormPrepSecurity, haUnlockStormPrep } from "@/lib/ha";
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

const NAV = ["Home", "Rooms", "Lights", "Climate", "Shades", "Music", "Energy", "Alarm", "Cameras", "Wake-up"] as const;
const OWNER_NAV = ["Home", "Rooms", "Lights", "Climate", "Shades", "Music", "Energy", "Alarm", "Cameras"] as const;
// A guest tablet gets its room (lights, AC, shades, music) and the outdoor cameras.
const GUEST_NAV = ["Rooms", "Wake-up", "Cameras"] as const;
type Nav = (typeof NAV)[number];
const BUILT: Nav[] = ["Home", "Rooms", "Lights", "Music", "Climate", "Shades", "Energy", "Alarm", "Cameras"];
const MAUI_TZ = "Pacific/Honolulu";

export function WallV2() {
  const url = useHAStore((s) => s.url);
  const [role, setRoleState] = useState<TabletRole>(() => { try { return parseRole(localStorage.getItem(ROLE_KEY)); } catch { return { kind: "owner" }; } });
  const setRole = (r: TabletRole) => { try { localStorage.setItem(ROLE_KEY, JSON.stringify(r)); } catch { /* private mode */ } setRoleState(r); setTab(r.kind === "guest" ? "Rooms" : "Home"); };
  const nav: readonly Nav[] = role.kind === "guest" ? GUEST_NAV : OWNER_NAV;
  const [tab, setTab] = useState<Nav>(() => (role.kind === "guest" ? "Rooms" : "Home"));
  const [tabletDlg, setTabletDlg] = useState(false);
  const [now, setNow] = useState(Date.now());
  const { states, mode, error, lastMs } = useLiveStates();

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

  // Swipe left/right anywhere on the screen body to move to the next/previous
  // tab. Touches that start on sliders, inputs or an open dialog are ignored.
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const target = e.target as HTMLElement | null;
    touch.current = e.touches.length === 1 && !target?.closest(NO_SWIPE_SELECTOR) ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dir = swipeDirection(t.clientX - start.x, t.clientY - start.y, Date.now() - start.t);
    if (!dir) return;
    const i = nav.indexOf(tab);
    const next = nav[(i + dir + nav.length) % nav.length];
    setTab(next);
  };

  if (!url) {
    return <div className="v2-root v2-center">Connecting to Home Assistant…</div>;
  }

  return (
    <div className="v2-root">
      <header className="v2-header">
        <div className="v2-brand">
          <span className="v2-title">{role.kind === "guest" ? ROOMS.find((r) => r.id === role.room)?.name ?? "Mākena" : "Mākena"}</span>
          <span className="v2-sub">{dateStr}{houseMode ? ` · ${houseMode}` : ""}</span>
        </div>
        <div className="v2-header-right">
          <LiveDot mode={mode} error={error} />
          {Number.isFinite(outside) && <span className="v2-chip">Outside {Math.round(outside)}°</span>}
          <span className="v2-clock">{hm} <small>{ampm}</small></span>
          <FullScreenButton />
          {role.kind === "owner" && <button type="button" className="v2-link" onClick={() => setTabletDlg(true)}>This tablet</button>}
          {role.kind === "owner" && <button type="button" className="v2-link" onClick={() => setWallUi("classic")}>Classic view</button>}
          {role.kind === "guest" && <button type="button" className="v2-link" onClick={() => setTabletDlg(true)}>Owner</button>}
        </div>
      </header>
      <nav className="v2-nav" aria-label="Sections">
        {nav.map((n) => (
          <button key={n} type="button" aria-current={tab === n ? "page" : undefined} className={tab === n ? "v2-nav-on" : ""} onClick={() => setTab(n)}>
            {n}
          </button>
        ))}
      </nav>
      <main className="v2-main" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} key={tab}>
        {tab === "Wake-up" && role.kind === "guest" ? (
          <WakeScreen states={states} suite={role.room} suiteName={ROOMS.find((r) => r.id === role.room)?.name ?? role.room} />
        ) : tab === "Rooms" ? (
          <RoomsScreen states={states} role={role} />
        ) : tab === "Cameras" && role.kind === "guest" ? (
          <CamerasScreen states={states} guest />
        ) : tab === "Home" ? (
          <HomeScreen states={states} now={now} />
        ) : tab === "Lights" ? (
          <LightsScreen states={states} now={now} />
        ) : tab === "Climate" ? (
          <ClimateScreen states={states} now={now} />
        ) : tab === "Shades" ? (
          <ShadesScreen states={states} />
        ) : tab === "Cameras" ? (
          <CamerasScreen states={states} />
        ) : tab === "Alarm" ? (
          <AlarmScreen states={states} lastMs={lastMs} />
        ) : tab === "Energy" ? (
          <EnergyScreen states={states} />
        ) : tab === "Music" ? (
          <MusicScreen states={states} />
        ) : (
          <NotYet name={tab} built={BUILT} />
        )}
      </main>
      {role.kind === "guest" && <WakeRinging states={states} suite={role.room} suiteName={ROOMS.find((r) => r.id === role.room)?.name ?? role.room} />}
      {tabletDlg && <TabletDialog role={role} onSet={(r) => { setRole(r); setTabletDlg(false); }} onClose={() => setTabletDlg(false)} />}
    </div>
  );
}

// Owners: make this tablet a guest tablet for one suite. Guests: the way back
// to the owner view is the homeowner PIN (checked by the add-on server; it
// needs the secure Home Assistant connection, so on a plain-network kiosk
// browser use the kiosk app's own exit instead).
function TabletDialog({ role, onSet, onClose }: { role: TabletRole; onSet: (r: TabletRole) => void; onClose: () => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Never lock a tablet into guest mode unless the way back (the PIN) exists.
  const [pinReady, setPinReady] = useState<boolean | null>(null);
  useEffect(() => {
    if (role.kind !== "owner") return;
    void haStormPrepSecurity().then((r) => setPinReady(r.ok ? r.data.pinConfigured : false));
  }, [role.kind]);
  return (
    <div className="v2-modal" role="dialog" aria-modal="true" aria-label="This tablet">
      <div className="v2-card v2-modal-card">
        {role.kind === "owner" ? (
          <>
            <div className="v2-h">Make this a guest tablet</div>
            <p className="v2-muted">The tablet opens in that suite with only its room and the outdoor cameras. Alarm, energy and the master suite are hidden. Getting back here needs the homeowner PIN.</p>
            {pinReady === false ? (
              <div className="v2-alert">Set a homeowner PIN first (Home Assistant › Settings › Add-ons › Wall › Configuration), so there is a way back to the owner view.</div>
            ) : (
              <div className="v2-quick">
                {GUEST_SUITE_IDS.map((id) => (
                  <button key={id} type="button" className="v2-btn" disabled={pinReady !== true} onClick={() => onSet({ kind: "guest", room: id })}>{ROOMS.find((r) => r.id === id)?.name}</button>
                ))}
              </div>
            )}
            <div className="v2-modal-actions"><button type="button" className="v2-btn" onClick={onClose}>Cancel</button></div>
          </>
        ) : (
          <form onSubmit={async (e) => {
            e.preventDefault(); setBusy(true); setErr(null);
            const r = await haUnlockStormPrep(pin);
            setBusy(false); setPin("");
            if (r.ok && r.data.unlocked) onSet({ kind: "owner" });
            else setErr(r.ok ? "PIN not accepted." : r.error);
          }}>
            <div className="v2-h">Owner view</div>
            <p className="v2-muted">Enter the homeowner PIN to leave guest mode on this tablet.</p>
            <label className="v2-field">Homeowner PIN
              <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.slice(0, 32))} autoFocus />
            </label>
            {err && <div className="v2-alert">{err}</div>}
            <div className="v2-modal-actions">
              <button type="button" className="v2-btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="v2-btn v2-primary" disabled={busy || pin.length < 4}>{busy ? "Checking…" : "Unlock"}</button>
            </div>
          </form>
        )}
      </div>
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
            <span>Big number = room temp now (red = warmer than its AC setting)</span>
            <span><i className="lg-door" />Door</span>
            <span><i className="lg-open" />OPEN (sliders show a gap)</span>
            <span>🚶 someone moved here (last 2 min)</span>
            <span>"set 84°" = AC target · ❄ = cooling now · ♪ = music · "guests" = suite used in the last 24 h</span>
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

const kw = (n: number) => (Math.abs(n) < 10 ? n.toFixed(1) : n.toFixed(0));

// Live power as a fan: the sun on the left feeds the house, the Powerwalls
// and the grid on the right, each line labelled with its own kW, plus the
// batteries or grid feeding the house when the sun can't.
export function EnergyStrip({ states }: { states: Map<string, HAState> }) {
  const e = energyNow(states);
  const f = houseFlows(energyBySystem(states));
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 110 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { w, h } = size;
  const y = [h / 6, h / 2, (5 * h) / 6];
  const fan = (to: number) => `M 0 ${h / 2} C ${w * 0.45} ${h / 2}, ${w * 0.55} ${y[to]}, ${w} ${y[to]}`;
  const side = (from: number, to: number, bend: number) => `M ${w} ${y[from]} C ${w - bend} ${y[from]}, ${w - bend} ${y[to]}, ${w} ${y[to]}`;
  const lines: Array<{ d: string; kw: number; label: string; lx: number; ly: number; color: string }> = [
    { d: fan(0), kw: f.sunToHouse, label: `${kw(f.sunToHouse)} kW to house`, lx: w * 0.5, ly: (h / 2 + y[0]) / 2 - 4, color: "#D9A400" },
    { d: fan(1), kw: f.sunToBattery, label: `${kw(f.sunToBattery)} kW charging`, lx: w * 0.5, ly: h / 2 - 5, color: "#D9A400" },
    { d: fan(2), kw: f.sunToGrid, label: `${kw(f.sunToGrid)} kW selling`, lx: w * 0.5, ly: (h / 2 + y[2]) / 2 + 12, color: "#D9A400" },
    { d: side(1, 0, 70), kw: f.batteryToHouse, label: `${kw(f.batteryToHouse)} kW from batteries`, lx: w - 78, ly: (y[0] + y[1]) / 2 + 4, color: "#0E5A6B" },
    { d: side(1, 2, 70), kw: f.batteryToGrid, label: `${kw(f.batteryToGrid)} kW batteries → grid`, lx: w - 78, ly: (y[1] + y[2]) / 2 + 4, color: "#0E5A6B" },
    { d: side(2, 0, 120), kw: f.gridToHouse, label: `${kw(f.gridToHouse)} kW bought`, lx: w - 128, ly: h / 2 + 4, color: "#7A2E14" },
    { d: side(2, 1, 40), kw: f.gridToBattery, label: `${kw(f.gridToBattery)} kW grid charging`, lx: w - 48, ly: (y[1] + y[2]) / 2 + 4, color: "#7A2E14" },
  ].filter((l) => l.kw >= 0.05);
  const charging = e.batteryKw < -0.05, discharging = e.batteryKw > 0.05;
  const selling = e.gridKw < -0.05, buying = e.gridKw > 0.05;
  const socAvg = e.soc1 != null && e.soc2 != null ? (e.soc1 + e.soc2) / 2 : e.soc1 ?? e.soc2;
  return (
    <section className="v2-card v2-strip2" aria-label={`Sun ${kw(e.solarKw)} kilowatts: ${lines.map((l) => l.label).join(", ") || "nothing flowing"}`}>
      <div className="v2-node">
        <div className="v2-muted">Sun</div>
        <div><span className="v2-big" style={{ color: "#B07800" }}>{kw(e.solarKw)}</span> <span className="v2-muted">kW</span></div>
        <div className="v2-small">both systems</div>
      </div>
      <div className="v2-flowbox" ref={box} aria-hidden="true">
        <svg width={w} height={h}>
          {[0, 1, 2].map((i) => <path key={i} d={fan(i)} className="v2-flow-base" />)}
          {lines.map((l, i) => {
            const dur = Math.max(0.7, Math.min(3.5, 3.5 / l.kw));
            return (
              <g key={i}>
                <path d={l.d} fill="none" stroke={l.color} strokeOpacity={0.35} strokeWidth={Math.max(2, Math.min(7, l.kw * 0.9))} strokeLinecap="round" />
                {[0, 1, 2].map((k) => (
                  <circle key={k} r={3.5} fill={l.color}>
                    <animateMotion dur={`${dur}s`} begin={`${(-dur * k) / 3}s`} repeatCount="indefinite" path={l.d} />
                  </circle>
                ))}
                <text x={l.lx} y={l.ly} textAnchor="middle" className="v2-flow-text">{l.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="v2-dests">
        <div className="v2-dest"><span className="v2-muted">House</span><b>{kw(e.houseKw)} kW</b><small>using</small></div>
        <div className="v2-dest" title={`System 1 ${e.soc1 != null ? Math.round(e.soc1) : "—"}% · System 2 ${e.soc2 != null ? Math.round(e.soc2) : "—"}%`}>
          <span className="v2-muted">Powerwalls {socAvg != null ? `${Math.round(socAvg)}%` : ""}</span>
          <b style={{ color: "#0E5A6B" }}>{charging || discharging ? `${kw(Math.abs(e.batteryKw))} kW` : "—"}</b>
          <small>{charging ? "charging" : discharging ? "giving" : "idle"}</small>
        </div>
        <div className="v2-dest"><span className="v2-muted">Grid</span><b style={{ color: buying ? "#7A2E14" : "#2E6B3A" }}>{kw(Math.abs(e.gridKw))} kW</b><small>{selling ? "selling" : buying ? "buying" : "idle"}</small></div>
      </div>
    </section>
  );
}

// Hides Home Assistant's sidebar and header (and the tablet's bars) where the
// browser allows it. Inside the HA app this needs the ingress frame to allow
// full screen; if it doesn't, the button hides itself after a failed try.
function FullScreenButton() {
  const [on, setOn] = useState(() => !!document.fullscreenElement);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const f = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  if (failed || !document.fullscreenEnabled) return null;
  const toggle = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch {
      setFailed(true);
    }
  };
  return <button type="button" className="v2-chip v2-chip-btn" onClick={toggle} aria-pressed={on}>{on ? "Exit full screen" : "Full screen"}</button>;
}
