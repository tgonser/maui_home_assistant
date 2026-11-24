import { useEffect, useRef, useState } from "react";
import { haCallService, type HAState } from "@/lib/ha";
import { GUEST_TEMP, lightName, roomLights, roomsFor, type RoomDef, type TabletRole } from "@/lib/roomsCatalog";
import { describeNowPlaying } from "@/lib/music";
import { shadeView } from "@/lib/shades";

// Rooms: pick a room, control everything in it. Owners see every room;
// a guest tablet starts in its own suite and never sees the master suite.

export function RoomsScreen({ states, role }: { states: Map<string, HAState>; role: TabletRole }) {
  const rooms = roomsFor(role);
  const [id, setId] = useState(role.kind === "guest" ? role.room : rooms[0].id);
  const room = rooms.find((r) => r.id === id) ?? rooms[0];
  const areas = ["Ground floor", "Upstairs", "Outside"] as const;
  return (
    <div className="v2-rooms">
      <nav className="v2-card v2-room-list" aria-label="Rooms">
        {areas.map((a) => (
          <div key={a}>
            <div className="v2-cap">{a}</div>
            {rooms.filter((r) => r.area === a).map((r) => {
              const on = roomLights(states, r).filter((l) => l.state === "on").length;
              const t = r.climate ? Number(states.get(r.climate)?.attributes.current_temperature) : NaN;
              const mine = role.kind === "guest" && role.room === r.id;
              return (
                <button key={r.id} type="button" aria-current={r.id === room.id ? "true" : undefined} className={`v2-room-pick${r.id === room.id ? " on" : ""}`} onClick={() => setId(r.id)}>
                  <span>{r.name}{mine ? " · yours" : ""}</span>
                  <small>{[Number.isFinite(t) ? `${Math.round(t)}°` : "", on ? `${on} on` : ""].filter(Boolean).join(" · ")}</small>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <RoomPanel key={room.id} room={room} states={states} guest={role.kind === "guest"} />
    </div>
  );
}

const call = (domain: string, service: string, data: Record<string, unknown>) => haCallService(domain, service, data);

function useDebounced() {
  const t = useRef<Record<string, number>>({});
  useEffect(() => () => Object.values(t.current).forEach((x) => window.clearTimeout(x)), []);
  return (key: string, fn: () => void, ms = 300) => {
    window.clearTimeout(t.current[key]);
    t.current[key] = window.setTimeout(fn, ms);
  };
}

function RoomPanel({ room, states, guest }: { room: RoomDef; states: Map<string, HAState>; guest: boolean }) {
  const lights = roomLights(states, room);
  const on = lights.filter((l) => l.state === "on");
  const debounce = useDebounced();
  const [levels, setLevels] = useState<Record<string, number>>({});
  return (
    <section className="v2-card v2-room-panel" aria-label={room.name}>
      <div className="v2-room-head">
        <span className="v2-room-title">{room.name}</span>
        <span className="v2-muted">{lights.length ? `${on.length} of ${lights.length} lights on` : ""}</span>
      </div>
      <div className="v2-room-cols">
        <div className="v2-room-col">
          {lights.length > 0 && (
            <div className="v2-block">
              <div className="v2-block-head">
                <span className="v2-h">Lights</span>
                <span className="v2-sec-actions">
                  <button type="button" className="v2-mini" onClick={() => call("light", "turn_on", { entity_id: lights.map((l) => l.entity_id) })}>All on</button>
                  <button type="button" className="v2-mini" disabled={!on.length} onClick={() => call("light", "turn_off", { entity_id: on.map((l) => l.entity_id) })}>All off</button>
                </span>
              </div>
              <div className="v2-light-rows">
                {lights.map((l) => {
                  const isOn = l.state === "on";
                  const dimmable = Array.isArray(l.attributes.supported_color_modes) && (l.attributes.supported_color_modes as string[]).some((m) => m !== "onoff");
                  const pct = levels[l.entity_id] ?? Math.round((Number(l.attributes.brightness ?? 0) / 255) * 100);
                  return (
                    <div key={l.entity_id} className={`v2-lrow${isOn ? " on" : ""}`}>
                      <button type="button" className="v2-switch" role="switch" aria-checked={isOn} aria-label={lightName(l)} onClick={() => call("light", isOn ? "turn_off" : "turn_on", { entity_id: l.entity_id })}><i /></button>
                      <span className="v2-lrow-name">{lightName(l)}</span>
                      {dimmable && isOn && (
                        <input type="range" min={1} max={100} value={pct} aria-label={`${lightName(l)} brightness`}
                          onChange={(e) => { const v = Number(e.target.value); setLevels((p) => ({ ...p, [l.entity_id]: v })); debounce(l.entity_id, () => { void call("light", "turn_on", { entity_id: l.entity_id, brightness_pct: v }); window.setTimeout(() => setLevels((p) => { const n = { ...p }; delete n[l.entity_id]; return n; }), 1500); }); }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="v2-room-col">
          {room.climate && <ClimateBlock id={room.climate} states={states} guest={guest} />}
          {room.shades && room.shades.length > 0 && (
            <div className="v2-block">
              <div className="v2-block-head"><span className="v2-h">Shades</span></div>
              {room.shades.map((sid, i) => {
                const v = shadeView(states, sid, room.shades!.length > 1 ? (i === 0 ? "Bedroom" : sid.includes("bath") ? "Bath" : `Shade ${i + 1}`) : "Shade");
                return (
                  <div key={sid} className="v2-srow">
                    <span className="v2-lrow-name">{v.name} <small className="v2-muted">{v.label}</small></span>
                    <span className="v2-shade-btns v2-inline">
                      <button type="button" disabled={!v.available} onClick={() => call("cover", "open_cover", { entity_id: sid })}>Open</button>
                      <button type="button" disabled={!v.available} onClick={() => call("cover", "set_cover_position", { entity_id: sid, position: 50 })}>Half</button>
                      <button type="button" disabled={!v.available} onClick={() => call("cover", "close_cover", { entity_id: sid })}>Close</button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {room.media && <MusicBlock id={room.media} states={states} />}
        </div>
      </div>
    </section>
  );
}

function ClimateBlock({ id, states, guest }: { id: string; states: Map<string, HAState>; guest: boolean }) {
  const st = states.get(id);
  const [pending, setPending] = useState<number | null>(null);
  const timer = useRef(0);
  const target = pending ?? (Number.isFinite(Number(st?.attributes.temperature)) ? Math.round(Number(st?.attributes.temperature)) : null);
  useEffect(() => { if (pending != null && Math.round(Number(st?.attributes.temperature)) === pending) setPending(null); }, [st, pending]);
  if (!st) return null;
  const off = st.state === "off";
  const now = Number(st.attributes.current_temperature);
  const lo = guest ? GUEST_TEMP.min : 60, hi = guest ? GUEST_TEMP.max : 90;
  const nudge = (d: number) => {
    if (target == null) return;
    const next = Math.max(lo, Math.min(hi, target + d));
    setPending(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void call("climate", "set_temperature", { entity_id: id, temperature: next }), 1200);
  };
  return (
    <div className="v2-block">
      <div className="v2-block-head">
        <span className="v2-h">Air conditioning</span>
        <button type="button" className={`v2-mini${off ? "" : " v2-mini-teal"}`} onClick={() => call("climate", "set_hvac_mode", { entity_id: id, hvac_mode: off ? "cool" : "off" })}>{off ? "Turn on" : "On · tap for off"}</button>
      </div>
      <div className="v2-zone-body">
        <div className="v2-zone-now"><span className="v2-zone-temp">{Number.isFinite(now) ? `${Math.round(now)}°` : "—"}</span><span className="v2-small">in the room</span></div>
        <div className="v2-setpoint">
          <button type="button" className="v2-round" aria-label="Cooler" disabled={off || target == null || target <= lo} onClick={() => nudge(-1)}>−</button>
          <div className="v2-set-val"><span>{target != null ? `${target}°` : "—"}</span><small>{pending != null ? "setting…" : guest ? `${lo}–${hi}°` : "target"}</small></div>
          <button type="button" className="v2-round" aria-label="Warmer" disabled={off || target == null || target >= hi} onClick={() => nudge(1)}>+</button>
        </div>
      </div>
    </div>
  );
}

function MusicBlock({ id, states }: { id: string; states: Map<string, HAState> }) {
  const st = states.get(id);
  const [vol, setVol] = useState<number | null>(null);
  const t = useRef(0);
  if (!st || st.state === "unavailable") return null;
  const np = describeNowPlaying(st);
  const playing = st.state === "playing";
  const v = vol ?? Math.round(Number(st.attributes.volume_level ?? 0) * 100);
  return (
    <div className="v2-block">
      <div className="v2-block-head"><span className="v2-h">Music</span><span className="v2-muted v2-ellipsis">{np.title}</span></div>
      <div className="v2-vol">
        <button type="button" className="v2-round" aria-label={playing ? "Pause" : "Play"} onClick={() => call("media_player", playing ? "media_pause" : "media_play", { entity_id: id })}>{playing ? "⏸" : "▶"}</button>
        <input type="range" min={0} max={100} value={v} aria-label="Volume" onChange={(e) => {
          const n = Number(e.target.value); setVol(n); window.clearTimeout(t.current);
          t.current = window.setTimeout(() => { void call("media_player", "volume_set", { entity_id: id, volume_level: n / 100 }); window.setTimeout(() => setVol(null), 1500); }, 250);
        }} />
        <b>{v}</b>
      </div>
      <div className="v2-small">{np.sub}</div>
      <PhoneHelp id={id} st={st} />
    </div>
  );
}

// How to get music from a phone onto this room's speaker. Bluetooth works
// on any Wi-Fi (including an isolated guest network); Spotify and AirPlay
// need the phone on the same network as the speaker.
function PhoneHelp({ id, st }: { id: string; st: HAState }) {
  const [open, setOpen] = useState(false);
  const sources = (st.attributes.source_list as string[] | undefined) ?? [];
  const hasBt = sources.includes("Bluetooth");
  const speaker = String(st.attributes.friendly_name ?? "this room's speaker");
  if (!open) return <button type="button" className="v2-mini v2-mini-teal" onClick={() => setOpen(true)}>Play from your phone</button>;
  return (
    <div className="v2-phonehelp">
      {hasBt && (
        <>
          <button type="button" className="v2-btn v2-primary" onClick={() => call("media_player", "select_source", { entity_id: id, source: "Bluetooth" })}>Switch speaker to Bluetooth</button>
          <ol>
            <li>Tap the button above.</li>
            <li>On your phone, open Bluetooth settings and pick <b>{speaker}</b>.</li>
            <li>Play anything — it comes out of this room's speakers. Volume works here or on the phone.</li>
          </ol>
        </>
      )}
      <p className="v2-small">On the house Wi-Fi you can also use Spotify (tap the speaker icon and choose <b>{speaker}</b>) or AirPlay.</p>
      <button type="button" className="v2-mini" onClick={() => setOpen(false)}>Done</button>
    </div>
  );
}
