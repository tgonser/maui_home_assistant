import { useState } from "react";
import { haCallService, type HAState } from "@/lib/ha";
import { SHADE_SECTIONS, shadeView } from "@/lib/shades";

// Shades: every Lutron shade by room with Open / Half / Close, plus open or
// close a whole floor. The garage door is shown for status only.

export function ShadesScreen({ states }: { states: Map<string, HAState> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (key: string, service: string, data: Record<string, unknown>) => {
    setBusy(key);
    await haCallService("cover", service, data);
    setBusy(null);
  };
  const garage = states.get("cover.garage_door_garage_door");
  return (
    <div className="v2-shades">
      {SHADE_SECTIONS.map((sec) => {
        const ids = sec.shades.map(([id]) => id).filter((id) => states.get(id)?.state !== "unavailable");
        return (
          <section key={sec.title} className="v2-card v2-shade-sec" aria-label={sec.title}>
            <div className="v2-sec-head">
              <span className="v2-h">{sec.title}</span>
              <span className="v2-sec-actions">
                <button type="button" className="v2-mini" disabled={!ids.length || busy === sec.title + "o"} onClick={() => act(sec.title + "o", "open_cover", { entity_id: ids })}>Open all</button>
                <button type="button" className="v2-mini" disabled={!ids.length || busy === sec.title + "c"} onClick={() => act(sec.title + "c", "close_cover", { entity_id: ids })}>Close all</button>
              </span>
            </div>
            <div className="v2-shade-grid">
              {sec.shades.map(([id, name]) => {
                const v = shadeView(states, id, name);
                return (
                  <div key={id} className={`v2-shade${v.pos != null && v.pos > 1 ? " open" : ""}`}>
                    <div className="v2-shade-top">
                      <span className="v2-ltile-name">{name}</span>
                      <span className="v2-small">{v.label}</span>
                    </div>
                    <div className="v2-shade-win" aria-hidden="true"><i style={{ height: `${100 - (v.pos ?? 0)}%` }} /></div>
                    <div className="v2-shade-btns" role="group" aria-label={`${name} position`}>
                      <button type="button" disabled={!v.available || busy === id} onClick={() => act(id, "open_cover", { entity_id: id })}>Open</button>
                      <button type="button" disabled={!v.available || busy === id} onClick={() => act(id, "set_cover_position", { entity_id: id, position: 50 })}>Half</button>
                      <button type="button" disabled={!v.available || busy === id} onClick={() => act(id, "close_cover", { entity_id: id })}>Close</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {garage && (
        <section className="v2-card v2-shade-sec v2-garage">
          <span className="v2-h">Garage door</span>
          <span className="v2-muted">{garage.state === "unavailable" ? "Not reporting to Home Assistant" : garage.state === "closed" ? "Closed" : garage.state === "open" ? "Open" : garage.state}</span>
          <span className="v2-small">Status only — use the garage app or remote to move it.</span>
        </section>
      )}
    </div>
  );
}
