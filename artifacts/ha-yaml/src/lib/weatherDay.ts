// Weather tab helpers: sun times for any date (NOAA method), forecast grouped
// by Maui day, and a rough solar estimate from the cloud forecast.

export const MAKENA = { lat: 20.6326, lon: -156.4446 };
const HST_OFFSET_MS = -10 * 3600_000; // Hawaii has no daylight saving.
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export type SunDay = { firstLight: number; sunrise: number; sunset: number; lastLight: number; dayHours: number; nightHours: number };

/** Sunrise/sunset (sun 0.833° below the horizon) and first/last light (civil
 *  twilight, 6° below) for the Maui calendar day `ymd` ("YYYY-MM-DD"), as
 *  epoch ms. Accurate to about a minute. */
export function sunTimes(ymd: string, lat = MAKENA.lat, lon = MAKENA.lon): SunDay {
  const [y, m, d] = ymd.split("-").map(Number);
  const midnightUtc = Date.UTC(y, m - 1, d);
  const localNoonUtc = midnightUtc + 12 * 3600_000 - HST_OFFSET_MS;
  const jd = localNoonUtc / 86_400_000 + 2440587.5;
  const t = (jd - 2451545) / 36525;
  const L0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const C = Math.sin(rad(M)) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * t) + Math.sin(rad(3 * M)) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const decl = Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda)));
  const yv = Math.tan(rad(eps / 2)) ** 2;
  const eqTime = 4 * deg(yv * Math.sin(2 * rad(L0)) - 2 * e * Math.sin(rad(M)) + 4 * e * yv * Math.sin(rad(M)) * Math.cos(2 * rad(L0)) - 0.5 * yv * yv * Math.sin(4 * rad(L0)) - 1.25 * e * e * Math.sin(2 * rad(M)));
  const noonMin = 720 - 4 * lon - eqTime; // minutes after 00:00 UTC on that date
  const ha = (zenith: number) => deg(Math.acos(Math.cos(rad(zenith)) / (Math.cos(rad(lat)) * Math.cos(decl)) - Math.tan(rad(lat)) * Math.tan(decl)));
  const at = (min: number) => midnightUtc + Math.round(min * 60_000);
  const h0 = ha(90.833), h6 = ha(96);
  const sunrise = at(noonMin - 4 * h0), sunset = at(noonMin + 4 * h0);
  const dayHours = (sunset - sunrise) / 3600_000;
  return { firstLight: at(noonMin - 4 * h6), sunrise, sunset, lastLight: at(noonMin + 4 * h6), dayHours, nightHours: 24 - dayHours };
}

/** Maui calendar day of an instant, "YYYY-MM-DD". */
export const mauiDay = (ms: number) => new Date(ms + HST_OFFSET_MS).toISOString().slice(0, 10);
/** Maui hour of day (0–23.99) of an instant. */
export const mauiHour = (ms: number) => { const d = new Date(ms + HST_OFFSET_MS); return d.getUTCHours() + d.getUTCMinutes() / 60; };
export const addDays = (ymd: string, n: number) => new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10) + n)).toISOString().slice(0, 10);

/** "6:44 AM" for an instant, Maui time. */
export function clockText(ms: number): string {
  const h = mauiHour(ms); const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  const H = mm === 60 ? hh + 1 : hh, M = mm === 60 ? 0 : mm;
  return `${H % 12 || 12}:${String(M).padStart(2, "0")} ${H < 12 ? "AM" : "PM"}`;
}
/** "11 h 1 min" */
export const hoursText = (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)} h ${m % 60} min`; };

export type Hourly = { datetime: string; temperature?: number; condition?: string; precipitation_probability?: number; cloud_coverage?: number; wind_speed?: number };

/** Average cloud cover (0–100) over the sunny part of a day (9 AM–4 PM),
 *  from hourly forecasts; null when the forecast doesn't cover it. */
export function daytimeCloud(hours: Hourly[], ymd: string): number | null {
  const vals = hours.filter((p) => { const t = Date.parse(p.datetime); const h = mauiHour(t); return mauiDay(t) === ymd && h >= 9 && h < 16 && typeof p.cloud_coverage === "number"; }).map((p) => p.cloud_coverage as number);
  return vals.length >= 3 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Rough solar for a day: the best recent day (≈ a clear day this season)
 *  scaled down by cloud cover. Heavy cloud still leaves ~30% (diffuse light). */
export function solarEstimate(bestRecentKwh: number, cloudPct: number): number {
  const c = Math.min(100, Math.max(0, cloudPct)) / 100;
  return Math.round(bestRecentKwh * (1 - 0.7 * c));
}

/** The house's solar tiers by average kW, as on the Climate automation. */
export function sunWords(cloudPct: number): string {
  return cloudPct < 20 ? "Sunny" : cloudPct < 45 ? "Mostly sunny" : cloudPct < 70 ? "Partly cloudy" : cloudPct < 90 ? "Mostly cloudy" : "Cloudy";
}

const CONDITION: Record<string, [string, string]> = {
  sunny: ["☀️", "Sunny"], "clear-night": ["🌙", "Clear"], partlycloudy: ["⛅", "Partly cloudy"], cloudy: ["☁️", "Cloudy"],
  rainy: ["🌧️", "Rain"], pouring: ["🌧️", "Heavy rain"], lightning: ["🌩️", "Thunder"], "lightning-rainy": ["⛈️", "Thunderstorms"],
  windy: ["💨", "Windy"], "windy-variant": ["💨", "Windy"], fog: ["🌫️", "Fog"], exceptional: ["⚠️", "Unusual weather"],
};
export const conditionIcon = (c?: string) => CONDITION[c ?? ""]?.[0] ?? "🌤️";
export const conditionText = (c?: string) => CONDITION[c ?? ""]?.[1] ?? (c ? c.replace(/-/g, " ") : "—");
