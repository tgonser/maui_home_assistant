import { useEffect, useMemo, useState } from "react";
import { haForecast, haStatistics, type HAState } from "@/lib/ha";
import { addDays, clockText, conditionIcon, conditionText, daytimeCloud, hoursText, mauiDay, mauiHour, solarEstimate, sunTimes, sunWords, type Hourly, type SunDay } from "@/lib/weatherDay";

// Weather: conditions now (the house's Tempest station), a day picker with the
// forecast for that day, the sun dial (first light, sunrise, sunset, last
// light, hours of day and night) and the hours. Owners also see a rough solar
// estimate from the cloud forecast.

const STATION = "weather.makena_4";
const FALLBACK = "weather.forecast_home";
const ENVOY_TODAY = "sensor.envoy_202445013483_energy_production_today";

type Daily = { datetime: string; temperature?: number; templow?: number; condition?: string; precipitation_probability?: number; wind_speed?: number; cloud_coverage?: number };

export function WeatherScreen({ states, showSolar }: { states: Map<string, HAState>; showSolar: boolean }) {
  const now = Date.now();
  const today = mauiDay(now);
  const station = states.get(STATION) ?? states.get(FALLBACK);
  const [daily, setDaily] = useState<Daily[]>([]);
  const [hourly, setHourly] = useState<Hourly[]>([]);
  const [bestKwh, setBestKwh] = useState<number | null>(null);
  const [day, setDay] = useState(addDays(today, 1));

  useEffect(() => {
    let live = true;
    const load = async () => {
      const ids = [STATION, FALLBACK].filter((id) => states.has(id));
      const d = await Promise.all(ids.map((id) => haForecast(id, "daily")));
      const h = await Promise.all(ids.map((id) => haForecast(id, "hourly")));
      if (!live) return;
      const firstDaily = d.find((r) => r.ok && r.data.length);
      if (firstDaily && firstDaily.ok) setDaily(firstDaily.data as Daily[]);
      // Hours from both sources: the station's temperatures, met.no's cloud cover.
      setHourly(h.flatMap((r) => (r.ok ? (r.data as Hourly[]) : [])));
    };
    void load();
    const t = window.setInterval(load, 30 * 60_000);
    return () => { live = false; window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showSolar) return;
    void haStatistics([ENVOY_TODAY], "day", new Date(now - 21 * 86_400_000), undefined, ["max"]).then((r) => {
      if (!r.ok) return;
      const vals = (r.data[ENVOY_TODAY] ?? []).map((p) => p.max ?? 0).filter((v) => v > 0);
      if (!vals.length) return;
      const best = Math.max(...vals);
      setBestKwh(best > 1000 ? best / 1000 : best);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSolar]);

  const days = useMemo(() => {
    const list = [today, addDays(today, 1), addDays(today, 2), addDays(today, 3), addDays(today, 4)];
    return list.map((ymd) => ({ ymd, f: daily.find((p) => mauiDay(Date.parse(p.datetime) + 12 * 3600_000) === ymd || mauiDay(Date.parse(p.datetime)) === ymd) }));
  }, [daily, today]);
  const sel = days.find((d) => d.ymd === day) ?? days[1];
  const sun = useMemo(() => sunTimes(sel.ymd), [sel.ymd]);
  const cloud = daytimeCloud(hourly, sel.ymd) ?? (typeof sel.f?.cloud_coverage === "number" ? sel.f.cloud_coverage : null);
  const dayLabel = (ymd: string) => (ymd === today ? "Today" : ymd === addDays(today, 1) ? "Tomorrow" : new Date(ymd + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }));
  const hoursForDay = hourly
    .filter((p) => p.temperature != null && mauiDay(Date.parse(p.datetime)) === sel.ymd && mauiHour(Date.parse(p.datetime)) >= 6 && mauiHour(Date.parse(p.datetime)) <= 20)
    .filter((p, i, a) => a.findIndex((q) => q.datetime.slice(0, 13) === p.datetime.slice(0, 13)) === i)
    .sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime));

  return (
    <div className="v2-weather">
      <Now station={station} todayF={days[0].f} />
      <section className="v2-card v2-wx-day" aria-label="Forecast">
        <div className="v2-seg v2-seg-sm v2-wx-days" role="radiogroup" aria-label="Day">
          {days.map((d) => (
            <button key={d.ymd} type="button" role="radio" aria-checked={d.ymd === sel.ymd} className={d.ymd === sel.ymd ? "on" : ""} onClick={() => setDay(d.ymd)}>{dayLabel(d.ymd)}</button>
          ))}
        </div>
        {sel.f ? (
          <>
            <div className="v2-wx-big">
              <span className="v2-wx-icon">{conditionIcon(sel.f.condition)}</span>
              <div>
                <div className="v2-wx-hilo"><b>{Math.round(sel.f.temperature ?? NaN)}°</b> <span>| {sel.f.templow != null ? `${Math.round(sel.f.templow)}°` : "—"}</span></div>
                <div className="v2-wx-cond">{conditionText(sel.f.condition)}</div>
              </div>
            </div>
            <div className="v2-wx-facts">
              <Fact label="Rain chance" value={sel.f.precipitation_probability != null ? `${Math.round(sel.f.precipitation_probability)}%` : "—"} />
              <Fact label="Sun" value={cloud != null ? `${sunWords(cloud)} · ${Math.round(cloud)}% cloud` : "—"} />
              {sel.f.wind_speed != null && <Fact label="Wind" value={`${Math.round(sel.f.wind_speed)} mph`} />}
              {showSolar && <Fact label="Solar (estimate)" value={bestKwh != null && cloud != null ? `about ${solarEstimate(bestKwh, cloud)} kWh` : "—"} sub={bestKwh != null ? `A clear day lately: ${Math.round(bestKwh)} kWh` : undefined} />}
            </div>
          </>
        ) : <div className="v2-muted v2-center" style={{ minHeight: 160 }}>Loading the forecast…</div>}
      </section>
      <SunDial sun={sun} nowMs={sel.ymd === today ? now : null} />
      <section className="v2-card v2-wx-hours" aria-label="By the hour">
        <div className="v2-cap">{dayLabel(sel.ymd)} by the hour</div>
        <div className="v2-wx-hourrow">
          {hoursForDay.length ? hoursForDay.map((p) => (
            <div key={p.datetime} className="v2-wx-hour">
              <span>{clockText(Date.parse(p.datetime)).replace(":00", "")}</span>
              <span className="v2-wx-hicon">{conditionIcon(p.condition)}</span>
              <b>{Math.round(p.temperature ?? NaN)}°</b>
              <small>{p.precipitation_probability != null ? `${Math.round(p.precipitation_probability)}%` : ""}</small>
            </div>
          )) : <span className="v2-muted">Hourly forecast not available for this day yet.</span>}
        </div>
      </section>
    </div>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="v2-wx-fact"><span>{label}</span><b>{value}</b>{sub && <small>{sub}</small>}</div>;
}

// Current conditions: temperature on a coloured arc, feels-like, today's
// high and low, rain chance and wind (sustained | gusts, from where).
function Now({ station, todayF }: { station: HAState | undefined; todayF: Daily | undefined }) {
  const a = station?.attributes ?? {};
  const t = Number(a.temperature);
  const feels = Number(a.apparent_temperature);
  const wind = Number(a.wind_speed), gust = Number(a.wind_gust_speed), bearing = Number(a.wind_bearing);
  const lo = 55, hi = 95;
  const ticks = Array.from({ length: 41 }, (_, i) => i);
  const angle = (i: number) => -135 + (270 * i) / 40;
  const at = Number.isFinite(t) ? Math.round(((Math.min(hi, Math.max(lo, t)) - lo) / (hi - lo)) * 40) : -1;
  const color = (i: number) => `hsl(${Math.round(250 - (250 * i) / 40)} 60% 55%)`;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const from = Number.isFinite(bearing) ? dirs[Math.round(bearing / 45) % 8] : "";
  return (
    <section className="v2-card v2-wx-now" aria-label="Now">
      <div className="v2-cap">Now · Mākena</div>
      <svg viewBox="0 0 200 170" className="v2-wx-gauge" role="img" aria-label={`Now ${Number.isFinite(t) ? Math.round(t) : "—"} degrees`}>
        {ticks.map((i) => {
          const r1 = i === at ? 70 : 76, r2 = 88, ang = (angle(i) * Math.PI) / 180;
          return <line key={i} x1={100 + r1 * Math.sin(ang)} y1={98 - r1 * Math.cos(ang)} x2={100 + r2 * Math.sin(ang)} y2={98 - r2 * Math.cos(ang)} stroke={color(i)} strokeWidth={i === at ? 5 : 2.2} strokeLinecap="round" opacity={i === at ? 1 : 0.75} />;
        })}
        <text x="100" y="78" textAnchor="middle" fontSize="26">{conditionIcon(station?.state)}</text>
        <text x="100" y="118" textAnchor="middle" fontSize="38" fontWeight="600" fill="#D9901A">{Number.isFinite(t) ? `${Math.round(t)}°` : "—"}</text>
        <text x="100" y="140" textAnchor="middle" fontSize="13" fill="#1E2A2E">{todayF?.temperature != null ? `${Math.round(todayF.temperature)}°` : ""}{todayF?.templow != null ? ` | ${Math.round(todayF.templow)}°` : ""}</text>
      </svg>
      <div className="v2-wx-cond v2-center-text">{conditionText(station?.state)}</div>
      {Number.isFinite(feels) && <div className="v2-muted v2-center-text">Feels like {Math.round(feels)}°</div>}
      <div className="v2-wx-nowfacts">
        <Fact label="Rain chance" value={todayF?.precipitation_probability != null ? `${Math.round(todayF.precipitation_probability)}%` : "—"} />
        <div className="v2-wx-fact">
          <span>Wind{from ? ` from ${from}` : ""}</span>
          <b>{Number.isFinite(wind) ? Math.round(wind) : "—"}{Number.isFinite(gust) ? ` | ${Math.round(gust)}` : ""} mph</b>
          {Number.isFinite(bearing) && (
            <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="none" stroke="#D8CFBF" /><path d="M20 6 L25 20 L20 17 L15 20 Z" fill="#1E2A2E" transform={`rotate(${bearing + 180} 20 20)`} /></svg>
          )}
          <small>sustained | gusts</small>
        </div>
      </div>
    </section>
  );
}

// Sun dial: midnight at the top, noon at the bottom, morning on the right.
function SunDial({ sun, nowMs }: { sun: SunDay; nowMs: number | null }) {
  const cx = 130, cy = 130, r = 96;
  const ang = (ms: number) => (mauiHour(ms) / 24) * 2 * Math.PI;
  const pt = (a: number, rr = r) => `${(cx + rr * Math.sin(a)).toFixed(1)} ${(cy - rr * Math.cos(a)).toFixed(1)}`;
  const wedge = (a1: number, a2: number) => `M${cx} ${cy}L${pt(a1)}A${r} ${r} 0 ${a2 - a1 > Math.PI ? 1 : 0} 1 ${pt(a2)}Z`;
  const [fl, sr, ss, ll] = [sun.firstLight, sun.sunrise, sun.sunset, sun.lastLight].map(ang);
  return (
    <section className="v2-card v2-wx-sun" aria-label="Sun">
      <div className="v2-wx-sunrow">
        <div className="v2-wx-suncol">
          <Fact label="Last light" value={clockText(sun.lastLight)} />
          <Fact label="Sunset" value={clockText(sun.sunset)} />
        </div>
        <svg viewBox="0 0 260 260" className="v2-wx-dial" role="img" aria-label={`Daylight ${hoursText(sun.dayHours)}`}>
          <circle cx={cx} cy={cy} r={r + 22} fill="#F7F2E9" stroke="#E2D9C8" />
          <circle cx={cx} cy={cy} r={r} fill="#2B4E92" />
          <path d={wedge(fl, sr)} fill="#5F86CC" />
          <path d={wedge(ss, ll)} fill="#5F86CC" />
          <path d={wedge(sr, ss)} fill="#F6DFA0" />
          <text x={cx} y={cy - r - 7} textAnchor="middle" fontSize="11" letterSpacing="2" fill="#7A8A90">MIDNIGHT</text>
          <text x={cx} y={cy + r + 16} textAnchor="middle" fontSize="11" letterSpacing="2" fill="#7A8A90">NOON</text>
          <text x={cx} y={cy + 30} textAnchor="middle" fontSize="11" letterSpacing="1.5" fill="#7A6A40">DAYLIGHT</text>
          <text x={cx} y={cy + 52} textAnchor="middle" fontSize="19" fontWeight="600" fill="#1E2A2E">{hoursText(sun.dayHours)}</text>
          <text x={cx} y={cy - 38} textAnchor="middle" fontSize="11" letterSpacing="1.5" fill="#DCE6F8">NIGHT</text>
          <text x={cx} y={cy - 18} textAnchor="middle" fontSize="15" fontWeight="600" fill="#FFFFFF">{hoursText(sun.nightHours)}</text>
          {nowMs != null && <circle cx={+pt(ang(nowMs), r + 11).split(" ")[0]} cy={+pt(ang(nowMs), r + 11).split(" ")[1]} r="7" fill="#E2A72E" stroke="#FFFFFF" strokeWidth="2" />}
        </svg>
        <div className="v2-wx-suncol">
          <Fact label="First light" value={clockText(sun.firstLight)} />
          <Fact label="Sunrise" value={clockText(sun.sunrise)} />
        </div>
      </div>
    </section>
  );
}
