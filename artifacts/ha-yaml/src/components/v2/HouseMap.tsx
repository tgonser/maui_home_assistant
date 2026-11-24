import { useMemo } from "react";
import type { HAState } from "@/lib/ha";
import { FLOORS, fitLabel, groupOf, type MapFloor, type RoomStatus } from "@/lib/houseMap";

// Both floors drawn from the floor plans, in plan units, scaled by SVG.
// Rooms tint cool→warm by their thermostat, glow when lit, pulse on motion,
// and show ♪ when their speaker is playing. Doors with sensors turn orange
// when open.

function mix(a: string, b: string, t: number) {
  const p = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  return "#" + [0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, "0")).join("");
}

type Props = {
  states: Map<string, HAState>;
  status: Map<string, RoomStatus>;
  inUse: Set<string>;
  onRoomTap: (group: string) => void;
};

export function HouseMap({ states, status, inUse, onRoomTap }: Props) {
  return (
    <div className="v2-map">
      {FLOORS.map((f) => (
        <Floor key={f.id} floor={f} states={states} status={status} inUse={inUse} onRoomTap={onRoomTap} />
      ))}
    </div>
  );
}

function Floor({ floor: f, states, status, inUse, onRoomTap }: Props & { floor: MapFloor }) {
  const labels = useMemo(
    () =>
      new Map(
        f.rooms.map((r) => {
          const w = r.x1 - r.x0, h = r.y1 - r.y0;
          const compact = w < 176 || h < 132;
          return [r.id, { compact, ...fitLabel(r.name, w, h, compact ? 28 : 34, compact ? 22 : 50) }];
        }),
      ),
    [f],
  );
  return (
    <figure className="v2-floor" style={{ flexGrow: f.w }}>
      <figcaption>{f.title}</figcaption>
      <svg viewBox={`${f.ox} ${f.oy} ${f.w} ${f.h}`} role="group" aria-label={f.title}>
        {f.outdoor.map((o, i) => {
          const w = o.x1 - o.x0, h = o.y1 - o.y0;
          const { fs, rot } = fitLabel(o.name, w, h, 30, 20);
          const cx = (o.x0 + o.x1) / 2, cy = (o.y0 + o.y1) / 2;
          return (
            <g key={i} aria-hidden="true">
              <rect x={o.x0} y={o.y0} width={w} height={h} rx={20} className="v2-out" />
              <text x={cx} y={cy} fontSize={fs} className="v2-out-label" transform={rot ? `rotate(-90 ${cx} ${cy})` : undefined}>{o.name}</text>
            </g>
          );
        })}
        {f.rooms.map((r) => {
          const g = groupOf(r);
          const s = status.get(g);
          const lit = r.kind !== "elev" && r.kind !== "void" && (s?.lightsOn ?? 0) > 0;
          const t = r.kind === "room" ? s?.temp ?? null : null;
          const lab = labels.get(r.id)!;
          let fill = r.kind === "elev" ? "#1F5F73" : r.kind === "void" ? "url(#v2-hatch)" : t != null ? mix("#D6E9EF", "#F4D3BC", Math.max(0, Math.min(1, (t - 72) / 8))) : "#EFE8DC";
          if (lit) fill = t != null ? mix(fill, "#FFF1C9", 0.55) : "#FFF1C9";
          const w = r.x1 - r.x0, h = r.y1 - r.y0;
          const tappable = r.kind !== "void" && r.kind !== "elev" && (s?.lightIds.length ?? 0) > 0;
          const icons = (s?.playing && r.kind === "room" && !r.group ? "♪ " : "") + (inUse.has(r.id) ? "in use" : "");
          // Current room temperature, then the AC: ❄ + target while cooling,
          // "→ target" when idle, "AC off" when switched off.
          const ac = t == null ? "" : s?.acOff ? "AC off" : s?.target != null ? `${s.cooling ? "❄ " : "→ "}${s.target}°` : "";
          const hot = t != null && !s?.acOff && s?.target != null && t > s.target + 1;
          const pad = lab.compact ? 10 : 22;
          const nameY = r.y0 + pad + lab.fs * 0.85;
          const name = r.kind === "elev" ? (
            <text x={(r.x0 + r.x1) / 2} y={(r.y0 + r.y1) / 2 + 16} fontSize={44} className="v2-elev">⇅</text>
          ) : lab.rot ? (
            <text x={r.x0 + pad + lab.fs * 0.8} y={r.y1 - pad} fontSize={lab.fs} className={r.kind === "void" ? "v2-void-label" : "v2-room-label"} transform={`rotate(-90 ${r.x0 + pad + lab.fs * 0.8} ${r.y1 - pad})`}>{r.name}</text>
          ) : (
            <text x={r.x0 + pad} y={nameY} fontSize={lab.fs} className={r.kind === "void" ? "v2-void-label" : "v2-room-label"}>{r.name}</text>
          );
          const label = `${r.name || "Hall"}${t != null ? `, ${t}° now${s?.acOff ? ", AC off" : s?.target != null ? `, set to ${s.target}°${s.cooling ? ", cooling" : ""}` : ""}` : ""}${tappable ? `, ${s!.lightsOn} of ${s!.lightIds.length} lights on` : ""}`;
          return (
            <g
              key={r.id}
              role={tappable ? "button" : undefined}
              tabIndex={tappable ? 0 : undefined}
              aria-label={tappable ? `${label}. Tap to turn ${lit ? "off" : "on"}` : undefined}
              aria-pressed={tappable ? lit : undefined}
              className={tappable ? "v2-room v2-tap" : "v2-room"}
              onClick={tappable ? () => onRoomTap(g) : undefined}
              onKeyDown={tappable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRoomTap(g); } } : undefined}
            >
              <rect x={r.x0 + 3} y={r.y0 + 3} width={w - 6} height={h - 6} rx={16} fill={fill} className={lit ? "v2-lit" : undefined} />
              {name}
              {t != null && !lab.compact && (
                <>
                  <text x={r.x0 + pad} y={nameY + 58} fontSize={52} className={`v2-room-temp${hot ? " v2-hot" : ""}`}>{t}°</text>
                  {ac && <text x={r.x0 + pad} y={nameY + 94} fontSize={30} className={s?.cooling ? "v2-ac-cool" : "v2-ac-idle"}>{ac}</text>}
                </>
              )}
              {icons && !lab.compact && <text x={r.x0 + pad} y={nameY + (t != null ? (ac ? 130 : 100) : 44)} fontSize={30} className="v2-room-icons">{icons}</text>}
              {s?.motion && (!r.group || r.id === "stair2b") && <circle cx={r.x1 - 26} cy={r.y0 + 26} r={14} className="v2-motion" />}
            </g>
          );
        })}
        {f.doors.map((d, i) => {
          const open = d.sensor ? states.get(d.sensor)?.state === "on" : false;
          return <rect key={i} x={d.x0} y={d.y0} width={d.x1 - d.x0} height={d.y1 - d.y0} rx={6} className={open ? "v2-door v2-door-open" : d.sensor ? "v2-door" : "v2-door v2-door-nosensor"} />;
        })}
        <defs>
          <pattern id="v2-hatch" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="24" height="24" fill="#F5F0E7" />
            <rect width="6" height="24" fill="#EAE2D3" />
          </pattern>
        </defs>
      </svg>
    </figure>
  );
}
