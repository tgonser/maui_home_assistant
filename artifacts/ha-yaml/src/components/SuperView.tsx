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
} from "lucide-react";
import {
  haCallService,
  haCameraImage,
  haHistory,
  haForecast,
  type HAState,
} from "@/lib/ha";
import {
  SuperViewSettings,
  useSuperViewOverrides,
  type SuperViewSlot,
} from "./SuperViewSettings";

function useResolvedSlot(
  states: HAState[],
  slot: SuperViewSlot,
): HAState | undefined {
  const overrideId = useSuperViewOverrides((s) => s.overrides[slot]);
  if (!overrideId) return undefined;
  return states.find((s) => s.entity_id === overrideId);
}

const friendly = (s: HAState) =>
  (s.attributes.friendly_name as string | undefined) ?? s.entity_id;
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
    override ?? findFirst(states, (s) => domainOf(s.entity_id) === "weather");
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
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 relative z-[1]">
        <div>
          <div className="label text-xs">Humidity</div>
          <div className="text-xl tabular-nums">
            {hum !== undefined ? `${hum}%` : "—"}
          </div>
        </div>
        <div>
          <div className="label text-xs">Wind</div>
          <div className="text-xl tabular-nums">
            {wind !== undefined ? `${Math.round(wind)} ${wu}` : "—"}
          </div>
        </div>
      </div>
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

function LightsCount({ states }: { states: HAState[] }) {
  const lights = findEntities(states, (s) => domainOf(s.entity_id) === "light");
  const on = lights.filter((s) => s.state === "on").length;
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
      sub={s ? friendly(s) : undefined}
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

function PowerwallStat({ states }: { states: HAState[] }) {
  const override = useResolvedSlot(states, "powerwall");
  const s =
    override ??
    findFirst(
      states,
      (e) =>
        domainOf(e.entity_id) === "sensor" &&
        /(powerwall|tesla).*battery|battery.*level|charge/i.test(e.entity_id) &&
        !/(iphone|ipad|android|phone|mobile|watch|companion)/i.test(e.entity_id) &&
        (e.attributes.unit_of_measurement === "%" ||
          deviceClass(e) === "battery"),
    );
  if (!s) return null;
  const num = parseFloat(s.state);
  return (
    <StatTile
      icon={BatteryCharging}
      label="Powerwall"
      value={isNaN(num) ? s.state : `${Math.round(num)}%`}
      sub={friendly(s)}
      active={!isNaN(num) && num > 20}
    />
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

export function SuperView({ states }: { states: HAState[] }) {
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
        <WeatherTile states={states} />
        <LightsCount states={states} />
        <ShadesCount states={states} />
        <AtriumTemp states={states} />
        <SolarProduction states={states} />
        <EnergyUsage states={states} />
        {stats.lights.length === 0 ? null : <PowerwallStat states={states} />}
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
