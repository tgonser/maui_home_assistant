import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useHAStore, haStates, haCameraImage, type HAState } from "@/lib/ha";
import { useEntityAliases } from "@/lib/entityAliases";
import {
  Lightbulb,
  Thermometer,
  Lock,
  ShieldCheck,
  Speaker,
  Camera,
  BatteryCharging,
  Activity,
  Sun,
  Plug,
  Power,
  Wifi,
  WifiOff,
  Maximize,
  Minimize,
  AlertTriangle,
  ArrowLeft,
  Blinds,
  Wind,
  Sparkles,
  Play,
} from "lucide-react";
import "./wall-theme.css";
import { SuperView } from "./SuperView";
import { WallControls } from "./WallControls";
import { RoomsView } from "./RoomsView";
import { GroupedByRoomView } from "./GroupedByRoomView";
import { Home as HomeIcon } from "lucide-react";

type CategoryKey =
  | "overview"
  | "rooms"
  | "lights"
  | "switches"
  | "climate"
  | "covers"
  | "fans"
  | "locks"
  | "security"
  | "media"
  | "cameras"
  | "scenes"
  | "energy"
  | "sensors";

type Category = {
  key: CategoryKey;
  label: string;
  icon: typeof Lightbulb;
  match: (s: HAState) => boolean;
};

const friendly = (s: HAState) =>
  (s.attributes.friendly_name as string | undefined) ?? s.entity_id;
const unit = (s: HAState) =>
  (s.attributes.unit_of_measurement as string | undefined) ?? "";
const domainOf = (id: string) => id.split(".")[0] ?? "";

// Many camera/network devices expose a status LED as a light.* entity
// (Ubiquiti UniFi Protect U6/U7/G4, etc.). These shouldn't appear in the
// Lighting section since the user doesn't think of them as room lights.
const CAMERA_LIGHT_PATTERNS = [
  /\bubiquiti\b/,
  /\bunifi\b/,
  /\bu6\b/,
  /\bu7\b/,
  /\bg4\b/,
  /\bg5\b/,
  /\bcamera\b/,
  /\bdoorbell\b/,
  /status[\s_-]*(led|light)/,
  /ir[\s_-]*led/,
];
const isCameraLight = (s: HAState) => {
  const name = (
    (s.attributes.friendly_name as string | undefined) ?? ""
  ).toLowerCase();
  const id = s.entity_id.toLowerCase();
  return CAMERA_LIGHT_PATTERNS.some((re) => re.test(name) || re.test(id));
};

// Switches exposed by Unifi/Protect/etc. that are camera feature toggles
// (motion alarms, sound detection, status LEDs, recording modes), not real
// controllable power switches. Hide them from the Switches category.
const NON_SWITCH_PATTERNS: RegExp[] = [
  /\bunifi\b/,
  /\bprotect\b/,
  /\bubiquiti\b/,
  /\busl\b/,
  /\bu[67]\b/,
  /\bg[45]\b/,
  /\bcamera\b/,
  /\bdoorbell\b/,
  /motion[\s_-]*(alarm|detection|zone|sensitivity)/,
  /sound[\s_-]*detection/,
  /person[\s_-]*detection/,
  /vehicle[\s_-]*detection/,
  /package[\s_-]*detection/,
  /animal[\s_-]*detection/,
  /smart[\s_-]*detect/,
  /status[\s_-]*(led|light)/,
  /\bir[\s_-]*led\b/,
  /recording[\s_-]*(mode|enabled)/,
  /privacy[\s_-]*(mode|zone|mask)/,
  /hdr|osd|wdr|nightvision|night[\s_-]*mode/,
  /chime|chirp|siren/,
  // Tesla / EV / Powerwall feature toggles (not real power switches)
  /\ballow[\s_-]*charging\b/,
  /\bcharge[\s_-]*(on[\s_-]*solar|limit|enabled|schedule)/,
  /\bstorm[\s_-]*watch\b/,
  /\bsentry[\s_-]*mode\b/,
  /\bvalet[\s_-]*mode\b/,
  /\bclimate[\s_-]*(on|keeper|auto|enabled)\b/,
  /\bpreconditioning\b/,
  /\bseat[\s_-]*heater\b/,
  /\bsteering[\s_-]*wheel[\s_-]*heater\b/,
  /\bwindow[\s_-]*vent\b/,
  /\bcharge[\s_-]*port[\s_-]*(door|latch)\b/,
  /\bfrunk\b/,
  /\btrunk\b/,
  /\btesla\b/,
  /\bpowerwall\b/,
  /\bgrid[\s_-]*charging\b/,
  /\boff[\s_-]*grid[\s_-]*reserve\b/,
  // Irrigation / sprinkler controllers (Rachio, Rain Bird, Hunter,
  // OpenSprinkler, B-hyve, Orbit) — these expose zones, schedules, rain
  // delays etc. as switch.* entities but they aren't simple power switches.
  /\brachio\b/,
  /\brain[\s_-]*bird\b/,
  /\bopensprinkler\b/,
  /\bb[\s_-]*hyve\b/,
  /\borbit\b/,
  /\bhunter\b/,
  /\birrigation\b/,
  /\bsprinkler\b/,
  /\bschedule[\s_-]*(enabled|on)\b/,
  /\brain[\s_-]*delay\b/,
  /\bstandby\b/,
  /\bzone[\s_-]*\d+/,
  /\b(north|south|east|west|front|back|side)[\s_-]*(yard|lawn|garden|bed|beds)\b/,
  /\byard[\s_-]*(zone|valve|station)\b/,
];

// Scene / routine toggles that act on many devices at once
// (typically input_boolean.* or scene-style switches). Not real power
// switches but the user still needs to reach them, so they're routed to
// the Helpers & Groups bucket rather than hidden entirely.
export const SCENE_TOGGLE_PATTERNS: RegExp[] = [
  /\bhome[\s_-]*off\b/,
  /\ball[\s_-]*off\b/,
  /\bgood[\s_-]*night\b/,
  /\bgoodnight\b/,
  /\bbedtime\b/,
  /\bwake[\s_-]*up\b/,
  /\bmorning\b/,
  /\bevening\b/,
  /\baway[\s_-]*mode\b/,
  /\bvacation[\s_-]*mode\b/,
  /\bguest[\s_-]*mode\b/,
  /\bmovie[\s_-]*mode\b/,
  /\bparty[\s_-]*mode\b/,
  /\bdinner[\s_-]*mode\b/,
];
// Ubiquiti / Unifi cameras and doorbells often expose a media_player entity
// for their built-in speaker (chime, two-way audio). Hide them from the
// Media tab — they aren't user-facing music players.
const CAMERA_MEDIA_PATTERNS: RegExp[] = [
  /\bunifi\b/,
  /\bubiquiti\b/,
  /\bprotect\b/,
  /\busl\b/,
  /\bu[67]\b/,
  /\bg[45]\b/,
  /\bcamera\b/,
  /\bdoorbell\b/,
  /\bchime\b/,
];
const isCameraMedia = (s: HAState) => {
  const name = (
    (s.attributes.friendly_name as string | undefined) ?? ""
  ).toLowerCase();
  const id = s.entity_id.toLowerCase();
  return CAMERA_MEDIA_PATTERNS.some((re) => re.test(name) || re.test(id));
};

export const isSceneToggle = (s: HAState) => {
  const name = (
    (s.attributes.friendly_name as string | undefined) ?? ""
  ).toLowerCase();
  const id = s.entity_id.toLowerCase();
  return SCENE_TOGGLE_PATTERNS.some((re) => re.test(name) || re.test(id));
};
const isNonSwitch = (s: HAState) => {
  const name = (
    (s.attributes.friendly_name as string | undefined) ?? ""
  ).toLowerCase();
  const id = s.entity_id.toLowerCase();
  return NON_SWITCH_PATTERNS.some((re) => re.test(name) || re.test(id));
};
const deviceClass = (s: HAState) =>
  (s.attributes.device_class as string | undefined) ?? "";

const isEnergyEntity = (s: HAState) => {
  const id = s.entity_id.toLowerCase();
  const dc = deviceClass(s);
  if (
    dc === "power" ||
    dc === "energy" ||
    dc === "battery" ||
    dc === "voltage" ||
    dc === "current"
  )
    return true;
  return /(powerwall|tesla|envoy|enphase|solar|span|grid|inverter|battery)/.test(
    id,
  );
};

const CATEGORIES: Category[] = [
  { key: "overview", label: "Overview", icon: Activity, match: () => true },
  { key: "rooms", label: "Rooms", icon: HomeIcon, match: () => false },
  {
    key: "lights",
    label: "Lighting",
    icon: Lightbulb,
    match: (s) => domainOf(s.entity_id) === "light" && !isCameraLight(s),
  },
  {
    key: "switches",
    label: "Switches",
    icon: Power,
    match: (s) =>
      (domainOf(s.entity_id) === "switch" ||
        domainOf(s.entity_id) === "input_boolean") &&
      !isNonSwitch(s),
  },
  {
    key: "climate",
    label: "Climate",
    icon: Thermometer,
    match: (s) => domainOf(s.entity_id) === "climate",
  },
  {
    key: "covers",
    label: "Covers",
    icon: Blinds,
    match: (s) => domainOf(s.entity_id) === "cover",
  },
  {
    key: "fans",
    label: "Fans",
    icon: Wind,
    match: (s) => domainOf(s.entity_id) === "fan",
  },
  {
    key: "locks",
    label: "Locks",
    icon: Lock,
    match: (s) => domainOf(s.entity_id) === "lock",
  },
  {
    key: "security",
    label: "Security",
    icon: ShieldCheck,
    match: (s) =>
      domainOf(s.entity_id) === "alarm_control_panel" ||
      (domainOf(s.entity_id) === "binary_sensor" &&
        ["door", "window", "motion", "opening", "smoke", "gas", "tamper"].includes(
          deviceClass(s),
        )),
  },
  {
    key: "media",
    label: "Media",
    icon: Speaker,
    match: (s) => domainOf(s.entity_id) === "media_player" && !isCameraMedia(s),
  },
  {
    key: "cameras",
    label: "Cameras",
    icon: Camera,
    match: (s) => domainOf(s.entity_id) === "camera",
  },
  {
    key: "scenes",
    label: "Scenes",
    icon: Sparkles,
    match: (s) =>
      domainOf(s.entity_id) === "scene" ||
      domainOf(s.entity_id) === "script" ||
      domainOf(s.entity_id) === "automation",
  },
  {
    key: "energy",
    label: "Energy",
    icon: BatteryCharging,
    match: isEnergyEntity,
  },
  {
    key: "sensors",
    label: "Sensors",
    icon: Activity,
    match: (s) =>
      (domainOf(s.entity_id) === "sensor" && !isEnergyEntity(s)) ||
      (domainOf(s.entity_id) === "binary_sensor" &&
        !["door", "window", "motion", "opening", "smoke", "gas", "tamper"].includes(
          deviceClass(s),
        )),
  },
];

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000 * 30);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="text-right">
      <div className="clock-time text-5xl font-light tracking-tight tabular-nums">
        {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </div>
      <div className="clock-date text-sm mt-1">
        {now.toLocaleDateString([], {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </div>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  active,
  children,
  span,
}: {
  icon: typeof Lightbulb;
  label: string;
  value?: string;
  sub?: string;
  active?: boolean;
  children?: React.ReactNode;
  span?: "wide" | "tall" | "big";
}) {
  const colSpan =
    span === "wide" ? "col-span-2" : span === "big" ? "col-span-2 row-span-2" : "";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={`wall-tile ${active ? "wall-tile--active" : ""} p-3 min-h-[110px] flex flex-col justify-between ${colSpan}`}
    >
      <div className="flex items-start justify-between gap-2 relative z-[1]">
        <div className="wall-icon-wrap p-2 shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        {sub && (
          <div className="sub text-[10px] uppercase text-right max-w-[60%] truncate">
            {sub}
          </div>
        )}
      </div>
      <div className="relative z-[1]">
        <div className="label text-xs truncate leading-tight">{label}</div>
        {value !== undefined && (
          <div className="value text-xl font-semibold tabular-nums truncate mt-0.5">
            {value}
          </div>
        )}
        {children}
      </div>
    </motion.div>
  );
}

function LightTile({ s }: { s: HAState }) {
  const on = s.state === "on";
  const brightness = s.attributes.brightness as number | undefined;
  const pct = brightness ? Math.round((brightness / 255) * 100) : on ? 100 : 0;
  return (
    <Tile
      icon={Lightbulb}
      label={friendly(s)}
      value={on ? `${pct}%` : "Off"}
      active={on}
      sub={s.attributes.area as string | undefined}
    >
      {on && (
        <div className="wall-progress mt-2 h-1.5">
          <div style={{ width: `${pct}%` }} />
        </div>
      )}
    </Tile>
  );
}

function ClimateTile({ s }: { s: HAState }) {
  const cur = s.attributes.current_temperature as number | undefined;
  const target = s.attributes.temperature as number | undefined;
  const u = (s.attributes.temperature_unit as string | undefined) ?? "°";
  const mode = s.state;
  const active = mode !== "off" && mode !== "unavailable";
  return (
    <Tile
      icon={Thermometer}
      label={friendly(s)}
      value={cur !== undefined ? `${cur}${u}` : mode}
      sub={target !== undefined ? `target ${target}${u} · ${mode}` : mode}
      active={active}
    />
  );
}

function LockTile({ s }: { s: HAState }) {
  const locked = s.state === "locked";
  return (
    <Tile
      icon={Lock}
      label={friendly(s)}
      value={locked ? "Locked" : s.state === "unlocked" ? "Unlocked" : s.state}
      active={!locked && s.state !== "unavailable"}
      sub={locked ? "secure" : "open"}
    />
  );
}

function AlarmTile({ s }: { s: HAState }) {
  const armed = s.state.startsWith("armed");
  const triggered = s.state === "triggered";
  return (
    <Tile
      icon={triggered ? AlertTriangle : ShieldCheck}
      label={friendly(s)}
      value={s.state.replace(/_/g, " ")}
      active={armed || triggered}
    />
  );
}

function BinarySensorTile({ s }: { s: HAState }) {
  const dc = deviceClass(s);
  const on = s.state === "on";
  const labelMap: Record<string, [string, string]> = {
    door: ["Open", "Closed"],
    window: ["Open", "Closed"],
    opening: ["Open", "Closed"],
    motion: ["Motion", "Clear"],
    smoke: ["Smoke!", "Clear"],
    gas: ["Gas!", "Clear"],
    tamper: ["Tamper", "OK"],
  };
  const [onLbl, offLbl] = labelMap[dc] ?? ["On", "Off"];
  const Icon =
    dc === "motion"
      ? Activity
      : dc === "smoke" || dc === "gas"
        ? AlertTriangle
        : ShieldCheck;
  return (
    <Tile
      icon={Icon}
      label={friendly(s)}
      value={on ? onLbl : offLbl}
      active={on}
      sub={dc || undefined}
    />
  );
}

function MediaTile({ s }: { s: HAState }) {
  const playing = s.state === "playing";
  const title = s.attributes.media_title as string | undefined;
  const artist = s.attributes.media_artist as string | undefined;
  return (
    <Tile
      icon={Speaker}
      label={friendly(s)}
      value={playing ? (title ?? "Playing") : s.state}
      sub={playing ? artist : undefined}
      active={playing}
      span="wide"
    />
  );
}

function CameraTile({ s }: { s: HAState }) {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const r = await haCameraImage(s.entity_id);
      if (cancelled) return;
      if (r.ok) {
        setSrc(r.data);
        setErr(null);
      } else {
        setErr(r.error);
      }
    };
    load();
    const id = window.setInterval(load, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [s.entity_id]);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="wall-camera col-span-2 row-span-2 min-h-[376px]"
    >
      {src ? (
        <img
          src={src}
          alt={friendly(s)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm wall-status-text">
          {err ?? "Loading..."}
        </div>
      )}
      <div className="wall-camera-caption absolute inset-x-0 bottom-0 p-3 flex items-center gap-2">
        <Camera className="w-4 h-4" />
        <span className="text-sm font-medium truncate">{friendly(s)}</span>
      </div>
    </motion.div>
  );
}

function EnergyTile({ s }: { s: HAState }) {
  const dc = deviceClass(s);
  const num = parseFloat(s.state);
  const u = unit(s);
  const isBattery = dc === "battery" || /battery/i.test(s.entity_id);
  const isPower = dc === "power" || /power|inverter/i.test(s.entity_id);
  const isProduction = /solar|production|envoy/i.test(s.entity_id);
  const Icon = isProduction ? Sun : isBattery ? BatteryCharging : Plug;
  const active = !isNaN(num) && num !== 0;
  return (
    <Tile
      icon={Icon}
      label={friendly(s)}
      value={isNaN(num) ? s.state : `${num.toLocaleString()} ${u}`}
      sub={dc || (isPower ? "power" : undefined)}
      active={active}
    >
      {isBattery && !isNaN(num) && (
        <div className="wall-progress mt-2 h-1.5">
          <div style={{ width: `${Math.max(0, Math.min(100, num))}%` }} />
        </div>
      )}
    </Tile>
  );
}

function SensorTile({ s }: { s: HAState }) {
  const num = parseFloat(s.state);
  const u = unit(s);
  return (
    <Tile
      icon={Activity}
      label={friendly(s)}
      value={isNaN(num) ? s.state : `${num.toLocaleString()} ${u}`}
      sub={deviceClass(s) || undefined}
    />
  );
}

function renderTile(s: HAState) {
  const d = domainOf(s.entity_id);
  if (d === "light") return <LightTile key={s.entity_id} s={s} />;
  if (d === "climate") return <ClimateTile key={s.entity_id} s={s} />;
  if (d === "lock") return <LockTile key={s.entity_id} s={s} />;
  if (d === "alarm_control_panel") return <AlarmTile key={s.entity_id} s={s} />;
  if (d === "media_player") return <MediaTile key={s.entity_id} s={s} />;
  if (d === "camera") return <CameraTile key={s.entity_id} s={s} />;
  if (d === "binary_sensor") return <BinarySensorTile key={s.entity_id} s={s} />;
  if (isEnergyEntity(s)) return <EnergyTile key={s.entity_id} s={s} />;
  return <SensorTile key={s.entity_id} s={s} />;
}

function MonsteraLeaf() {
  return (
    <svg
      className="wall-leaf"
      viewBox="0 0 200 200"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M100 10c-30 0-55 25-55 55 0 8 2 16 5 23-10 0-20 5-25 15-5 12 0 25 12 30 5 2 11 2 16 0-3 8-2 18 5 25 10 10 25 10 35 0 3-3 5-7 6-11 4 8 12 13 22 13 14 0 25-11 25-25 0-5-2-10-4-14 7-2 14-7 18-15 7-14 1-30-13-35-3-1-6-2-9-2 4-9 6-19 6-29 0-30-25-55-44-55zm0 20c12 0 25 8 30 24-8-2-17-2-25 1-3-9-3-17-5-25zm-15 30c8 4 18 6 28 5-2 8-7 16-15 21-5-9-9-18-13-26zm35 5c8 0 16 4 22 10-7 5-15 8-23 8-2-6-1-12 1-18zm-55 15c5 5 10 10 17 13-5 6-11 10-18 12-2-9 0-18 1-25zm75 20c4 6 5 14 2 21-7-2-14-7-18-13 6-2 11-5 16-8zm-35 10c5 5 12 9 19 10-3 7-8 13-15 16-2-9-3-18-4-26zm-30 5c8 1 16 0 23-3 1 9 0 17-3 25-9-4-15-13-20-22z" />
    </svg>
  );
}

export function Wall() {
  const { url, token, status, config } = useHAStore();
  const [states, setStates] = useState<HAState[]>([]);
  const [active, setActive] = useState<CategoryKey>("overview");
  const [error, setError] = useState<string | null>(null);
  const [isFs, setIsFs] = useState(false);
  const [openEntity, setOpenEntity] = useState<HAState | null>(null);
  const entityAliases = useEntityAliases((s) => s.aliases);
  const loadEntityAliases = useEntityAliases((s) => s.load);
  useEffect(() => {
    loadEntityAliases();
  }, [loadEntityAliases]);

  const applyAlias = (s: HAState): HAState => {
    const alias = entityAliases[s.entity_id];
    if (!alias) return s;
    return {
      ...s,
      attributes: { ...s.attributes, friendly_name: alias },
    };
  };

  const openId = openEntity?.entity_id;
  // Keep the open sheet's entity in sync with refreshed states
  useEffect(() => {
    if (!openId) return;
    const latest = states.find((s) => s.entity_id === openId);
    if (latest && latest !== openEntity) setOpenEntity(latest);
  }, [states, openId, openEntity]);

  const clickableTile = (s: HAState) => {
    const aliased = applyAlias(s);
    return (
      <button
        type="button"
        key={s.entity_id}
        onClick={() => setOpenEntity(s)}
        aria-label={`Open ${(aliased.attributes.friendly_name as string) ?? s.entity_id}`}
        className="text-left rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cream)]/60"
      >
        {renderTile(aliased)}
      </button>
    );
  };

  useEffect(() => {
    if (!url || !token) return;
    let cancelled = false;
    const load = async () => {
      const r = await haStates();
      if (cancelled) return;
      if (r.ok) {
        setStates(r.data);
        setError(null);
      } else {
        setError(r.error);
      }
    };
    load();
    const id = window.setInterval(load, 6000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [url, token]);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const counts = useMemo(() => {
    const map = new Map<CategoryKey, number>();
    for (const c of CATEGORIES) {
      if (c.key === "overview" || c.key === "rooms") continue;
      map.set(c.key, states.filter(c.match).length);
    }
    return map;
  }, [states]);

  const refresh = async () => {
    const r = await haStates();
    if (r.ok) setStates(r.data);
  };

  const filtered = useMemo(() => {
    if (active === "overview") {
      const featured: HAState[] = [];
      const seen = new Set<string>();
      for (const c of CATEGORIES) {
        if (c.key === "overview") continue;
        const matched = states.filter(c.match);
        const interesting = matched
          .filter((s) => {
            if (s.state === "unavailable" || s.state === "unknown") return false;
            const d = domainOf(s.entity_id);
            if (d === "light") return s.state === "on";
            if (d === "climate") return s.state !== "off";
            if (d === "media_player") return s.state === "playing";
            if (d === "lock" || d === "alarm_control_panel") return true;
            if (d === "camera") return true;
            if (d === "binary_sensor") return s.state === "on";
            if (isEnergyEntity(s)) return !isNaN(parseFloat(s.state));
            return false;
          })
          .slice(0, c.key === "cameras" ? 2 : c.key === "energy" ? 6 : 4);
        for (const s of interesting) {
          if (!seen.has(s.entity_id)) {
            seen.add(s.entity_id);
            featured.push(s);
          }
        }
      }
      return featured;
    }
    const cat = CATEGORIES.find((c) => c.key === active);
    if (!cat) return [];
    return states
      .filter(cat.match)
      .filter((s) => s.state !== "unavailable")
      .sort((a, b) => friendly(a).localeCompare(friendly(b)));
  }, [states, active]);

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  const goBack = () => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.location.href = `${base}/`;
  };

  if (!url || !token) {
    return (
      <div className="wall-root h-screen w-full flex items-center justify-center p-8">
        <MonsteraLeaf />
        <div className="max-w-md text-center space-y-5 relative z-[1]">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center wall-icon-wrap">
            <WifiOff className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-light tracking-wide">Wall is offline</h2>
          <p className="text-sm wall-status-text">
            Connect to your Home Assistant from the studio first, then come back
            here for the tablet view.
          </p>
          <button
            onClick={goBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm wall-tile wall-tile--active"
            style={{ minHeight: 0 }}
          >
            <ArrowLeft className="w-4 h-4" /> Back to Studio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wall-root h-screen w-full flex overflow-hidden">
      <MonsteraLeaf />
      <aside className="wall-aside w-32 shrink-0 flex flex-col items-center py-6 gap-2">
        <button
          onClick={goBack}
          className="wall-nav-btn w-16 h-16 flex items-center justify-center mb-2"
          title="Back to Studio"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {CATEGORIES.map((c) => {
          const count = counts.get(c.key) ?? 0;
          const isActive = active === c.key;
          const dim =
            c.key !== "overview" && c.key !== "rooms" && count === 0;
          const showBadge =
            c.key !== "overview" && c.key !== "rooms" && !dim && count > 0;
          return (
            <button
              key={c.key}
              onClick={() => setActive(c.key)}
              disabled={dim}
              className={`wall-nav-btn w-24 h-20 flex flex-col items-center justify-center gap-1 relative ${
                isActive ? "wall-nav-btn--active" : ""
              } ${dim ? "wall-nav-btn--dim" : ""}`}
              title={c.label}
            >
              <c.icon className="w-6 h-6" />
              <span className="text-[11px] tracking-tight font-medium">
                {c.label}
              </span>
              {showBadge && (
                <span className="badge absolute top-1.5 right-2 text-[10px] tabular-nums">
                  {count}
                </span>
              )}
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={toggleFs}
          className="wall-nav-btn w-16 h-16 flex items-center justify-center"
          title={isFs ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFs ? (
            <Minimize className="w-5 h-5" />
          ) : (
            <Maximize className="w-5 h-5" />
          )}
        </button>
      </aside>

      <main className="wall-main flex-1 overflow-y-auto">
        <header className="wall-header flex items-center justify-between px-10 py-7 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="relative flex h-3 w-3">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  status === "connected" ? "bg-emerald-400" : "bg-red-400"
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${
                  status === "connected" ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
            </div>
            <div>
              <div className="text-3xl font-light tracking-wide">
                {config?.location_name ?? "Home"}
              </div>
              <div className="meta text-sm flex items-center gap-2 mt-0.5">
                <Wifi className="w-3.5 h-3.5" />
                {status === "connected"
                  ? "Live"
                  : status === "error"
                    ? (error ?? "Connection error")
                    : status}
                {" · "}
                {states.length} entities
              </div>
            </div>
          </div>
          <Clock />
        </header>

        <div className="px-10 py-8 relative z-[1]">
          <div className="flex items-end justify-between mb-6">
            <h2 className="wall-section-title text-3xl">
              {CATEGORIES.find((c) => c.key === active)?.label}
            </h2>
            <span className="wall-section-meta text-sm">
              {active === "overview"
                ? `${filtered.length} active`
                : active === "rooms"
                  ? ""
                  : `${filtered.length} items`}
            </span>
          </div>

          <AnimatePresence mode="popLayout">
            {active === "overview" ? (
              <SuperView key="super" states={states} />
            ) : active === "rooms" ? (
              <RoomsView key="rooms" states={states} refresh={refresh} />
            ) : active === "lights" ||
              active === "switches" ||
              active === "covers" ||
              active === "fans" ? (
              <GroupedByRoomView
                key={`${active}-grouped`}
                entities={filtered}
                renderTile={clickableTile}
              />
            ) : filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="wall-empty text-center py-20"
              >
                <Plug className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-base">Nothing to show here yet.</p>
              </motion.div>
            ) : (
              <motion.div
                key={active}
                layout
                className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 auto-rows-[110px] gap-3"
              >
                {filtered.map(clickableTile)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <WallControls
        entity={openEntity}
        onClose={() => setOpenEntity(null)}
        onChanged={refresh}
      />
    </div>
  );
}
