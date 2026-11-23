import { useMemo } from "react";
import type { HAState } from "@/lib/ha";
import { buildNetGridSeries } from "@/lib/netGrid";
import { useSolarPeriods } from "@/lib/useSolarPeriods";
import { useEntityHistory, useGridCostStatistics } from "@/components/Wall";
import { energyNow } from "@/lib/houseMap";
import { EnergyStrip } from "./WallV2";

// Energy: the live strip, the last 24 hours of solar vs house use, both
// Powerwall systems with the balancer, and the money (same calculations as
// the classic Energy page).

const S1 = "sensor.gonser_4680_system_1_";
const S2 = "sensor.4680_system_2_";
const MAUI_TZ = "Pacific/Honolulu";

function useSummed(a: string, b: string) {
  const pa = useEntityHistory(a);
  const pb = useEntityHistory(b);
  return useMemo(() => {
    const end = Date.now();
    // buildNetGridSeries carries each system's last value forward on a
    // 5-minute grid and returns -(a+b); flip it back to a plain sum.
    return buildNetGridSeries(pa, pb, end - 24 * 3600_000, end).map((p) => ({ t: p.t, v: -p.net }));
  }, [pa, pb]);
}

export function EnergyScreen({ states }: { states: Map<string, HAState> }) {
  const list = useMemo(() => [...states.values()], [states]);
  const solarRows = useSolarPeriods(list);
  const grid = useGridCostStatistics();
  const solar = useSummed(`${S1}solar_power`, `${S2}solar_power`);
  const house = useSummed(`${S1}load_power`, `${S2}load_power`);
  const e = energyNow(states);
  const num = (id: string) => { const n = Number(states.get(id)?.state); return Number.isFinite(n) ? n : null; };
  const exported = (num(`${S1}grid_exported`) ?? 0) + (num(`${S2}grid_exported`) ?? 0);
  const imported = (num(`${S1}grid_imported`) ?? 0) + (num(`${S2}grid_imported`) ?? 0);
  const s = grid.summary;
  // todayBalance: positive = credit. currentMonthCost: positive = owed.
  const credit = (n: number | undefined) => (n == null ? "—" : `${n >= 0 ? "+" : "−"}$${Math.abs(n).toFixed(2)}`);
  const balanceOn = states.get("input_boolean.maui_balance_enabled")?.state === "on";
  const balanceStatus = states.get("sensor.maui_balance_status")?.state;
  const moved = num("sensor.maui_balance_moved_today");

  return (
    <div className="v2-energy">
      <EnergyStrip states={states} />
      <div className="v2-energy-mid">
        <section className="v2-card v2-chart-card" aria-label="Last 24 hours">
          <div className="v2-sec-head">
            <span className="v2-h">Last 24 hours</span>
            <span className="v2-legend"><span><i className="lg-solar" />Solar</span><span><i className="lg-house" />House</span><span>kW</span></span>
          </div>
          <DayChart solar={solar} house={house} />
        </section>
        <section className="v2-card v2-pw" aria-label="Powerwalls">
          <div className="v2-h">Powerwalls</div>
          <SysCard name="System 1" sub="Mudroom panel · AC condensers" soc={e.soc1} kw={num(`${S1}battery_power`)} solarToday={num(`${S1}solar_generated`)} />
          <SysCard name="System 2" sub="Garage · pool · water heater" soc={e.soc2} kw={num(`${S2}battery_power`)} solarToday={num(`${S2}solar_generated`)} />
          <div className="v2-small">
            Battery balance {balanceOn ? "on" : "off"}{balanceStatus ? ` · ${balanceStatus}` : ""}{moved != null && moved > 0 ? ` · moved ${moved.toFixed(1)} kWh today` : ""}
          </div>
        </section>
      </div>
      <div className="v2-energy-tiles">
        <Tile label="Solar made today" big={solarRows.today.value.replace(" kWh", "")} unit={solarRows.today.value.includes("kWh") ? "kWh" : ""} sub={solarRows.today.warning ? solarRows.today.detail : "Main Envoy, hourly"} color="#B07800" />
        <Tile label="Sold to the grid" big={exported.toFixed(1)} unit="kWh" sub={`bought ${imported.toFixed(1)} kWh today`} color="#2E6B3A" />
        <Tile label="Today vs. grid" big={credit(s?.todayBalance)} unit="" sub={s && !s.isTodayComplete ? "still adding up" : s && s.todayBalance < 0 ? "cost after selling back" : "credit after buying back"} color={s && s.todayBalance < 0 ? "#7A2E14" : "#2E6B3A"} />
        <Tile label="This month" big={s ? credit(-s.currentMonthCost) : "—"} unit="" sub={grid.loading ? "loading…" : grid.error ? "unavailable" : s && s.currentMonthCost > 0 ? "owed on the bill so far" : "credit on the bill so far"} color={s && s.currentMonthCost > 0 ? "#7A2E14" : "#2E6B3A"} />
        <Tile label="Solar last 7 days" big={solarRows.sevenDay.value.replace(" kWh", "")} unit={solarRows.sevenDay.value.includes("kWh") ? "kWh" : ""} sub="today + previous 6" color="#B07800" />
      </div>
    </div>
  );
}

function SysCard({ name, sub, soc, kw, solarToday }: { name: string; sub: string; soc: number | null; kw: number | null; solarToday: number | null }) {
  const state = kw == null ? "—" : kw < -0.05 ? `Charging ${(-kw).toFixed(1)} kW` : kw > 0.05 ? `Supplying ${kw.toFixed(1)} kW` : "Idle";
  return (
    <div className="v2-sys">
      <div className="v2-sys-top">
        <div><div className="v2-sys-name">{name}</div><div className="v2-small">{sub}</div></div>
        <div className="v2-sys-pct">{soc != null ? `${Math.round(soc)}%` : "—"}</div>
      </div>
      <div className="v2-bar" role="img" aria-label={`${name} ${soc != null ? Math.round(soc) : "unknown"} percent`}><i style={{ width: `${soc ?? 0}%` }} /></div>
      <div className="v2-small">{state}{solarToday != null ? ` · ${solarToday.toFixed(1)} kWh solar today` : ""}</div>
    </div>
  );
}

function Tile({ label, big, unit, sub, color }: { label: string; big: string; unit: string; sub: string; color: string }) {
  return (
    <div className="v2-card v2-etile">
      <div className="v2-muted">{label}</div>
      <div><span className="v2-big" style={{ color }}>{big}</span> <span className="v2-muted">{unit}</span></div>
      <div className="v2-small v2-ellipsis">{sub}</div>
    </div>
  );
}

function DayChart({ solar, house }: { solar: { t: number; v: number }[]; house: { t: number; v: number }[] }) {
  const W = 640, H = 250, L = 34, B = 24, T = 8;
  const end = Date.now(), start = end - 24 * 3600_000;
  const max = Math.max(4, ...solar.map((p) => p.v), ...house.map((p) => p.v));
  const top = Math.ceil(max / 2) * 2;
  const X = (t: number) => L + ((W - L - 6) * (t - start)) / (end - start);
  const Y = (v: number) => T + (H - T - B) * (1 - Math.max(0, v) / top);
  const line = (pts: { t: number; v: number }[]) => pts.map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
  const area = solar.length ? `${X(solar[0].t)},${Y(0)} ${line(solar)} ${X(solar[solar.length - 1].t)},${Y(0)}` : "";
  const ticks: number[] = [];
  for (let k = 0; k <= top; k += top > 8 ? 4 : 2) ticks.push(k);
  const hours: Array<[number, string]> = [];
  for (let t = Math.ceil(start / 3600_000) * 3600_000; t <= end; t += 3600_000) {
    const h = Number(new Date(t).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: MAUI_TZ }));
    if (h % 6 === 0) hours.push([t, h === 0 ? "12 AM" : h === 12 ? "Noon" : h < 12 ? `${h} AM` : `${h - 12} PM`]);
  }
  if (!solar.length && !house.length) return <div className="v2-muted v2-center" style={{ height: H }}>Loading history…</div>;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="v2-chart" role="img" aria-label="Solar production and house use over the last 24 hours">
      {ticks.map((k) => (
        <g key={k}><line x1={L} x2={W - 6} y1={Y(k)} y2={Y(k)} stroke="#EFE8DC" /><text x={L - 6} y={Y(k) + 4} textAnchor="end" fontSize="11" fill="#56646A">{k}</text></g>
      ))}
      {hours.map(([t, lab]) => (
        <g key={t}><line x1={X(t)} x2={X(t)} y1={T} y2={Y(0)} stroke={lab === "12 AM" ? "#D8CFBF" : "#F3EEE4"} /><text x={X(t)} y={H - 6} textAnchor="middle" fontSize="11" fill="#56646A">{lab}</text></g>
      ))}
      {area && <polygon points={area} fill="#F6D98A" opacity="0.75" />}
      {solar.length > 0 && <polyline points={line(solar)} fill="none" stroke="#D9A400" strokeWidth="2" />}
      {house.length > 0 && <polyline points={line(house)} fill="none" stroke="#1E2A2E" strokeWidth="1.6" />}
    </svg>
  );
}
