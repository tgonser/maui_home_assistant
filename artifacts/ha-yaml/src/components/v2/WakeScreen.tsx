import { useEffect, useState } from "react";
import { haCallService, haCameraImage, type HAState } from "@/lib/ha";
import { prettyTime, readWake, shiftTime, WAKE_FEATURES, wakeId } from "@/lib/wake";

// Wake-up for ONE suite: set a time, choose what happens, and "Every day
// until I leave" asks for the leave date. The alarm itself runs in Home
// Assistant (maui_wake.yaml), so it rings even if the tablet is asleep.

const MAUI_TZ = "Pacific/Honolulu";
const todayHst = () => new Date().toLocaleDateString("en-CA", { timeZone: MAUI_TZ });

export function WakeScreen({ states, suite, suiteName }: { states: Map<string, HAState>; suite: string; suiteName: string }) {
  const w = readWake(states, suite);
  const f = WAKE_FEATURES[suite] ?? { shades: false, voice: false };
  const [time, setTime] = useState(w.time === "00:00" ? "07:00" : w.time);
  const [repeat, setRepeat] = useState(w.repeat);
  const [until, setUntil] = useState(w.until && w.until >= todayHst() ? w.until : todayHst());
  const [lights, setLights] = useState(w.enabled ? w.lights : true);
  const [shades, setShades] = useState(w.enabled ? w.shades : f.shades);
  const [voice, setVoice] = useState(w.enabled ? w.voice : f.voice);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!w.available) return <section className="v2-card v2-center v2-notyet"><div className="v2-h">Wake-up isn't set up for this suite yet</div></section>;

  const bool = (part: string, on: boolean) => haCallService("input_boolean", on ? "turn_on" : "turn_off", { entity_id: wakeId(suite, part) });
  const save = async () => {
    setBusy(true); setMsg(null);
    await haCallService("input_datetime", "set_datetime", { entity_id: wakeId(suite, "time", "input_datetime"), time: `${time}:00` });
    await haCallService("input_select", "select_option", { entity_id: wakeId(suite, "repeat", "input_select"), option: repeat });
    if (repeat !== "Once") await haCallService("input_datetime", "set_datetime", { entity_id: wakeId(suite, "until", "input_datetime"), date: until });
    await bool("lights", lights); await bool("shades", shades && f.shades); await bool("voice", voice && f.voice);
    const r = await bool("enabled", true);
    setBusy(false);
    setMsg(r.ok ? `Set for ${prettyTime(time)}${repeat === "Once" ? "" : ` every day through ${new Date(until + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`}.` : `Couldn't save: ${r.error}`);
  };
  const off = async () => { setBusy(true); await bool("enabled", false); setBusy(false); setMsg("Wake-up is off."); };

  return (
    <div className="v2-wake">
      <section className="v2-card v2-wake-set" aria-label={`${suiteName} wake-up`}>
        <div className="v2-sec-head">
          <span className="v2-h">Wake-up · {suiteName} only</span>
          <span className={`v2-wake-status${w.enabled ? " on" : ""}`}>{w.enabled ? `On · ${prettyTime(w.time)}` : "Off"}</span>
        </div>
        <div className="v2-wake-time">
          <button type="button" className="v2-round" aria-label="15 minutes earlier" onClick={() => setTime(shiftTime(time, -15))}>−</button>
          <label className="v2-wake-clock">
            <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} aria-label="Wake-up time" />
            <span>{prettyTime(time)}</span>
          </label>
          <button type="button" className="v2-round" aria-label="15 minutes later" onClick={() => setTime(shiftTime(time, 15))}>+</button>
        </div>
        <div className="v2-seg" role="radiogroup" aria-label="Repeat">
          {(["Once", "Every day until I leave"] as const).map((r) => (
            <button key={r} type="button" role="radio" aria-checked={repeat === r} className={repeat === r ? "on" : ""} onClick={() => setRepeat(r)}>{r === "Once" ? "Just tomorrow" : "Every day of my stay"}</button>
          ))}
        </div>
        {repeat !== "Once" && (
          <label className="v2-field">When do you leave?
            <input type="date" value={until} min={todayHst()} onChange={(e) => setUntil(e.target.value)} />
          </label>
        )}
        <div className="v2-wake-opts">
          <Check on={lights} set={setLights} label="Fade up the bedroom lights" />
          {f.shades && <Check on={shades} set={setShades} label="Open the shades" />}
          {f.voice && <Check on={voice} set={setVoice} label="Say good morning on the speaker" />}
        </div>
        {msg && <div className="v2-alert" role="status">{msg}</div>}
        <div className="v2-modal-actions">
          {w.enabled && <button type="button" className="v2-btn" disabled={busy} onClick={off}>Turn off</button>}
          <button type="button" className="v2-btn v2-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : w.enabled ? "Update wake-up" : "Set wake-up"}</button>
        </div>
      </section>
      <section className="v2-card v2-wake-info">
        <div className="v2-h">How it works</div>
        <ul>
          <li>Only this suite wakes up — nobody else's room is touched.</li>
          <li><b>Snooze</b> dims the lights and goes quiet for 9 minutes; the shades stay as they are.</li>
          <li><b>I'm up</b> stops it. It also stops by itself after 20 minutes.</li>
          <li>It runs in the house system, so it works even if this tablet is asleep.</li>
        </ul>
      </section>
    </div>
  );
}

function Check({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="v2-check" onClick={() => set(!on)}>
      <span className="v2-switch" aria-hidden="true"><i /></span>{label}
    </button>
  );
}

/** Full-screen "ringing" view on the suite's tablet, over whatever tab is open. */
export function WakeRinging({ states, suite, suiteName }: { states: Map<string, HAState>; suite: string; suiteName: string }) {
  const w = readWake(states, suite);
  const [cam, setCam] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!w.ringing) return;
    const tick = window.setInterval(() => setNow(Date.now()), 10_000);
    const load = () => haCameraImage("camera.south_pool_g6_ptz_high_resolution_channel").then((r) => r.ok && setCam(r.data));
    void load();
    const t = window.setInterval(load, 10_000);
    return () => { window.clearInterval(tick); window.clearInterval(t); };
  }, [w.ringing]);
  if (!w.ringing) return null;
  const clock = new Date(now).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: MAUI_TZ });
  return (
    <div className="v2-ring" role="alertdialog" aria-label={`Good morning, ${suiteName}`}>
      {cam && <img className="v2-ring-cam" src={cam} alt="The ocean view right now" />}
      <div className="v2-ring-body">
        <div className="v2-ring-clock">{clock}</div>
        <div className="v2-ring-sub">Good morning · {suiteName}</div>
        <div className="v2-ring-btns">
          <button type="button" className="v2-btn" onClick={() => haCallService("script", "turn_on", { entity_id: `script.wake_${suite}_snooze` })}>Snooze 9 min</button>
          <button type="button" className="v2-btn v2-primary" onClick={() => haCallService("script", "turn_on", { entity_id: `script.wake_${suite}_stop` })}>I'm up</button>
        </div>
      </div>
    </div>
  );
}
