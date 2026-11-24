import { useEffect, useMemo, useRef, useState } from "react";
import { haCallService, type HAState } from "@/lib/ha";
import { describeNowPlaying, effectivePlayer, groupFor, musicGroups, MUSIC_SECTIONS, pickLeader, PLAYER_NAMES } from "@/lib/music";

// Music: pick rooms on the left, control them on the right. Tapping a room
// picks its whole group; picking rooms from different groups offers
// "Play together". Source, play/pause and volumes act on the picked rooms.

const COLORS = ["#0E5A6B", "#B07800", "#7A2E14", "#2E6B3A", "#5B4B8A", "#8A6A00"];
const call = (service: string, data: Record<string, unknown>) => haCallService("media_player", service, data);

export function MusicScreen({ states }: { states: Map<string, HAState> }) {
  const groups = useMemo(() => musicGroups(states), [states]);
  const groupColor = useMemo(() => {
    const m = new Map<string, string>();
    groups.filter((g) => g.members.length > 1).forEach((g, i) => g.members.forEach((id) => m.set(id, COLORS[i % COLORS.length])));
    return m;
  }, [groups]);
  const [picked, setPicked] = useState<string[]>([]);

  // First visit: pick whatever is playing so the controls are useful at once.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current || groups.length === 0) return;
    didInit.current = true;
    const playing = groups.find((g) => states.get(g.leader)?.state === "playing");
    if (playing) setPicked(playing.members);
  }, [groups, states]);

  const toggle = (id: string) => {
    const unit = groupFor(groups, id)?.members ?? [id];
    setPicked((p) => (p.includes(id) ? p.filter((x) => !unit.includes(x)) : [...p, ...unit.filter((x) => !p.includes(x))]));
  };

  return (
    <div className="v2-music">
      <section className="v2-card v2-music-rooms" aria-label="Rooms">
        <div className="v2-sec-head">
          <span className="v2-h">Rooms</span>
          <span className="v2-muted">{picked.length ? `${picked.length} picked` : "Tap rooms to control them"}</span>
        </div>
        {MUSIC_SECTIONS.map((sec) => (
          <div key={sec.title} className="v2-music-sec">
            <div className="v2-cap">{sec.title}</div>
            <div className="v2-music-grid">
              {sec.players.filter(([id]) => states.has(id)).map(([id, name]) => {
                const own = states.get(id)!;
                const eff = effectivePlayer(states, id);
                const st = eff.st ?? own;
                const on = picked.includes(id);
                const np = describeNowPlaying(st);
                const vol = Math.round(Number(own.attributes.volume_level ?? 0) * 100);
                const color = groupColor.get(id);
                return (
                  <button key={id} type="button" aria-pressed={on} className={`v2-mtile${on ? " on" : ""}${st.state === "playing" ? " playing" : ""}`} onClick={() => toggle(id)} disabled={own.state === "unavailable"}>
                    <span className="v2-mtile-top">
                      <span className="v2-mtile-name">{name}</span>
                      {color && <span className="v2-gdot" style={{ background: color }} title="Grouped" />}
                    </span>
                    <span className="v2-mtile-sub">{own.state === "unavailable" ? "Offline" : st.state === "playing" ? `♪ ${eff.followsName ? `with ${eff.followsName}` : np.title}` : st.state === "paused" ? "Paused" : "Idle"}</span>
                    <span className="v2-mtile-vol"><i style={{ width: `${vol}%` }} /></span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>
      <Control states={states} picked={picked} setPicked={setPicked} />
    </div>
  );
}

function Control({ states, picked, setPicked }: { states: Map<string, HAState>; picked: string[]; setPicked: (p: string[]) => void }) {
  const groups = musicGroups(states);
  const [vols, setVols] = useState<Record<string, number>>({});
  const timers = useRef<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  if (picked.length === 0) {
    const playing = groups.filter((g) => states.get(g.leader)?.state === "playing");
    return (
      <section className="v2-card v2-music-ctl v2-center">
        <div className="v2-h">Pick a room to start</div>
        <p className="v2-muted">{playing.length ? `Playing now: ${playing.map((g) => g.members.map((m) => PLAYER_NAMES.get(m)).join(" + ")).join(" · ")}` : "Nothing is playing in the house."}</p>
        <p className="v2-muted">To play Spotify, start it on a phone and choose a room — it shows up here and you can spread it to other rooms.</p>
      </section>
    );
  }

  const unitsTouched = new Set(picked.map((id) => groupFor(groups, id)?.leader ?? id));
  const together = unitsTouched.size === 1 && picked.length > 1;
  const leader = together ? groupFor(groups, picked[0])!.leader : pickLeader(states, picked)!;
  const lst = states.get(leader);
  const np = describeNowPlaying(lst);
  const sources = (lst?.attributes.source_list as string[] | undefined) ?? [];
  const source = lst?.attributes.source as string | undefined;
  const playing = lst?.state === "playing";
  const names = picked.map((id) => PLAYER_NAMES.get(id) ?? id);

  const volOf = (id: string) => vols[id] ?? Math.round(Number(states.get(id)?.attributes.volume_level ?? 0) * 100);
  const sendVol = (id: string, v: number) => {
    setVols((p) => ({ ...p, [id]: v }));
    window.clearTimeout(timers.current[id]);
    timers.current[id] = window.setTimeout(async () => {
      await call("volume_set", { entity_id: id, volume_level: v / 100 });
      window.setTimeout(() => setVols((p) => { const n = { ...p }; delete n[id]; return n; }), 1500);
    }, 250);
  };
  const avg = Math.round(picked.reduce((a, id) => a + volOf(id), 0) / picked.length);
  const setAll = (target: number) => {
    const d = target - avg;
    picked.forEach((id) => sendVol(id, Math.max(0, Math.min(100, volOf(id) + d))));
  };
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); await fn(); setBusy(false); };
  // Picking several rooms and then choosing a source or Play means "play
  // this everywhere I picked", so group them first.
  const groupPicked = async () => {
    if (together || picked.length < 2) return;
    const others = picked.filter((id) => id !== leader);
    for (const id of others) if ((groupFor(groups, id)?.members.length ?? 1) > 1) await call("unjoin", { entity_id: id });
    await call("join", { entity_id: leader, group_members: others });
  };

  return (
    <section className="v2-card v2-music-ctl" aria-label="Controls for picked rooms">
      <div className="v2-sec-head">
        <span className="v2-h">{names.length > 3 ? `${names.slice(0, 3).join(", ")} + ${names.length - 3}` : names.join(" + ")}</span>
        <button type="button" className="v2-mini" onClick={() => setPicked([])}>Clear</button>
      </div>

      {!together && picked.length > 1 && (
        <button type="button" className="v2-btn v2-primary v2-wide" disabled={busy} onClick={() => act(async () => {
          const others = picked.filter((id) => id !== leader);
          for (const id of others) if ((groupFor(groups, id)?.members.length ?? 1) > 1) await call("unjoin", { entity_id: id });
          await call("join", { entity_id: leader, group_members: others });
        })}>
          Play together in {picked.length} rooms{lst?.state === "playing" ? ` (from ${PLAYER_NAMES.get(leader)})` : ""} — or just pick a source
        </button>
      )}

      <div className="v2-np">
        <div className="v2-np-title">{np.title}</div>
        <div className="v2-muted">{np.sub}</div>
      </div>

      <div className="v2-transport">
        <button type="button" className="v2-round" aria-label="Previous" disabled={busy} onClick={() => act(() => call("media_previous_track", { entity_id: leader }))}>⏮</button>
        <button type="button" className="v2-round v2-round-big" aria-label={playing ? "Pause" : "Play"} disabled={busy} onClick={() => act(async () => { if (!playing) await groupPicked(); await call(playing ? "media_pause" : "media_play", { entity_id: leader }); })}>{playing ? "⏸" : "▶"}</button>
        <button type="button" className="v2-round" aria-label="Next" disabled={busy} onClick={() => act(() => call("media_next_track", { entity_id: leader }))}>⏭</button>
      </div>

      {sources.length > 0 && (
        <div className="v2-sources" role="group" aria-label="Source">
          {sources.map((s) => (
            <button key={s} type="button" aria-pressed={s === source} className={s === source ? "on" : ""} disabled={busy} onClick={() => act(async () => { await groupPicked(); await call("select_source", { entity_id: leader, source: s }); })}>{s}</button>
          ))}
        </div>
      )}

      <div className="v2-vols">
        {picked.length > 1 && (
          <label className="v2-vol v2-vol-all">
            <span>All picked</span>
            <input type="range" min={0} max={100} value={avg} onChange={(e) => setAll(Number(e.target.value))} aria-label="Volume for all picked rooms" />
            <b>{avg}</b>
          </label>
        )}
        {picked.map((id) => {
          const st = states.get(id);
          const muted = st?.attributes.is_volume_muted === true;
          const grouped = (groupFor(groups, id)?.members.length ?? 1) > 1;
          return (
            <div key={id} className="v2-vol">
              <span>{PLAYER_NAMES.get(id)}</span>
              <input type="range" min={0} max={100} value={volOf(id)} onChange={(e) => sendVol(id, Number(e.target.value))} aria-label={`${PLAYER_NAMES.get(id)} volume`} />
              <b>{volOf(id)}</b>
              <button type="button" className={`v2-mini${muted ? " v2-mini-on" : ""}`} aria-pressed={muted} onClick={() => call("volume_mute", { entity_id: id, is_volume_muted: !muted })}>{muted ? "Muted" : "Mute"}</button>
              {grouped && <button type="button" className="v2-mini" onClick={() => act(async () => { await call("unjoin", { entity_id: id }); })}>Remove</button>}
            </div>
          );
        })}
      </div>

      <div className="v2-grow" />
      <button type="button" className="v2-btn" disabled={busy} onClick={() => act(async () => { for (const id of picked) await call("media_stop", { entity_id: id }); })}>Stop music in picked rooms</button>
    </section>
  );
}
