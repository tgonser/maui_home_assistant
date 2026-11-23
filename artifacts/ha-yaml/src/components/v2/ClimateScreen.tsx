import { useEffect, useRef, useState } from "react";
import { haCallService, type HAState } from "@/lib/ha";
import { holdTimer, openSliderTip, zoneViews, type ZoneView } from "@/lib/climateZones";

// Climate: all nine zones at a glance with − / + setpoints. A change made
// here is a person's change, so the existing "Manual Setpoint Hold"
// automation starts the room's hold timer and the solar automation leaves it
// alone until the hold ends (or "Back to schedule" cancels it).

const MAUI_TZ = "Pacific/Honolulu";
// Rooms the solar automation treats as open-air (no manual hold timer).
const OPEN_AIR = new Set(["climate.atrium", "climate.bar", "climate.maui_bar", "climate.kitchen"]);
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: MAUI_TZ });

export function ClimateScreen({ states, now }: { states: Map<string, HAState>; now: number }) {
  const zones = zoneViews(states);
  const outside = Number(states.get("sensor.makena_4_temperature")?.state);
  const out = Number.isFinite(outside) ? Math.round(outside) : null;
  const temps = zones.map((z) => z.now).filter((t): t is number => t != null);
  const avg = temps.length ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null;
  const hour = Number(new Date(now).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: MAUI_TZ }));
  const tip = openSliderTip(out, avg, hour);
  const cooling = zones.filter((z) => z.action === "cooling").length;
  const mode = states.get("input_select.maui_house_mode")?.state ?? "—";
  const paused = zones.filter((z) => z.doorOpen);

  return (
    <div className="v2-climate">
      <section className="v2-card v2-climate-bar">
        <Stat label="House mode" value={mode} />
        <Stat label="Inside average" value={avg != null ? `${avg}°` : "—"} />
        <Stat label="Outside" value={out != null ? `${out}°` : "—"} />
        <Stat label="Cooling now" value={`${cooling} of ${zones.length} zones`} />
        {tip ? <div className="v2-tip">{tip}</div> : paused.length ? <div className="v2-tip">Door open: {paused.map((z) => z.name).join(", ")} should hold off cooling.</div> : <div className="v2-tip v2-tip-quiet">Solar-aware schedule is running. A change here holds that room for a while, then the schedule takes over again.</div>}
      </section>
      <div className="v2-zone-grid">
        {zones.map((z) => <ZoneCard key={z.id} z={z} holdable={states.has(holdTimer(z.id))} />)}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="v2-stat">
      <div className="v2-muted">{label}</div>
      <div className="v2-stat-val">{value}</div>
    </div>
  );
}

function ZoneCard({ z, holdable }: { z: ZoneView; holdable: boolean }) {
  const [pending, setPending] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // Drop the local value once Home Assistant reports the new target.
  useEffect(() => { if (pending != null && z.target === pending) setPending(null); }, [z.target, pending]);

  const off = z.mode === "off";
  const target = pending ?? z.target;
  const nudge = (d: number) => {
    if (target == null) return;
    const next = Math.max(60, Math.min(90, target + d));
    setPending(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void haCallService("climate", "set_temperature", { entity_id: z.id, temperature: next });
    }, 1200);
  };
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); await fn(); setBusy(false); };

  const status = !z.available ? "Offline" : off ? "Off" : z.doorOpen ? "Door open" : z.action === "cooling" ? "Cooling" : z.action === "heating" ? "Heating" : z.now != null && z.target != null && z.now <= z.target ? "At target" : "Idle";
  const warm = z.now != null && z.target != null && !off && z.now > z.target + 1;

  return (
    <section className={`v2-card v2-zone${off ? " off" : ""}${z.action === "cooling" ? " cooling" : ""}`} aria-label={`${z.name} climate`}>
      <div className="v2-zone-head">
        <div>
          <div className="v2-zone-name">{z.name}</div>
          <div className="v2-small">{z.where} · {status}</div>
        </div>
        <button type="button" className={`v2-mini${off ? "" : " v2-mini-teal"}`} disabled={!z.available || busy} aria-pressed={!off}
          onClick={() => act(() => haCallService("climate", "set_hvac_mode", { entity_id: z.id, hvac_mode: off ? "cool" : "off" }))}>
          {off ? "Turn on" : "Cool"}
        </button>
      </div>
      <div className="v2-zone-body">
        <div className="v2-zone-now">
          <span className={`v2-zone-temp${warm ? " warm" : ""}`}>{z.now != null ? `${z.now}°` : "—"}</span>
          <span className="v2-small">inside</span>
        </div>
        <div className="v2-setpoint" role="group" aria-label={`${z.name} target`}>
          <button type="button" className="v2-round" aria-label="Cooler" disabled={!z.available || off || target == null} onClick={() => nudge(-1)}>−</button>
          <div className="v2-set-val">
            <span>{target != null ? `${target}°` : "—"}</span>
            <small>{pending != null ? "setting…" : "target"}</small>
          </div>
          <button type="button" className="v2-round" aria-label="Warmer" disabled={!z.available || off || target == null} onClick={() => nudge(1)}>+</button>
        </div>
      </div>
      <div className="v2-zone-foot">
        {z.held ? (
          <>
            <span className="v2-hold">Held{z.heldUntil ? ` until ${time(z.heldUntil)}` : ""}</span>
            <button type="button" className="v2-mini" disabled={busy} onClick={() => act(() => haCallService("timer", "cancel", { entity_id: holdTimer(z.id) }))}>Back to schedule</button>
          </>
        ) : (
          <span className="v2-small">{holdable ? "On schedule" : OPEN_AIR.has(z.id) ? "Open-air room: schedule switches it off 5–9 PM, and runs it in Vacation" : "On schedule"}</span>
        )}
      </div>
    </section>
  );
}
