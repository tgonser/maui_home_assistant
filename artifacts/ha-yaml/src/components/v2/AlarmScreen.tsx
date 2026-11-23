import { useMemo, useState } from "react";
import { useHAStore, type HAState } from "@/lib/ha";
import { COMPANION_KEYS, companionHealth, discoverAlarmSystems, keypadInfo, panelTone, prettyState, zoneBadges, type Tone } from "@/lib/alarm";
import { AlarmPanel } from "@/components/AlarmPanel";

// Alarm: status, zones and panel health in the new design. Arming and
// disarming open the classic alarm panel, unchanged, so the code handling
// (code kept on the add-on server, secure-connection check, confirmation,
// attempt limit) stays exactly as tested.

const TONE_CLASS: Record<Tone, string> = { ok: "t-ok", warn: "t-warn", alert: "t-alert", unknown: "t-unknown", neutral: "t-neutral" };
const unnamed = (name: string) => /zone \d+$/i.test(name);

export function AlarmScreen({ states, lastMs }: { states: Map<string, HAState>; lastMs: number }) {
  const list = useMemo(() => [...states.values()], [states]);
  const systems = useMemo(() => discoverAlarmSystems(list), [list]);
  const [open, setOpen] = useState(false);
  const connection = useHAStore((s) => s.url);
  const sys = systems[0];

  if (!sys) {
    return <section className="v2-card v2-center v2-notyet"><div className="v2-h">No alarm panel found</div><p>Looking for the EyezOn / Envisalink partition in Home Assistant.</p></section>;
  }
  const p = sys.panel;
  const tone = panelTone(p.state);
  const kp = keypadInfo(sys.keypad);
  const named = sys.zones.filter((z) => !unnamed(z.name));
  const openZones = sys.zones.filter((z) => z.open);
  const issues = sys.zones.filter((z) => zoneBadges(z).some((b) => b.kind !== "closed" && b.kind !== "open"));

  return (
    <div className="v2-alarm">
      <section className={`v2-card v2-alarm-hero ${TONE_CLASS[tone]}`} aria-label="Alarm status">
        <div className="v2-muted">Alarm</div>
        <div className="v2-alarm-state">{prettyState(p.state)}</div>
        <div className="v2-muted">{openZones.length ? `${openZones.length} open: ${openZones.map((z) => z.name.replace(/^Makena Alarm /, "")).join(", ")}` : "All doors and sensors closed"}</div>
        {kp.text && <div className="v2-keypad">{kp.text}</div>}
        <div className="v2-grow" />
        <button type="button" className="v2-btn v2-primary v2-wide" onClick={() => setOpen(true)}>Arm or disarm…</button>
        <div className="v2-small">Opens the alarm keypad. Your alarm code is entered there every time.</div>
      </section>
      <div className="v2-alarm-right">
        <section className="v2-card v2-alarm-zones" aria-label="Zones">
          <div className="v2-sec-head">
            <span className="v2-h">Zones</span>
            <span className="v2-muted">{sys.zones.length - named.length} unnamed zones hidden{issues.length ? ` · ${issues.length} need attention` : ""}</span>
          </div>
          <div className="v2-zone-list">
            {[...named, ...sys.zones.filter((z) => unnamed(z.name) && zoneBadges(z).some((b) => b.kind !== "closed"))].map((z) => {
              const badges = zoneBadges(z);
              const worst = badges.find((b) => b.tone === "alert") ?? badges.find((b) => b.tone === "warn") ?? badges[0];
              return (
                <div key={z.entity.entity_id} className={`v2-azone ${TONE_CLASS[worst.tone]}`}>
                  <span className="v2-azone-no">{z.zone}</span>
                  <span className="v2-azone-name">{z.name.replace(/^Makena Alarm /, "")}</span>
                  <span className="v2-azone-state">{badges.map((b) => b.label).join(" · ")}</span>
                </div>
              );
            })}
          </div>
        </section>
        <section className="v2-card v2-alarm-health" aria-label="Panel health">
          {COMPANION_KEYS.map((k) => {
            const h = companionHealth(k, sys.companions[k]);
            return <div key={k} className={`v2-health ${TONE_CLASS[h.tone]}`}><span className="v2-small">{h.label}</span><b>{h.value}</b></div>;
          })}
        </section>
      </div>
      {open && (
        <div className="v2-modal" role="dialog" aria-modal="true" aria-label="Alarm keypad">
          <div className="wall-root v2-alarm-sheet">
            <div className="v2-alarm-sheet-head">
              <span>Alarm keypad</span>
              <button type="button" className="v2-mini" onClick={() => setOpen(false)}>Close</button>
            </div>
            <AlarmPanel states={list} connected={true} lastOkMs={lastMs || null} connection={connection} onRefresh={() => undefined} />
          </div>
        </div>
      )}
    </div>
  );
}
