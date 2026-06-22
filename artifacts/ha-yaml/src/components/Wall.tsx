import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useHAStore, haStates, haCameraImage, haCallService, haHistory, type HAState } from "@/lib/ha";
import {
  isMediaActive,
  displayMediaState,
  effectiveMedia,
} from "@/lib/mediaState";
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
  Tv,
  Users,
  Pause,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import "./wall-theme.css";
import { SuperView } from "./SuperView";
import { WallControls } from "./WallControls";
import { RoomsView } from "./RoomsView";
import { GroupedByRoomView } from "./GroupedByRoomView";
import { ClimateSettings } from "./ClimateSettings";
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
  | "tvs"
  | "cameras"
  | "scenes"
  | "energy"
  | "sensors"
  | "settings";

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

// TVs vs music players. Detected by device_class === "tv" or naming
// patterns covering common smart TVs and streaming sticks. Used to split
// the Media tab into Music (Bluesound, Sonos, etc.) and TVs.
const TV_PATTERNS: RegExp[] = [
  /\btv\b/,
  /\btelevision\b/,
  /\bbravia\b/,
  /\bsamsung\b/,
  /\bsony\b/,
  /\blg\b/,
  /\bvizio\b/,
  /\bhisense\b/,
  /\btcl\b/,
  /\bpanasonic\b/,
  /\bphilips\b/,
  /\broku\b/,
  /\bapple[\s_-]*tv\b/,
  /\bfire[\s_-]*tv\b/,
  /\bandroid[\s_-]*tv\b/,
  /\bgoogle[\s_-]*tv\b/,
  /\bchromecast\b/,
  /\bnvidia[\s_-]*shield\b/,
  /\bshield\b/,
  /\bwebos\b/,
  /\bprojector\b/,
];
const isTvMedia = (s: HAState) => {
  if (deviceClass(s) === "tv") return true;
  const name = (
    (s.attributes.friendly_name as string | undefined) ?? ""
  ).toLowerCase();
  const id = s.entity_id.toLowerCase();
  return TV_PATTERNS.some((re) => re.test(name) || re.test(id));
};

// Non-Bluesound music brands that should NOT be treated as music zones, even
// if their name happens to contain a zone token (e.g. "JBL Bar 1300" matches
// the "Bar" zone). These are TV-audio devices reachable as a *source* via
// the Great Room TV hub, not music destinations.
const NON_MUSIC_BRAND_PATTERNS: RegExp[] = [/\bjbl\b/];
const isNonMusicBrand = (s: HAState) => {
  const name = (
    (s.attributes.friendly_name as string | undefined) ?? ""
  ).toLowerCase();
  const id = s.entity_id.toLowerCase();
  return NON_MUSIC_BRAND_PATTERNS.some((re) => re.test(name) || re.test(id));
};

// HA exposes a few things as media_player that aren't real audio
// destinations on this kiosk — security-camera two-way audio, humidifier
// notifications, outdoor pool speakers wired to landscape audio, etc. Hide
// them from both the Music and TVs tabs entirely.
const HIDDEN_MEDIA_PATTERNS: RegExp[] = [
  /\bptz\b/,
  /\binstant\b/,
  /\bmud[\s_-]*room\b/,
  /\bsouth[\s_-]*pool\b/,
];
const isHiddenMedia = (s: HAState) => {
  const name = (
    (s.attributes.friendly_name as string | undefined) ?? ""
  ).toLowerCase();
  const id = s.entity_id.toLowerCase();
  return HIDDEN_MEDIA_PATTERNS.some((re) => re.test(name) || re.test(id));
};

// Canonical Bluesound music zones in this home. Order shown on the kiosk.
// Note: "Great Room TV" is a Bluesound hub that pipes TV audio out to other
// speakers — it's a source, not a destination zone, so it's not listed here.
export const MUSIC_ZONES: string[] = [
  "Great Room",
  "Bar",
  "Great Room Lanai",
  "BBQ",
  "Master Bed",
  "Master Sitting",
  "Master Bath",
  "Master Bath Lanai",
  "Master Lanai",
];

// Normalize for fuzzy matching: lowercase, strip common Bluesound product
// words, then collapse to space-separated alphanumeric tokens.
const normForZone = (s: string) =>
  s
    .toLowerCase()
    .replace(
      /\b(bluesound|pulse|node|powernode|player|speaker|amp|flex|mini|sub|2i|soundbar)\b/g,
      "",
    )
    .replace(/[^a-z0-9]+/g, " ")
    // Common HA/Bluesound naming variants — fold to the canonical token used
    // in MUSIC_ZONES so "Master Bedroom" matches "Master Bed" etc.
    .replace(/\bbedroom\b/g, "bed")
    .replace(/\bbathroom\b/g, "bath")
    .replace(/\bbarbecue\b/g, "bbq")
    .replace(/\bbar b q\b/g, "bbq")
    .replace(/\blounge\b/g, "sitting")
    .replace(/\bporch\b/g, "lanai")
    .replace(/\bpatio\b/g, "lanai")
    .replace(/\bdeck\b/g, "lanai")
    .replace(/\s+/g, " ")
    .trim();

// Returns the best-matching music zone label for an entity, or null. The
// entity matches a zone when every word in the (normalized) zone label is
// present in the (normalized) entity name. When several zones match (e.g.
// "Great Room" and "Great Room TV"), the more specific (longer) zone wins.
export function matchMusicZone(s: HAState): string | null {
  if (domainOf(s.entity_id) !== "media_player") return null;
  // Non-Bluesound brands (e.g. JBL soundbar) can't host a music zone even if
  // their name happens to include a zone token like "bar".
  if (isNonMusicBrand(s)) return null;
  const name = normForZone(
    (s.attributes.friendly_name as string | undefined) ?? s.entity_id,
  );
  const nameTokens = new Set(name.split(/\s+/).filter(Boolean));
  let best: { zone: string; size: number } | null = null;
  for (const zone of MUSIC_ZONES) {
    const tokens = normForZone(zone).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    if (tokens.every((t) => nameTokens.has(t))) {
      if (!best || tokens.length > best.size) {
        best = { zone, size: tokens.length };
      }
    }
  }
  return best?.zone ?? null;
}

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

// The same Home Assistant instance manages multiple houses (Maui, Mercer
// Island = "MI", Bend). The Climate tab on the kiosk is for Maui only.
// Friendly-name prefixes proved unreliable: Honeywell TCC thermostats inherit
// their device name, so entity renames don't reliably propagate, and the
// MI/Bend entity_id slugs (e.g. climate.apartment, climate.thermostat) carry
// no house marker — so MI/Bend units leaked into the Maui tab. We therefore
// key the Maui set off stable entity_ids (the reliable backbone). As a
// convenience, anything whose friendly_name starts with the house convention
// "Maui" (e.g. "Maui-Atrium", "Maui_Molokini") is also included, so a
// correctly-named new Maui thermostat appears without a code edit. If a new
// unit's name might not propagate (Honeywell device-name trap), add its
// entity_id to the allowlist too.
const MAUI_CLIMATE_IDS = new Set<string>([
  "climate.atrium",
  "climate.bar",
  "climate.beach_room",
  "climate.boardroom",
  "climate.kitchen",
  "climate.master_bed_2",
  "climate.maui_bar",
  "climate.sitting",
  "climate.upper_mauka",
]);
const MAUI_NAME_RE = /^maui[\s\-_]/;
const isMauiClimate = (s: HAState) => {
  if (MAUI_CLIMATE_IDS.has(s.entity_id)) return true;
  const name = ((s.attributes.friendly_name as string | undefined) ?? "")
    .toLowerCase()
    .trim();
  return MAUI_NAME_RE.test(name);
};
const deviceClass = (s: HAState) =>
  (s.attributes.device_class as string | undefined) ?? "";

const ENERGY_LABELS: Record<string, string> = {
  "sensor.total_solar": "Solar Production",
  "sensor.total_home_load": "Home Load",
  "sensor.total_battery_power": "Battery Power",
  "sensor.solar_15min_avg": "Solar 15min Avg",
  "sensor.gonser_4680_system_1_percentage_charged": "Battery 1",
  "sensor.4680_system_2_percentage_charged": "Battery 2",
  "sensor.gonser_4680_system_1_grid_power": "Grid (Sys 1)",
  "sensor.4680_system_2_grid_imported": "Grid (Sys 2)",
  "sensor.gonser_4680_system_1_solar_power": "Solar (Sys 1)",
  "sensor.4680_system_2_solar_power": "Solar (Sys 2)",
  "sensor.4680_system_2_battery_power": "Battery Power (Sys 2)",
  "sensor.4680_system_2_load_power": "Load (Sys 2)",
  "sensor.gonser_4680_system_1_load_power": "Load (Sys 1)",
  "sensor.4680_system_2_solar_generated": "Solar Today (Sys 2)",
  "sensor.gonser_4680_system_1_solar_generated": "Solar Today (Sys 1)",
  "sensor.gonser_4680_system_1_grid_exported": "Grid Exported (Sys 1)",
  "sensor.gonser_4680_system_1_grid_imported": "Grid Imported (Sys 1)",
  "sensor.4680_system_2_grid_exported": "Grid Exported (Sys 2)",
  "sensor.4680_system_2_home_usage": "Home Usage Today (Sys 2)",
};

const isEnergyEntity = (s: HAState) => {
  const id = s.entity_id.toLowerCase();
  return (
    /^sensor\.total_(solar|home_load|battery)/.test(id) ||
    /sensor\.solar_15min_avg/.test(id) ||
    /4680.*percentage_charged|gonser.*percentage_charged/.test(id) ||
    /4680.*grid_power|gonser.*grid_power/.test(id) ||
    /4680.*grid_imported|gonser.*grid_imported/.test(id) ||
    /4680.*solar_power|gonser.*solar_power/.test(id) ||
    /4680.*battery_power|gonser.*battery_power/.test(id) ||
    /4680.*load_power|gonser.*load_power/.test(id) ||
    /4680.*solar_generated|gonser.*solar_generated/.test(id) ||
    /gonser.*grid_exported|4680.*grid_exported/.test(id) ||
    /4680.*home_usage|gonser.*home_usage/.test(id)
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
    match: (s) => domainOf(s.entity_id) === "climate" && isMauiClimate(s),
  },
  {
    key: "covers",
    label: "Shades",
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
        ["door", "window", "motion", "opening", "smoke", "gas"].includes(
          deviceClass(s),
        )),
  },
  {
    key: "media",
    label: "Music",
    icon: Speaker,
    match: (s) =>
      domainOf(s.entity_id) === "media_player" &&
      !isCameraMedia(s) &&
      !isHiddenMedia(s) &&
      !isNonMusicBrand(s) &&
      (matchMusicZone(s) !== null || !isTvMedia(s)),
  },
  {
    key: "tvs",
    label: "TVs",
    icon: Tv,
    match: (s) =>
      domainOf(s.entity_id) === "media_player" &&
      !isCameraMedia(s) &&
      !isHiddenMedia(s) &&
      (isTvMedia(s) || isNonMusicBrand(s)) &&
      matchMusicZone(s) === null,
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
  {
    key: "settings",
    label: "Settings",
    icon: SlidersHorizontal,
    match: () => false,
  },
];

// HST is UTC-10, no daylight saving ever
function toHST(date: Date): Date {
  return new Date(date.getTime() - 10 * 60 * 60 * 1000);
}
function formatHSTTime(date: Date): string {
  const d = toHST(date);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}
function formatHSTDate(date: Date): string {
  const d = toHST(date);
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${days[d.getUTCDay()]}, ${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000 * 30);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="text-right">
      <div className="clock-time text-5xl font-light tracking-tight tabular-nums">
        {formatHSTTime(now)}
      </div>
      <div className="clock-date text-sm mt-1">
        {formatHSTDate(now)} <span className="opacity-50">HST</span>
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
  const aboveTarget = cur !== undefined && target !== undefined && cur > target;
  const atOrBelowTarget = cur !== undefined && target !== undefined && cur <= target;
  const tempColor = aboveTarget
    ? "text-red-400"
    : atOrBelowTarget
      ? "text-emerald-400"
      : "";
  return (
    <Tile icon={Thermometer} label={friendly(s)} active={active}>
      {cur !== undefined && (
        <div className={`text-2xl font-semibold tabular-nums mt-0.5 ${tempColor}`}>
          {cur}{u}
        </div>
      )}
      {target !== undefined && (
        <div className="text-xs mt-1 text-[var(--cream-muted)]">
          target <span className="font-semibold text-[var(--cream)]">{target}{u}</span>
        </div>
      )}
    </Tile>
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

function MediaTile({
  s,
  allStates,
}: {
  s: HAState;
  allStates?: HAState[];
}) {
  const active = isMediaActive(s, allStates);
  // Pull effective metadata — for a Bluesound group slave this falls back to
  // the master's now-playing info so the slave shows what's actually coming
  // out of its speakers instead of being blank.
  const eff = effectiveMedia(s, allStates);
  const value =
    eff.title && eff.title.trim().length > 0
      ? eff.title
      : displayMediaState(s, allStates);
  const sub = active
    ? (eff.artist ?? eff.source ?? undefined)
    : undefined;
  return (
    <Tile
      icon={Speaker}
      label={friendly(s)}
      value={value}
      sub={sub}
      active={active}
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
      label={ENERGY_LABELS[s.entity_id] ?? friendly(s)}
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

type EnergyRow = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  pct?: number;
};

function useEntityHistory(entityId: string) {
  const [points, setPoints] = useState<{ t: number; v: number }[]>([]);
  useEffect(() => {
    if (!entityId) return;
    haHistory(entityId, 24).then((res) => {
      if (!res.ok) return;
      const series = res.data[0] ?? [];
      setPoints(
        series
          .map((p) => ({ t: new Date(p.last_changed).getTime(), v: parseFloat(p.state) }))
          .filter((p) => !isNaN(p.v)),
      );
    });
  }, [entityId]);
  return points;
}

function Sparkline({ entityId }: { entityId: string }) {
  const points = useEntityHistory(entityId);
  const gradId = `sg-${entityId.replace(/[^a-z0-9]/gi, "")}`;
  if (points.length < 2) return <div className="h-12 opacity-20 rounded bg-[var(--cream)]/10" />;
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--brass)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--brass)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke="var(--brass)"
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function EnergySystemCard({
  name,
  rows,
  chartEntityId,
}: {
  name: string;
  rows: EnergyRow[];
  chartEntityId?: string;
}) {
  return (
    <div className="wall-tile rounded-2xl p-4 flex flex-col gap-3">
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--cream-muted)]">
        {name}
      </div>
      {rows.map(({ icon: Icon, label, value, pct }) => (
        <div key={label} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[var(--cream-muted)]">
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs">{label}</span>
            </div>
            <span className="text-sm font-semibold tabular-nums text-[var(--cream)]">
              {value}
            </span>
          </div>
          {pct !== undefined && !isNaN(pct) && (
            <div className="wall-progress h-1.5">
              <div style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
            </div>
          )}
        </div>
      ))}
      {chartEntityId && (
        <div className="mt-1">
          <Sparkline entityId={chartEntityId} />
        </div>
      )}
    </div>
  );
}

function EnergyDashboard({ states }: { states: HAState[] }) {
  const get = (id: string) => states.find((s) => s.entity_id === id);
  const num = (id: string) => {
    const s = get(id);
    return s ? parseFloat(s.state) : NaN;
  };
  const fmt = (id: string, dec = 1) => {
    const s = get(id);
    if (!s) return "—";
    const n = parseFloat(s.state);
    if (isNaN(n)) return s.state;
    const u = (s.attributes.unit_of_measurement as string | undefined) ?? "";
    return `${n.toFixed(dec)} ${u}`.trim();
  };
  const fmtN = (n: number, u: string, dec = 1) =>
    isNaN(n) ? "—" : `${n.toFixed(dec)} ${u}`;

  const sys1Pct = num("sensor.gonser_4680_system_1_percentage_charged");
  const sys2Pct = num("sensor.4680_system_2_percentage_charged");
  const avgPct =
    !isNaN(sys1Pct) && !isNaN(sys2Pct)
      ? (sys1Pct + sys2Pct) / 2
      : isNaN(sys1Pct)
        ? sys2Pct
        : sys1Pct;

  const sys1Grid = num("sensor.gonser_4680_system_1_grid_power");
  const sys2Grid = num("sensor.4680_system_2_grid_power");
  const totalGridState = get("sensor.total_grid_power");
  const totalGrid = totalGridState
    ? parseFloat(totalGridState.state)
    : !isNaN(sys1Grid) && !isNaN(sys2Grid)
      ? sys1Grid + sys2Grid
      : !isNaN(sys1Grid) ? sys1Grid : sys2Grid;

  const fmtGrid = (n: number) => {
    if (isNaN(n)) return "—";
    const abs = Math.abs(n).toFixed(2);
    return n < -0.05 ? `↑ ${abs} kW` : `${abs} kW`;
  };

  const systems: { name: string; rows: EnergyRow[]; chartEntityId: string }[] = [
    {
      name: "Tesla System 1",
      chartEntityId: "sensor.gonser_4680_system_1_percentage_charged",
      rows: [
        { icon: Zap,            label: "Grid Live",       value: fmtGrid(sys1Grid) },
        { icon: Zap,            label: "Exported Today",  value: fmt("sensor.gonser_4680_system_1_grid_exported") },
        { icon: Zap,            label: "Imported Today",  value: fmt("sensor.gonser_4680_system_1_grid_imported") },
        { icon: Sun,            label: "Solar",           value: fmt("sensor.gonser_4680_system_1_solar_power") },
        { icon: BatteryCharging,label: "Battery",         value: fmt("sensor.gonser_4680_system_1_percentage_charged"), pct: sys1Pct },
        { icon: Plug,           label: "Load",            value: fmt("sensor.gonser_4680_system_1_load_power") },
      ],
    },
    {
      name: "Tesla System 2",
      chartEntityId: "sensor.4680_system_2_percentage_charged",
      rows: [
        { icon: Zap,            label: "Grid Live",       value: fmtGrid(sys2Grid) },
        { icon: Zap,            label: "Imported Today",  value: fmt("sensor.4680_system_2_grid_imported") },
        { icon: Zap,            label: "Exported Today",  value: fmt("sensor.4680_system_2_grid_exported") },
        { icon: Sun,            label: "Solar",           value: fmt("sensor.4680_system_2_solar_power") },
        { icon: BatteryCharging,label: "Battery",         value: fmt("sensor.4680_system_2_percentage_charged"), pct: sys2Pct },
        { icon: Plug,           label: "Battery Power",   value: fmt("sensor.4680_system_2_battery_power") },
        { icon: Plug,           label: "Load",            value: fmt("sensor.4680_system_2_load_power") },
      ],
    },
    {
      name: "Total Grid",
      chartEntityId: "sensor.total_solar",
      rows: (() => {
        const sys1ExportedToday = num("sensor.gonser_4680_system_1_grid_exported");
        const sys1ImportedToday = num("sensor.gonser_4680_system_1_grid_imported");
        const sys2ExportedToday = num("sensor.4680_system_2_grid_exported");
        const sys2ImportedToday = num("sensor.4680_system_2_grid_imported");
        // Net today: total exported minus total imported across both systems
        const totalExported = (!isNaN(sys1ExportedToday) ? sys1ExportedToday : 0)
                            + (!isNaN(sys2ExportedToday) ? sys2ExportedToday : 0);
        const totalImported = (!isNaN(sys1ImportedToday) ? sys1ImportedToday : 0)
                            + (!isNaN(sys2ImportedToday) ? sys2ImportedToday : 0);
        const netToday = totalExported - totalImported;
        const fmtKwh = (n: number) => {
          if (isNaN(n)) return "—";
          const abs = Math.abs(n).toFixed(2);
          return n >= 0 ? `↑ ${abs} kWh` : `↓ ${abs} kWh`;
        };
        return [
          { icon: Zap,            label: "Live Net Grid",        value: fmtGrid(totalGrid) },
          { icon: Zap,            label: "Sys 1 Live",           value: fmtGrid(sys1Grid) },
          { icon: Zap,            label: "Sys 2 Live",           value: fmtGrid(sys2Grid) },
          { icon: Zap,            label: "Sys 1 Exported Today", value: fmt("sensor.gonser_4680_system_1_grid_exported") },
          { icon: Zap,            label: "Sys 2 Exported Today", value: fmt("sensor.4680_system_2_grid_exported") },
          { icon: Zap,            label: "Sys 2 Imported Today", value: fmt("sensor.4680_system_2_grid_imported") },
          { icon: Zap,            label: "Net Today",            value: fmtKwh(netToday) },
          { icon: Sun,            label: "Total Solar",          value: fmt("sensor.total_solar") },
          { icon: BatteryCharging,label: "Battery Avg",          value: fmtN(avgPct, "%"), pct: avgPct },
        ];
      })(),
    },
  ];

  return (
    <motion.div
      key="energy"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      {systems.map((sys) => (
        <EnergySystemCard key={sys.name} name={sys.name} rows={sys.rows} chartEntityId={sys.chartEntityId} />
      ))}
    </motion.div>
  );
}

// Match against entity_id (snake_case), most-specific pattern first.
// Bath patterns must come before their parent room pattern.
const SHADE_ROOM_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "Beach Room Bath",  pattern: /floor_1_bedroom_2.*bath/   },
  { label: "Beach Room",       pattern: /floor_1_bedroom_2/          },
  { label: "Utility",          pattern: /floor_1.*util/              },
  { label: "Pub",              pattern: /floor_1_bar/                },
  { label: "Master Bath",      pattern: /floor_2_master.*bath/       },
  { label: "Master Bed",       pattern: /floor_2_master/             },
  { label: "Mauka Bed",        pattern: /floor_2_bedroom_5/          },
  { label: "Molokini Bath",    pattern: /floor_2_bedroom_4.*bath/    },
  { label: "Molokini Bed",     pattern: /floor_2_bedroom_4/          },
];

const SHADE_FLOORS: { floor: string; rooms: string[] }[] = [
  {
    floor: "First Floor",
    rooms: ["Beach Room", "Beach Room Bath", "Utility", "Pub"],
  },
  {
    floor: "Second Floor",
    rooms: ["Master Bed", "Master Bath", "Mauka Bed", "Molokini Bed", "Molokini Bath"],
  },
];

function ShadesView({
  entities,
  renderTile: rt,
}: {
  entities: HAState[];
  renderTile: (s: HAState) => ReactNode;
}) {
  const bucketed = useMemo(() => {
    const allRooms = SHADE_ROOM_PATTERNS.map((r) => r.label);
    const map = new Map<string, HAState[]>(allRooms.map((r) => [r, []]));
    const other: HAState[] = [];
    for (const e of entities) {
      const id = e.entity_id.toLowerCase();
      const match = SHADE_ROOM_PATTERNS.find((r) => r.pattern.test(id));
      if (match) map.get(match.label)!.push(e);
      else other.push(e);
    }
    return { map, other };
  }, [entities]);

  return (
    <motion.div
      key="shades"
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="grid grid-cols-2 gap-8 items-start"
    >
      {SHADE_FLOORS.map(({ floor, rooms }) => {
        const floorEntities = rooms.flatMap((r) => bucketed.map.get(r) ?? []);
        if (floorEntities.length === 0) return null;
        return (
          <section key={floor} className="space-y-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--cream-muted)]">
              {floor}
            </div>
            {rooms.map((room) => {
              const items = bucketed.map.get(room) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={room}>
                  <div className="text-[11px] uppercase tracking-wider text-[var(--brass)] mb-2 ml-1">
                    {room}
                  </div>
                  <div className="grid grid-cols-2 auto-rows-[110px] gap-3">
                    {items.map(rt)}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
      {bucketed.other.length > 0 && (
        <section className="col-span-2">
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--cream-muted)] mb-3">
            Other
          </div>
          <div className="grid grid-cols-4 auto-rows-[110px] gap-3">
            {bucketed.other.map(rt)}
          </div>
        </section>
      )}
    </motion.div>
  );
}

function CoverTile({ s }: { s: HAState }) {
  const isOpen = s.state === "open";
  const pct = s.attributes.current_position as number | undefined;
  const stateLabel = s.state.charAt(0).toUpperCase() + s.state.slice(1);
  const valueText = pct !== undefined ? `${stateLabel} ${pct}%` : stateLabel;
  return (
    <Tile icon={Blinds} label={friendly(s)} sub="shade">
      <div
        className="text-xl font-semibold tabular-nums truncate mt-0.5"
        style={{ color: isOpen ? "var(--brass-bright)" : undefined }}
      >
        {valueText}
      </div>
    </Tile>
  );
}

function renderTile(s: HAState, allStates?: HAState[]) {
  const d = domainOf(s.entity_id);
  if (d === "light") return <LightTile key={s.entity_id} s={s} />;
  if (d === "climate") return <ClimateTile key={s.entity_id} s={s} />;
  if (d === "cover") return <CoverTile key={s.entity_id} s={s} />;
  if (d === "lock") return <LockTile key={s.entity_id} s={s} />;
  if (d === "alarm_control_panel") return <AlarmTile key={s.entity_id} s={s} />;
  if (d === "media_player")
    return <MediaTile key={s.entity_id} s={s} allStates={allStates} />;
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

function SecurityView({
  entities,
  onOpen,
}: {
  entities: HAState[];
  onOpen: (s: HAState) => void;
}) {
  const panels = entities.filter(
    (e) => domainOf(e.entity_id) === "alarm_control_panel",
  );
  const sensors = entities.filter(
    (e) => domainOf(e.entity_id) === "binary_sensor",
  );

  const sensorLabel = (s: HAState): { label: string; on: boolean } => {
    const dc = deviceClass(s);
    const on = s.state === "on";
    const map: Record<string, [string, string]> = {
      door: ["Open", "Closed"],
      window: ["Open", "Closed"],
      opening: ["Open", "Closed"],
      motion: ["Motion", "Clear"],
      smoke: ["Smoke!", "Clear"],
      gas: ["Gas!", "Clear"],
      tamper: ["Tamper", "OK"],
    };
    const [onLbl, offLbl] = map[dc] ?? ["On", "Off"];
    return { label: on ? onLbl : offLbl, on };
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-8"
    >
      {panels.length > 0 && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {panels.map((p) => {
            const armed = p.state.startsWith("armed");
            const triggered = p.state === "triggered";
            const PanelIcon = triggered ? AlertTriangle : ShieldCheck;
            const stateLabel = p.state.replace(/_/g, " ");
            return (
              <button
                key={p.entity_id}
                type="button"
                onClick={() => onOpen(p)}
                aria-label={`Open ${friendly(p)}`}
                className={`text-left rounded-2xl p-6 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cream)]/60 ${
                  triggered
                    ? "bg-red-500/20 border border-red-500/60"
                    : armed
                      ? "bg-[rgba(232,193,120,0.10)] border border-[rgba(232,193,120,0.35)]"
                      : "bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.15)] hover:border-[rgba(232,193,120,0.30)]"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-4 rounded-2xl ${
                      triggered
                        ? "bg-red-500/30 text-red-100"
                        : armed
                          ? "bg-[rgba(201,153,74,0.20)] text-[var(--brass-bright)]"
                          : "bg-[rgba(201,153,74,0.10)] text-[var(--brass)]"
                    }`}
                  >
                    <PanelIcon className="w-10 h-10" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--cream-muted)]">
                      Alarm System
                    </div>
                    <div className="text-xl font-medium text-[var(--cream)] truncate">
                      {friendly(p)}
                    </div>
                    <div
                      className={`text-2xl font-semibold capitalize tabular-nums mt-1 ${
                        triggered
                          ? "text-red-200"
                          : armed
                            ? "text-[var(--brass-bright)]"
                            : "text-[var(--cream-muted)]"
                      }`}
                    >
                      {stateLabel}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </section>
      )}

      {(() => {
        const groups: { title: string; classes: string[] }[] = [
          { title: "Doors & Windows", classes: ["door", "window", "opening"] },
          { title: "Motion", classes: ["motion"] },
          { title: "Alerts", classes: ["smoke", "gas"] },
        ];
        const sortByName = (a: HAState, b: HAState) =>
          friendly(a).localeCompare(friendly(b));
        return groups.map((g) => {
          const items = sensors
            .filter((s) => g.classes.includes(deviceClass(s)))
            .sort(sortByName);
          if (items.length === 0) return null;
          return (
            <section key={g.title}>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--cream-muted)] mb-3 flex items-center gap-2">
                <span>{g.title}</span>
                <span className="text-[var(--brass)]">·</span>
                <span className="tabular-nums">{items.length}</span>
              </div>
              <div className="rounded-2xl bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.12)] divide-y divide-[rgba(232,193,120,0.08)] overflow-hidden">
                {items.map((s) => {
                  const { label, on } = sensorLabel(s);
                  const dc = deviceClass(s);
                  return (
                    <button
                      key={s.entity_id}
                      type="button"
                      onClick={() => onOpen(s)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[rgba(232,193,120,0.05)] focus:outline-none focus-visible:bg-[rgba(232,193,120,0.08)] transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-[var(--cream)] truncate">
                          {friendly(s)}
                        </div>
                        {dc && (
                          <div className="text-[10px] uppercase tracking-wider text-[var(--cream-muted)] mt-0.5">
                            {dc}
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-xs font-semibold uppercase tracking-wider tabular-nums px-2.5 py-1 rounded-full ${
                          on
                            ? dc === "smoke" || dc === "gas"
                              ? "bg-red-500/20 text-red-200 border border-red-500/40"
                              : "bg-[rgba(201,153,74,0.20)] text-[var(--brass-bright)] border border-[rgba(232,193,120,0.30)]"
                            : "bg-[rgba(0,0,0,0.3)] text-[var(--cream-muted)] border border-[rgba(232,193,120,0.10)]"
                        }`}
                      >
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        });
      })()}

      {panels.length === 0 && sensors.length === 0 && (
        <div className="text-center py-20 text-[var(--cream-muted)]">
          <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-base">No security devices to show.</p>
        </div>
      )}
    </motion.div>
  );
}

const HOUSE_MODES = [
  { option: "Owners Home", icon: HomeIcon, label: "Owners" },
  { option: "Visitors",    icon: Users,    label: "Visitors" },
  { option: "Vacation",    icon: Sun,      label: "Vacation" },
  { option: "Suspend",     icon: Pause,    label: "Suspend" },
] as const;

function HouseModeStrip({
  states,
  onChanged,
}: {
  states: HAState[];
  onChanged: () => void;
}) {
  const entity = states.find(
    (s) => s.entity_id === "input_select.maui_house_mode",
  );
  const current = entity?.state ?? "";
  const [busy, setBusy] = useState(false);

  if (!entity) return null;

  const select = async (option: string) => {
    if (busy || option === current) return;
    setBusy(true);
    await haCallService("input_select", "select_option", {
      entity_id: "input_select.maui_house_mode",
      option,
    });
    setTimeout(onChanged, 800);
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-2">
      {HOUSE_MODES.map(({ option, icon: Icon, label }) => {
        const isActive = current === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => select(option)}
            disabled={busy}
            aria-pressed={isActive}
            aria-label={`Set house mode to ${option}`}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all wall-tile",
              isActive ? "wall-tile--active" : "opacity-50 hover:opacity-80",
              busy ? "cursor-wait" : "",
            ].join(" ")}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
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
        {renderTile(aliased, states)}
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
      if (c.key === "overview" || c.key === "rooms" || c.key === "settings") continue;
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

  // For the Music tab, split entities into the canonical zone tiles (top) and
  // everything else (below). Each zone tile renders the matched player when
  // present, or a dimmed placeholder so the kiosk layout is stable.
  const musicZoneEntries = useMemo(() => {
    return MUSIC_ZONES.map((zone) => {
      const player = filtered.find((s) => matchMusicZone(s) === zone) ?? null;
      return { zone, player };
    });
  }, [filtered]);
  const zonePlayerIds = useMemo(
    () =>
      new Set(
        musicZoneEntries
          .map((e) => e.player?.entity_id)
          .filter(Boolean) as string[],
      ),
    [musicZoneEntries],
  );
  // "Other Players" = music_player entities that didn't get their own zone
  // tile. We also exclude anything that *did* match a zone (just didn't win
  // the tile because another entity matched the same zone label first), to
  // avoid showing the same zone twice. Those entities remain reachable via
  // the Group Picker on the matching zone's tile.
  const otherMusic = useMemo(
    () =>
      filtered.filter(
        (s) =>
          !zonePlayerIds.has(s.entity_id) && matchMusicZone(s) === null,
      ),
    [filtered, zonePlayerIds],
  );

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
            c.key !== "overview" && c.key !== "rooms" && c.key !== "settings" && count === 0;
          const showBadge =
            c.key !== "overview" && c.key !== "rooms" && c.key !== "settings" && !dim && count > 0;
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
          <HouseModeStrip states={states} onChanged={refresh} />
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
            {active === "settings" ? (
              <ClimateSettings key="settings" states={states} onChanged={refresh} />
            ) : active === "overview" ? (
              <SuperView key="super" states={states} />
            ) : active === "rooms" ? (
              <RoomsView key="rooms" states={states} refresh={refresh} />
            ) : active === "covers" ? (
              <ShadesView
                key="shades"
                entities={filtered}
                renderTile={clickableTile}
              />
            ) : active === "lights" ||
              active === "switches" ||
              active === "fans" ? (
              <GroupedByRoomView
                key={`${active}-grouped`}
                entities={filtered}
                renderTile={clickableTile}
              />
            ) : active === "security" ? (
              <SecurityView
                key="security"
                entities={filtered}
                onOpen={setOpenEntity}
              />
            ) : active === "energy" ? (
              <EnergyDashboard key="energy" states={states} />
            ) : active === "media" ? (
              <motion.div
                key="media"
                layout
                className="space-y-8"
              >
                <section>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--cream-muted)] mb-3 flex items-center gap-2">
                    <span>Music Zones</span>
                    <span className="text-[var(--brass)]">·</span>
                    <span className="tabular-nums">
                      {musicZoneEntries.filter((e) => e.player).length}/{MUSIC_ZONES.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 auto-rows-[110px] gap-3">
                    {musicZoneEntries.map(({ zone, player }) =>
                      player ? (
                        <button
                          type="button"
                          key={zone}
                          onClick={() => setOpenEntity(player)}
                          aria-label={`Open ${zone}`}
                          className="text-left rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cream)]/60"
                        >
                          {renderTile(
                            {
                              ...player,
                              attributes: {
                                ...player.attributes,
                                friendly_name: zone,
                              },
                            } as HAState,
                            states,
                          )}
                        </button>
                      ) : (
                        <div
                          key={zone}
                          role="status"
                          aria-label={`${zone} music zone is offline — no matching media player found`}
                          className="wall-tile wall-tile--dim rounded-2xl p-3 min-h-[110px] flex flex-col justify-between opacity-40"
                        >
                          <div
                            aria-hidden="true"
                            className="text-xs uppercase tracking-wider text-[var(--cream-muted)]"
                          >
                            Music Zone
                          </div>
                          <div
                            aria-hidden="true"
                            className="text-sm font-medium truncate"
                          >
                            {zone}
                          </div>
                          <div
                            aria-hidden="true"
                            className="text-[10px] text-[var(--cream-muted)]"
                          >
                            offline
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </section>
                {otherMusic.length > 0 && (
                  <section>
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--cream-muted)] mb-3">
                      Other Players
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 auto-rows-[110px] gap-3">
                      {otherMusic.map(clickableTile)}
                    </div>
                  </section>
                )}
              </motion.div>
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
        states={states}
        onClose={() => setOpenEntity(null)}
        onChanged={refresh}
      />
    </div>
  );
}
