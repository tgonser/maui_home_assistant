import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Cloud,
  CloudRain,
  CloudSnow,
  Sun,
  Moon,
  CloudLightning,
  CloudDrizzle,
  CloudFog,
  Lightbulb,
  Blinds,
  Thermometer,
  Zap,
  BatteryCharging,
  Camera,
  Activity,
  Pencil,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Volume2,
  VolumeX,
  Volume1,
  Play,
  Power,
  CornerUpLeft,
  Tv,
  Apple,
  Settings,
  Home,
  Wifi,
} from "lucide-react";
import {
  haCallService,
  haCameraImage,
  haHistory,
  haForecast,
  type HAState,
  type HAForecastPoint,
} from "@/lib/ha";
import {
  SuperViewSettings,
  useSuperViewOverrides,
  type SuperViewSlot,
} from "./SuperViewSettings";
import { useEntityAliases } from "@/lib/entityAliases";
import {
  friendlyName as friendlyName_,
  motionSensorLabel,
  displayName,
  cameraSiblingName,
} from "@/lib/display";
import { useRegistry } from "@/lib/rooms";

function useResolvedSlot(
  states: HAState[],
  slot: SuperViewSlot,
): HAState | undefined {
  const overrideId = useSuperViewOverrides((s) => s.overrides[slot]);
  if (!overrideId) return undefined;
  return states.find((s) => s.entity_id === overrideId);
}

const friendly = friendlyName_;
const domainOf = (id: string) => id.split(".")[0] ?? "";
const deviceClass = (s: HAState) =>
  (s.attributes.device_class as string | undefined) ?? "";

const findEntities = (
  states: HAState[],
  pred: (s: HAState) => boolean,
): HAState[] => states.filter(pred);

const findFirst = (
  states: HAState[],
  pred: (s: HAState) => boolean,
): HAState | undefined => states.find(pred);

const matchAtrium = (s: HAState) =>
  /atrium/i.test(s.entity_id) || /atrium/i.test(friendly(s));
const matchTv = (s: HAState) =>
  /tv|apple_tv|appletv|television|roku/i.test(s.entity_id) ||
  /tv|television/i.test(friendly(s));

const WEATHER_ICONS: Record<string, typeof Cloud> = {
  "clear-night": Moon,
  cloudy: Cloud,
  fog: CloudFog,
  hail: CloudSnow,
  lightning: CloudLightning,
  "lightning-rainy": CloudLightning,
  partlycloudy: Cloud,
  pouring: CloudRain,
  rainy: CloudDrizzle,
  snowy: CloudSnow,
  "snowy-rainy": CloudSnow,
  sunny: Sun,
  windy: Cloud,
  "windy-variant": Cloud,
};

function WeatherTile({ states }: { states: HAState[] }) {
  const override = useResolvedSlot(states, "weather");
  const w =
    override ??
    findFirst(
      states,
      (s) =>
        domainOf(s.entity_id) === "weather" && /tempest/i.test(s.entity_id),
    ) ??
    findFirst(states, (s) => domainOf(s.entity_id) === "weather");

  const [forecast, setForecast] = useState<HAForecastPoint[]>([]);
  useEffect(() => {
    if (!w?.entity_id) return;
    let cancelled = false;
    const load = () =>
      haForecast(w.entity_id, "hourly").then((r) => {
        if (!cancelled && r.ok) setForecast(r.data.slice(0, 7));
      });
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [w?.entity_id]);

  const uvSensor = findFirst(
    states,
    (s) =>
      domainOf(s.entity_id) === "sensor" &&
      /tempest.*(uv|ultraviolet)|uv.*tempest/i.test(s.entity_id),
  );
  const rainSensor = findFirst(
    states,
    (s) =>
      domainOf(s.entity_id) === "sensor" &&
      /tempest.*(precip|rain)|(precip|rain).*tempest/i.test(s.entity_id),
  );

  if (!w) {
    return (
      <div className="wall-tile p-6 col-span-2 row-span-2 flex flex-col justify-between">
        <div className="wall-icon-wrap p-3 self-start">
          <Cloud className="w-6 h-6" />
        </div>
        <div>
          <div className="label text-base">Weather</div>
          <div className="value text-3xl">No data</div>
        </div>
      </div>
    );
  }

  const Icon = WEATHER_ICONS[w.state] ?? Cloud;
  const t = w.attributes.temperature as number | undefined;
  const tu = (w.attributes.temperature_unit as string | undefined) ?? "°";
  const hum = w.attributes.humidity as number | undefined;
  const wind = w.attributes.wind_speed as number | undefined;
  const wu = (w.attributes.wind_speed_unit as string | undefined) ?? "mph";
  const uvAttr = w.attributes.uv_index as number | undefined;
  const uv = uvAttr ?? (uvSensor ? parseFloat(uvSensor.state) : undefined);
  const rain = rainSensor ? parseFloat(rainSensor.state) : undefined;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="wall-tile wall-tile--active p-6 col-span-2 row-span-2 flex flex-col justify-between"
    >
      <div className="flex items-start justify-between relative z-[1]">
        <div className="wall-icon-wrap p-3">
          <Icon className="w-6 h-6" />
        </div>
        <div className="text-right">
          <div className="text-5xl font-light tabular-nums value">
            {t !== undefined ? `${Math.round(t)}${tu}` : "—"}
          </div>
          <div className="sub text-[11px] uppercase mt-1 tracking-wider">
            {w.state.replace(/-/g, " ")}
          </div>
          <div className="text-[9px] opacity-40 mt-0.5 uppercase tracking-widest">
            {w.entity_id}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 relative z-[1]">
        <div>
          <div className="label text-xs">Humidity</div>
          <div className="text-lg tabular-nums">
            {hum !== undefined ? `${hum}%` : "—"}
          </div>
        </div>
        <div>
          <div className="label text-xs">Wind</div>
          <div className="text-lg tabular-nums">
            {wind !== undefined ? `${Math.round(wind)} ${wu}` : "—"}
          </div>
        </div>
        {uv !== undefined && !isNaN(uv) ? (
          <div>
            <div className="label text-xs">UV Index</div>
            <div className="text-lg tabular-nums">{Math.round(uv * 10) / 10}</div>
          </div>
        ) : rain !== undefined && !isNaN(rain) ? (
          <div>
            <div className="label text-xs">Rain</div>
            <div className="text-lg tabular-nums">{rain.toFixed(2)}&Prime;</div>
          </div>
        ) : null}
      </div>

      {forecast.length > 0 && (
        <div className="relative z-[1] border-t border-white/10 pt-3 mt-1">
          <div className="flex justify-between">
            {forecast.slice(0, 7).map((f) => {
              const FIcon = WEATHER_ICONS[f.condition ?? ""] ?? Cloud;
              // Hawaii is always UTC-10, no DST
              const hstHour = (new Date(f.datetime).getUTCHours() + 14) % 24;
              const ampm = hstHour >= 12 ? "pm" : "am";
              const h12 = hstHour % 12 || 12;
              const label = `${h12}${ampm}`;
              return (
                <div
                  key={f.datetime}
                  className="flex flex-col items-center gap-0.5"
                >
                  <div className="label text-[9px] uppercase">{label}</div>
                  <FIcon className="w-3.5 h-3.5 opacity-80" />
                  <div className="text-[11px] tabular-nums">
                    {f.temperature !== undefined
                      ? `${Math.round(f.temperature)}°`
                      : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  active,
}: {
  icon: typeof Cloud;
  label: string;
  value: string | number;
  sub?: string;
  active?: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`wall-tile ${active ? "wall-tile--active" : ""} p-5 flex flex-col justify-between min-h-[180px]`}
    >
      <div className="wall-icon-wrap p-3 self-start relative z-[1]">
        <Icon className="w-6 h-6" />
      </div>
      <div className="relative z-[1]">
        <div className="label text-sm">{label}</div>
        <div className="value text-4xl font-light tabular-nums">{value}</div>
        {sub && <div className="sub text-[11px] uppercase mt-1">{sub}</div>}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// House status tile — current mode + which climate threshold is in effect.
// Mirrors the logic of the "Maui Solar-Aware Climate" automation:
//   peak 5-9pm or battery <25%  -> 84° backoff
//   battery >=80% or solar >10kW -> solar-strong comfort targets
//   otherwise                    -> standard targets
// The dew-point floor can raise (never lower) the final setpoint.
// ---------------------------------------------------------------------------
function HouseStatusTile({ states }: { states: HAState[] }) {
  const mode = findFirst(
    states,
    (e) => /^input_select\..*house_mode/i.test(e.entity_id),
  );

  // Only sensors reporting instantaneous power (W/kW) qualify — this keeps
  // cumulative energy sensors (kWh) from skewing the threshold decision.
  const isPowerUnit = (e: HAState) =>
    /^k?W$/i.test(
      ((e.attributes.unit_of_measurement as string | undefined) ?? "").trim(),
    );
  // Prefer the exact sensor the automation itself uses, then fall back to
  // power-unit heuristics.
  const solarSensor =
    states.find((e) => e.entity_id === "sensor.total_solar") ??
    findFirst(
      states,
      (e) =>
        domainOf(e.entity_id) === "sensor" &&
        isPowerUnit(e) &&
        /envoy.*production|solar.*power|current_power_production|pv_power/i.test(
          e.entity_id,
        ),
    );
  const drawSensor = findFirst(
    states,
    (e) =>
      domainOf(e.entity_id) === "sensor" &&
      isPowerUnit(e) &&
      /load|consumption|home.*power|grid.*power|current_power_consumption/i.test(
        e.entity_id,
      ),
  );
  const battSensors = findEntities(
    states,
    (e) =>
      domainOf(e.entity_id) === "sensor" &&
      /(powerwall|tesla|4680|gonser|home_battery)/i.test(e.entity_id) &&
      /(percentage_charged|state_of_charge|charge_level|battery_percent|soc)/i.test(
        e.entity_id,
      ) &&
      e.attributes.unit_of_measurement === "%",
  );
  const dewFloor = findFirst(states, (e) =>
    /dew_point_setpoint_floor|dewpoint_setpoint_floor/i.test(e.entity_id),
  );

  const toKw = (s?: HAState): number => {
    if (!s) return NaN;
    const n = parseFloat(s.state);
    if (isNaN(n)) return NaN;
    const unit = (
      (s.attributes.unit_of_measurement as string | undefined) ?? ""
    ).toLowerCase();
    return unit === "w" ? n / 1000 : n;
  };
  const fmtKw = (n: number) => (isNaN(n) ? "—" : `${n.toFixed(1)} kW`);

  const solarKw = toKw(solarSensor);
  const drawKw = toKw(drawSensor);
  const battVals = battSensors
    .map((e) => parseFloat(e.state))
    .filter((n) => !isNaN(n));
  const batt = battVals.length > 0 ? Math.min(...battVals) : NaN;

  const hour = new Date().getHours();
  const peak = hour >= 17 && hour < 21;

  // Solar tier — prefer HA's own sensor.maui_solar_tier so the tile always
  // agrees with the automation; fall back to bucketing solar kW locally.
  const tierSensor = states.find(
    (e) => e.entity_id === "sensor.maui_solar_tier",
  );
  const tierFromKw = (kw: number) =>
    kw <= 5
      ? "Poor"
      : kw <= 10
        ? "Fair"
        : kw <= 15
          ? "Good"
          : kw <= 20
            ? "Strong"
            : "Excellent";
  const TIER_NAMES = ["Poor", "Fair", "Good", "Strong", "Excellent"];
  const sensorTier = tierSensor
    ? TIER_NAMES.find((t) => t.toLowerCase() === tierSensor.state.toLowerCase())
    : undefined;
  const solarTier =
    sensorTier ?? (!isNaN(solarKw) ? tierFromKw(solarKw) : undefined);
  // Night (9pm–7am): Owners Home / Visitors use the Night matrix row instead
  // of the solar tier — mirror the automation so the tile shows real targets.
  const night = hour >= 21 || hour < 7;

  // Matrix targets for the current mode + tier (from the input_number
  // helpers, so the tile shows exactly what the automation will set).
  const modeState = mode?.state ?? "";
  const modeKey =
    modeState === "Owners Home"
      ? "owners"
      : modeState === "Visitors"
        ? "visitors"
        : "vacation";
  const tier =
    night && modeKey !== "vacation" ? "Night" : solarTier;
  const matrixVal = (group: string): number | null => {
    if (!tier) return null;
    const e = states.find(
      (s) =>
        s.entity_id ===
        `input_number.maui_ct_${modeKey}_${tier.toLowerCase()}_${group}`,
    );
    const n = e ? parseFloat(e.state) : NaN;
    return isNaN(n) ? null : Math.round(n);
  };
  const mT = matrixVal("master");
  const sT = matrixVal("sitting");
  const rT = matrixVal("rest");

  const tierLabel = tier === "Night" ? "Night" : `Solar ${tier?.toLowerCase()}`;
  let threshold: string;
  if (peak) threshold = "Peak backoff (5–9pm) · AC eased to 84°";
  else if (tier && mT !== null && sT !== null && rT !== null)
    threshold = `${tierLabel} · master ${mT}° / sitting ${sT}° / rest ${rT}°`;
  else if (tier) threshold = tierLabel;
  else threshold = "Solar tier unavailable";

  // Only mention the dew floor when it is actually raising a setpoint above
  // the lowest matrix target (the floor never exceeds 84°).
  const lowestTarget =
    mT !== null && sT !== null && rT !== null ? Math.min(mT, sT, rT) : NaN;
  const floorNum = dewFloor ? parseFloat(dewFloor.state) : NaN;
  const floorNote =
    !peak && !isNaN(floorNum) && !isNaN(lowestTarget) && floorNum > lowestTarget
      ? ` · dew floor raises to ${Math.round(floorNum)}°`
      : "";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="wall-tile wall-tile--active p-6 col-span-2 row-span-2 flex flex-col justify-between"
    >
      <div className="flex items-start justify-between relative z-[1]">
        <div className="wall-icon-wrap p-3">
          <Home className="w-6 h-6" />
        </div>
        <div className="text-right">
          <div className="label text-sm">House mode</div>
          <div className="value text-2xl font-light">
            {mode ? mode.state : "—"}
          </div>
        </div>
      </div>
      <div className="relative z-[1]">
        <div className="flex items-end gap-6">
          <div>
            <div className="label text-[11px] uppercase">Solar</div>
            <div className="value text-2xl font-light tabular-nums">
              {fmtKw(solarKw)}
            </div>
          </div>
          <div>
            <div className="label text-[11px] uppercase">Draw</div>
            <div className="value text-2xl font-light tabular-nums">
              {fmtKw(drawKw)}
            </div>
          </div>
          <div>
            <div className="label text-[11px] uppercase">Battery</div>
            <div className="value text-2xl font-light tabular-nums">
              {isNaN(batt) ? "—" : `${Math.round(batt)}%`}
            </div>
          </div>
        </div>
        <div className="sub text-[11px] uppercase mt-2">
          {threshold}
          {floorNote}
        </div>
      </div>
    </motion.div>
  );
}

function isLightGroup(s: HAState) {
  // Group/helper entities expose entity_id as an array of member IDs
  return Array.isArray(s.attributes.entity_id);
}

function LightsCount({ states }: { states: HAState[] }) {
  const lights = findEntities(
    states,
    (s) =>
      domainOf(s.entity_id) === "light" &&
      !isLightGroup(s) &&
      !/_led$/i.test(s.entity_id), // exclude network device status LEDs (Ubiquiti, etc.)
  );
  const on = lights.filter((s) => {
    if (s.state !== "on") return false;
    const b = s.attributes.brightness as number | undefined;
    if (b !== undefined && b === 0) return false;
    return true;
  }).length;
  return (
    <StatTile
      icon={Lightbulb}
      label="Lights on"
      value={`${on}`}
      sub={`of ${lights.length}`}
      active={on > 0}
    />
  );
}

function ShadesCount({ states }: { states: HAState[] }) {
  const covers = findEntities(states, (s) => domainOf(s.entity_id) === "cover");
  const open = covers.filter(
    (s) => s.state === "open" || (parseFloat(String(s.attributes.current_position ?? "0")) > 0),
  ).length;
  return (
    <StatTile
      icon={Blinds}
      label="Shades open"
      value={`${open}`}
      sub={`of ${covers.length}`}
      active={open > 0}
    />
  );
}

function AtriumTemp({ states }: { states: HAState[] }) {
  const climateOverride = useResolvedSlot(states, "atriumClimate");
  const sensorOverride = useResolvedSlot(states, "atriumTemp");
  const climate =
    climateOverride ??
    findFirst(
      states,
      (s) => domainOf(s.entity_id) === "climate" && matchAtrium(s),
    );
  const sensor =
    sensorOverride ??
    findFirst(
      states,
      (s) =>
        domainOf(s.entity_id) === "sensor" &&
        matchAtrium(s) &&
        (deviceClass(s) === "temperature" ||
          /temp/i.test(s.entity_id) ||
          ["°F", "°C"].includes(
            (s.attributes.unit_of_measurement as string | undefined) ?? "",
          )),
    );
  let value = "—";
  let sub: string | undefined;
  if (climate) {
    const cur = climate.attributes.current_temperature as number | undefined;
    const target = climate.attributes.temperature as number | undefined;
    const u = (climate.attributes.temperature_unit as string | undefined) ?? "°";
    if (cur !== undefined) value = `${cur}${u}`;
    if (target !== undefined) sub = `target ${target}${u}`;
  } else if (sensor) {
    const u = (sensor.attributes.unit_of_measurement as string | undefined) ?? "°";
    value = `${sensor.state}${u}`;
  }
  return (
    <StatTile
      icon={Thermometer}
      label="Atrium"
      value={value}
      sub={sub}
      active={value !== "—"}
    />
  );
}

function SolarProduction({ states }: { states: HAState[] }) {
  const override = useResolvedSlot(states, "solar");
  const s =
    override ??
    findFirst(
      states,
      (e) =>
        domainOf(e.entity_id) === "sensor" &&
        /envoy.*production|solar.*power|current_power_production|pv_power/i.test(
          e.entity_id,
        ),
    );
  const num = s ? parseFloat(s.state) : NaN;
  const unit = (s?.attributes.unit_of_measurement as string | undefined) ?? "W";
  return (
    <StatTile
      icon={Sun}
      label="Solar production"
      value={isNaN(num) ? "—" : `${num.toLocaleString()} ${unit}`}
      sub={s ? "Envoy" : undefined}
      active={!isNaN(num) && num > 0}
    />
  );
}

function EnergyUsage({ states }: { states: HAState[] }) {
  const override = useResolvedSlot(states, "energyUse");
  const s =
    override ??
    findFirst(
      states,
      (e) =>
        domainOf(e.entity_id) === "sensor" &&
        /load|consumption|home.*power|grid.*power|current_power_consumption/i.test(
          e.entity_id,
        ),
    );
  const num = s ? parseFloat(s.state) : NaN;
  const unit = (s?.attributes.unit_of_measurement as string | undefined) ?? "W";
  return (
    <StatTile
      icon={Zap}
      label="Energy usage"
      value={isNaN(num) ? "—" : `${num.toLocaleString()} ${unit}`}
      sub={s ? friendly(s) : undefined}
      active={!isNaN(num) && num > 0}
    />
  );
}

const DEVICE_BATTERY_NAMES =
  /iphone|ipad|android|phone|mobile|watch|companion|laptop|macbook|pixel|galaxy|tablet/i;

function PowerwallStat({ states }: { states: HAState[] }) {
  const override = useResolvedSlot(states, "powerwall");

  // Aggregate sensor — the headline number
  const aggregateSensor =
    override ??
    findFirst(
      states,
      (e) =>
        domainOf(e.entity_id) === "sensor" &&
        /^sensor\.battery_percent$|total.*battery.*percent/i.test(e.entity_id) &&
        e.attributes.unit_of_measurement === "%",
    );

  // Individual system sensors — shown as sub-label detail
  const systemSensors = findEntities(
    states,
    (e) =>
      domainOf(e.entity_id) === "sensor" &&
      /(powerwall|tesla|4680|enphase|span|home_battery|gonser)/i.test(e.entity_id) &&
      /(percentage_charged|state_of_charge|charge_level|battery_percent|soc)/i.test(e.entity_id) &&
      (e.attributes.unit_of_measurement === "%" || deviceClass(e) === "battery"),
  );

  // Fallback: device_class=battery if neither found
  const fallback =
    !aggregateSensor && systemSensors.length === 0
      ? findFirst(
          states,
          (e) =>
            domainOf(e.entity_id) === "sensor" &&
            deviceClass(e) === "battery" &&
            !DEVICE_BATTERY_NAMES.test(e.entity_id) &&
            !DEVICE_BATTERY_NAMES.test(friendly(e)),
        )
      : undefined;

  const primary = aggregateSensor ?? systemSensors[0] ?? fallback;
  if (!primary) return null;

  const primaryNum = parseFloat(primary.state);
  const value = isNaN(primaryNum) ? primary.state : `${Math.round(primaryNum)}%`;

  // Sub: individual system readings labelled "Batt 1", "Batt 2", …
  const sortedSystems = [...systemSensors].sort((a, b) =>
    a.entity_id.localeCompare(b.entity_id),
  );
  const sub =
    sortedSystems.length >= 2
      ? sortedSystems
          .map((e, i) => {
            const n = parseFloat(e.state);
            return `Batt ${i + 1}: ${isNaN(n) ? "—" : Math.round(n) + "%"}`;
          })
          .join("  ·  ")
      : friendly(primary);

  return (
    <StatTile
      icon={BatteryCharging}
      label="Battery"
      value={value}
      sub={sub}
      active={!isNaN(primaryNum) && primaryNum > 20}
    />
  );
}


// Cameras outside = device_class motion binary sensors under camera domain names,
// or binary_sensor.* whose friendly name contains camera model keywords.
// Inside = binary_sensor.motion_* that are NOT camera-model sensors.
function isOutsideMotion(s: HAState): boolean {
  return (
    domainOf(s.entity_id) === "binary_sensor" &&
    deviceClass(s) === "motion" &&
    /\bG[56]\b|PTZ|Turret|Instant\b/i.test(friendly(s))
  );
}
function isInsideMotion(s: HAState): boolean {
  if (domainOf(s.entity_id) !== "binary_sensor") return false;
  const dc = deviceClass(s);
  const isMotion =
    dc === "motion" ||
    (/^binary_sensor\.motion_/.test(s.entity_id) &&
      !/_battery|_tamper|_contact|_moisture|_alarm/.test(s.entity_id));
  if (!isMotion) return false;
  return !/\bG[56]\b|PTZ|Turret|Instant\b/i.test(friendly(s));
}

function MotionRow({
  s,
  now,
  label,
  onOpen,
}: {
  s: HAState;
  now: number;
  label: string;
  onOpen?: (s: HAState) => void;
}) {
  const active = s.state === "on";
  const ago = formatAgo(new Date(s.last_changed).getTime());
  void now;
  const cls = `flex items-center justify-between py-1 ${active ? "opacity-100" : "opacity-50"}`;
  const inner = (
    <>
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-amber-400" : "bg-[var(--cream-muted)]"}`}
        />
        <span className="text-xs truncate">{label}</span>
        {onOpen && (
          <Pencil className="w-2.5 h-2.5 text-[var(--cream-muted)] opacity-40 shrink-0" />
        )}
      </div>
      <span className="text-[10px] text-[var(--cream-muted)] ml-2 shrink-0">{ago}</span>
    </>
  );
  // When an onOpen handler is provided, the row is tappable and opens the detail
  // sheet where the sensor can be renamed for this kiosk.
  if (onOpen) {
    return (
      <button
        type="button"
        onClick={() => onOpen(s)}
        aria-label={`Open ${label} to rename or view details`}
        className={`${cls} w-full text-left rounded-md px-1 -mx-1 transition-colors hover:bg-[rgba(232,193,120,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cream)]/50`}
      >
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function RecentMotionTile({
  states,
  onOpen,
}: {
  states: HAState[];
  onOpen?: (s: HAState) => void;
}) {
  const aliases = useEntityAliases((s) => s.aliases);
  const entityDevice = useRegistry((s) => s.entityDevice);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const inside = useMemo(
    () =>
      [...states.filter(isInsideMotion)].sort(
        (a, b) => new Date(b.last_changed).getTime() - new Date(a.last_changed).getTime(),
      ).slice(0, 6),
    [states],
  );
  const outside = useMemo(
    () =>
      [...states.filter(isOutsideMotion)].sort(
        (a, b) => new Date(b.last_changed).getTime() - new Date(a.last_changed).getTime(),
      ).slice(0, 6),
    [states],
  );

  // Camera renames live on the camera entity (in HA or as a kiosk alias);
  // mirror that onto its motion sensor so a rename in either place is enough.
  const labelFor = (s: HAState) =>
    aliases[s.entity_id] ??
    cameraSiblingName(s, states, entityDevice, aliases) ??
    motionSensorLabel(friendly(s));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="wall-tile col-span-2 row-span-2 p-4 flex flex-col"
    >
      <div className="flex items-center gap-2 mb-3 relative z-[1]">
        <div className="wall-icon-wrap p-1.5">
          <Activity className="w-4 h-4" />
        </div>
        <span className="text-xs uppercase tracking-[0.18em] text-[var(--cream-muted)]">Recent Motion</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 flex-1 relative z-[1]">
        <div>
          <div className="text-[9px] uppercase tracking-widest text-[var(--brass)] mb-1">Inside</div>
          {inside.length === 0
            ? <div className="text-xs text-[var(--cream-muted)] opacity-50">No sensors</div>
            : inside.map((s) => <MotionRow key={s.entity_id} s={s} now={now} label={labelFor(s)} onOpen={onOpen} />)
          }
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-widest text-[var(--brass)] mb-1">Outside</div>
          {outside.length === 0
            ? <div className="text-xs text-[var(--cream-muted)] opacity-50">No sensors</div>
            : outside.map((s) => <MotionRow key={s.entity_id} s={s} now={now} label={labelFor(s)} onOpen={onOpen} />)
          }
        </div>
      </div>
    </motion.div>
  );
}

function LastMotionCamera({ states }: { states: HAState[] }) {
  const cameraOverride = useResolvedSlot(states, "lastMotionCamera");
  const motionSensors = findEntities(
    states,
    (s) =>
      domainOf(s.entity_id) === "binary_sensor" && deviceClass(s) === "motion",
  );
  const sorted = [...motionSensors].sort(
    (a, b) =>
      new Date(b.last_changed).getTime() - new Date(a.last_changed).getTime(),
  );
  const last = sorted.find((s) => s.state === "on") ?? sorted[0];
  const cameras = findEntities(states, (s) => domainOf(s.entity_id) === "camera");
  let camera: HAState | undefined;
  if (cameraOverride) {
    camera = cameraOverride;
  } else if (last) {
    const baseName = friendly(last)
      .replace(/motion/i, "")
      .trim()
      .toLowerCase();
    camera =
      cameras.find((c) => friendly(c).toLowerCase().includes(baseName)) ??
      cameras.find((c) => c.entity_id.toLowerCase().includes(
        last.entity_id.split(".")[1].split("_")[0],
      )) ??
      cameras[0];
  } else {
    camera = cameras[0];
  }

  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!camera) return;
    let cancelled = false;
    const load = async () => {
      const r = await haCameraImage(camera!.entity_id);
      if (!cancelled && r.ok) setSrc(r.data);
    };
    load();
    const id = window.setInterval(load, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [camera?.entity_id]);

  const ago = last
    ? formatAgo(new Date(last.last_changed).getTime())
    : undefined;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="wall-camera col-span-3 row-span-3 min-h-[400px] relative"
    >
      {src ? (
        <img
          src={src}
          alt={camera ? friendly(camera) : ""}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm wall-status-text">
          {camera ? "Loading..." : "No camera available"}
        </div>
      )}
      <div className="wall-camera-caption absolute inset-x-0 bottom-0 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="wall-icon-wrap p-2.5">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider opacity-70">
              {last ? "Last motion" : "Camera"}
            </div>
            <div className="text-base font-medium">
              {last ? friendly(last).replace(/motion/i, "").trim() : camera ? friendly(camera) : "—"}
            </div>
          </div>
        </div>
        {ago && (
          <div className="flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4" /> {ago}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function formatAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function RemoteButton({
  onClick,
  children,
  className = "",
  label,
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`wall-remote-btn flex flex-col items-center justify-center gap-1 ${className}`}
      title={label}
    >
      {children}
      {label && <span className="text-[10px] uppercase opacity-70">{label}</span>}
    </button>
  );
}

function AtriumTvRemote({ states }: { states: HAState[] }) {
  const tvOverride = useResolvedSlot(states, "tvMediaPlayer");
  const remoteOverride = useResolvedSlot(states, "tvRemote");
  const tv =
    tvOverride ??
    findFirst(
      states,
      (s) =>
        domainOf(s.entity_id) === "media_player" &&
        matchAtrium(s) &&
        matchTv(s),
    ) ??
    findFirst(
      states,
      (s) => domainOf(s.entity_id) === "media_player" && matchTv(s),
    );

  const remote =
    remoteOverride ??
    findFirst(
      states,
      (s) => domainOf(s.entity_id) === "remote" && matchAtrium(s),
    ) ??
    findFirst(states, (s) => domainOf(s.entity_id) === "remote");

  const [pending, setPending] = useState<string | null>(null);

  const send = async (action: string, fn: () => Promise<unknown>) => {
    setPending(action);
    try {
      await fn();
    } finally {
      setTimeout(() => setPending((p) => (p === action ? null : p)), 250);
    }
  };

  const tvId = tv?.entity_id;
  const remoteId = remote?.entity_id;

  const dpad = async (cmd: string) => {
    if (remoteId) {
      await send(`d-${cmd}`, () =>
        haCallService("remote", "send_command", {
          entity_id: remoteId,
          command: cmd,
        }),
      );
      return;
    }
    if (tvId) {
      await send(`d-${cmd}`, () =>
        haCallService("androidtv", "adb_command", {
          entity_id: tvId,
          command: cmd.toUpperCase(),
        }),
      );
    }
  };

  const power = () =>
    tvId &&
    send("power", () =>
      haCallService("media_player", "toggle", { entity_id: tvId }),
    );
  const playPause = () =>
    tvId &&
    send("play", () =>
      haCallService("media_player", "media_play_pause", { entity_id: tvId }),
    );
  const volUp = () =>
    tvId &&
    send("volup", () =>
      haCallService("media_player", "volume_up", { entity_id: tvId }),
    );
  const volDown = () =>
    tvId &&
    send("voldown", () =>
      haCallService("media_player", "volume_down", { entity_id: tvId }),
    );
  const mute = () =>
    tvId &&
    send("mute", () =>
      haCallService("media_player", "volume_mute", {
        entity_id: tvId,
        is_volume_muted: !(tv?.attributes.is_volume_muted as boolean | undefined),
      }),
    );
  const source = (name: string) =>
    tvId &&
    send(`src-${name}`, () =>
      haCallService("media_player", "select_source", {
        entity_id: tvId,
        source: name,
      }),
    );

  const isOn = tv && tv.state !== "off" && tv.state !== "unavailable" && tv.state !== "standby";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="wall-remote col-span-3 row-span-3 p-6 flex flex-col"
    >
      <div className="flex items-center justify-between mb-5 relative z-[1]">
        <div className="flex items-center gap-3">
          <div className="wall-icon-wrap p-2.5">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider opacity-70">
              Atrium TV
            </div>
            <div className="text-base font-medium">
              {tv ? (isOn ? (tv.attributes.media_title as string | undefined) ?? "On" : "Off") : "Not found"}
            </div>
          </div>
        </div>
        <RemoteButton onClick={power} label="Power" className="w-14 h-14">
          <Power className="w-5 h-5" />
        </RemoteButton>
      </div>

      <div className="flex-1 flex items-center justify-center relative z-[1]">
        <div className="wall-remote-dpad relative w-56 h-56">
          <RemoteButton
            onClick={() => dpad("up")}
            className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-16"
          >
            <ChevronUp className="w-6 h-6" />
          </RemoteButton>
          <RemoteButton
            onClick={() => dpad("down")}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-16"
          >
            <ChevronDown className="w-6 h-6" />
          </RemoteButton>
          <RemoteButton
            onClick={() => dpad("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-16 h-16"
          >
            <ChevronLeft className="w-6 h-6" />
          </RemoteButton>
          <RemoteButton
            onClick={() => dpad("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-16 h-16"
          >
            <ChevronRight className="w-6 h-6" />
          </RemoteButton>
          <RemoteButton
            onClick={() => dpad("select")}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 wall-remote-btn--center"
          >
            <Circle className="w-3 h-3 fill-current" />
          </RemoteButton>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mt-4 relative z-[1]">
        <RemoteButton onClick={() => dpad("menu")} label="Back" className="h-14">
          <CornerUpLeft className="w-4 h-4" />
        </RemoteButton>
        <RemoteButton onClick={() => source("Apple TV")} label="Apple TV" className="h-14">
          <Apple className="w-4 h-4" />
        </RemoteButton>
        <RemoteButton onClick={() => source("Netflix")} label="Netflix" className="h-14">
          <span className="text-base font-bold">N</span>
        </RemoteButton>
        <RemoteButton onClick={playPause} label="Play" className="h-14">
          <Play className="w-4 h-4" />
        </RemoteButton>
        <RemoteButton onClick={volDown} label="Vol −" className="h-14">
          <Volume1 className="w-4 h-4" />
        </RemoteButton>
        <RemoteButton onClick={mute} label="Mute" className="h-14">
          <VolumeX className="w-4 h-4" />
        </RemoteButton>
        <RemoteButton onClick={volUp} label="Vol +" className="h-14">
          <Volume2 className="w-4 h-4" />
        </RemoteButton>
        <RemoteButton onClick={() => dpad("home")} label="Home" className="h-14">
          <span className="text-xs">⌂</span>
        </RemoteButton>
      </div>

      {pending && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] uppercase opacity-50">
          {pending}
        </div>
      )}
    </motion.div>
  );
}

export function SuperView({
  states,
  onOpen,
}: {
  states: HAState[];
  onOpen?: (s: HAState) => void;
}) {
  const stats = useMemo(
    () => ({
      lights: states.filter((s) => domainOf(s.entity_id) === "light"),
    }),
    [states],
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setSettingsOpen(true)}
          className="wall-remote-btn flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wider"
          title="Choose entities for each Super View tile"
        >
          <Settings className="w-3.5 h-3.5" />
          Pick entities
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 auto-rows-[160px] gap-4">
        <HouseStatusTile states={states} />
        <WeatherTile states={states} />
        <LightsCount states={states} />
        <ShadesCount states={states} />
        <AtriumTemp states={states} />
        <SolarProduction states={states} />
        <EnergyUsage states={states} />
        {stats.lights.length === 0 ? null : <PowerwallStat states={states} />}
        <RecentMotionTile states={states} onOpen={onOpen} />
        <LastMotionCamera states={states} />
      </div>
      <SuperViewSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        states={states}
      />
    </div>
  );
}
