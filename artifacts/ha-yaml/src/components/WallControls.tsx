import { useEffect, useRef, useState } from "react";
import { X, Pencil } from "lucide-react";
import { useEntityAliases } from "@/lib/entityAliases";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Switch as SwitchInput } from "@/components/ui/switch";
import {
  Lightbulb,
  Power,
  Thermometer,
  Lock,
  Unlock,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Volume1,
  Blinds,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Square,
  Wind,
  Sparkles,
  Activity,
  Plus,
  Minus,
  Loader2,
  ShieldCheck,
  Radio,
  Users,
  Home as HomeIcon,
  Menu as MenuIcon,
  Undo2,
  Rewind,
  FastForward,
} from "lucide-react";
import { haCallService, type HAState } from "@/lib/ha";
import { displayMediaState, masterOf } from "@/lib/mediaState";
import { MUSIC_ZONES, matchMusicZone } from "./Wall";

const friendly = (s: HAState) =>
  (s.attributes.friendly_name as string | undefined) ?? s.entity_id;
const domainOf = (id: string) => id.split(".")[0] ?? "";

type Props = {
  entity: HAState | null;
  states?: HAState[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
};

export function WallControls({
  entity,
  states = [],
  onClose,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const aliases = useEntityAliases((s) => s.aliases);
  const setAlias = useEntityAliases((s) => s.setAlias);
  const loadAliases = useEntityAliases((s) => s.load);
  useEffect(() => {
    loadAliases();
  }, [loadAliases]);

  useEffect(() => {
    if (!entity) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (
        panelRef.current &&
        e.target instanceof Node &&
        !panelRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [entity, onClose]);

  if (!entity) return null;
  const d = domainOf(entity.entity_id);
  // For media_player slaves, the coordinator entity holds the real playback
  // state (playing, title, source). Resolve it via the shared `masterOf`
  // helper so we honor both Bluesound's `master` and Sonos's `group_leader`.
  const masterId = d === "media_player" ? masterOf(entity, states) : null;
  const controller =
    masterId !== null
      ? (states.find((s) => s.entity_id === masterId) ?? entity)
      : entity;
  const currentAlias = aliases[entity.entity_id] ?? "";
  const displayName = currentAlias || friendly(entity);
  const rename = () => {
    const next = window.prompt(
      `Rename "${friendly(entity)}" for this kiosk only.\nLeave blank to reset to the Home Assistant name.`,
      currentAlias,
    );
    if (next === null) return;
    setAlias(entity.entity_id, next);
  };

  const call = async (
    domain: string,
    service: string,
    data: Record<string, unknown> = {},
  ) => {
    setBusy(true);
    setLastError(null);
    const res = await haCallService(domain, service, {
      entity_id: entity.entity_id,
      ...data,
    });
    if (!res.ok) {
      setLastError(
        `${domain}.${service} failed: ${res.error || `HTTP ${res.status}`}`,
      );
      // eslint-disable-next-line no-console
      console.error("HA service call failed", { domain, service, data, res });
    }
    await onChanged();
    setBusy(false);
  };

  const Icon = pickIcon(d, entity);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={`Controls for ${friendly(entity)}`}
      className="wall-controls fixed top-0 right-0 bottom-0 z-40 w-[92vw] sm:w-[440px] max-w-[440px] overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300"
    >
      <div className="p-6 pb-4 border-b border-[rgba(232,193,120,0.18)]">
        <div className="flex items-center gap-3 text-[var(--cream)]">
          <div className="p-2.5 rounded-xl bg-[rgba(201,153,74,0.12)] text-[var(--brass-bright)]">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="text-lg font-medium truncate">{displayName}</div>
            <div className="text-[11px] font-mono text-[var(--cream-muted)] truncate">
              {currentAlias ? friendly(entity) : entity.entity_id}
            </div>
          </div>
          {busy && (
            <Loader2 className="w-4 h-4 animate-spin text-[var(--brass)]" />
          )}
          <button
            type="button"
            onClick={rename}
            aria-label="Rename for this kiosk"
            title="Rename for this kiosk"
            className="p-2 rounded-lg text-[var(--cream-muted)] hover:text-[var(--cream)] hover:bg-[rgba(232,193,120,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cream)]/60"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close controls"
            className="p-2 rounded-lg text-[var(--cream-muted)] hover:text-[var(--cream)] hover:bg-[rgba(232,193,120,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cream)]/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
          <StatePill entity={controller} allStates={states} />

          {lastError && (
            <div
              role="alert"
              className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-sm text-red-200 break-words"
            >
              {lastError}
            </div>
          )}

          {d === "light" && <LightControls entity={entity} call={call} />}
          {d === "switch" && <SwitchControls entity={entity} call={call} />}
          {d === "input_boolean" && (
            <SwitchControls entity={entity} call={call} domain="input_boolean" />
          )}
          {d === "fan" && <FanControls entity={entity} call={call} />}
          {d === "climate" && <ClimateControls entity={entity} call={call} />}
          {d === "lock" && <LockControls entity={entity} call={call} />}
          {d === "alarm_control_panel" && (
            <SecurityControls entity={entity} call={call} />
          )}
          {d === "cover" && <CoverControls entity={entity} call={call} />}
          {d === "media_player" && (
            <MediaControls
              entity={entity}
              controller={controller}
              states={states}
              call={call}
            />
          )}
          {d === "media_player" && (
            <RemoteControls entity={entity} states={states} call={call} />
          )}
          {d === "scene" && (
            <RunButton
              label="Activate Scene"
              icon={Sparkles}
              onClick={() => call("scene", "turn_on")}
            />
          )}
          {d === "script" && (
            <RunButton
              label="Run Script"
              icon={Play}
              onClick={() =>
                call("script", entity.entity_id.split(".")[1] ?? "turn_on")
              }
            />
          )}
          {d === "automation" && (
            <div className="space-y-2">
              <RunButton
                label="Trigger Now"
                icon={Play}
                onClick={() => call("automation", "trigger")}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => call("automation", "turn_on")}
                  className="wall-btn"
                >
                  Enable
                </Button>
                <Button
                  variant="outline"
                  onClick={() => call("automation", "turn_off")}
                  className="wall-btn"
                >
                  Disable
                </Button>
              </div>
            </div>
          )}

      </div>
    </div>
  );
}

function pickIcon(d: string, e: HAState) {
  if (d === "light") return Lightbulb;
  if (d === "switch" || d === "input_boolean") return Power;
  if (d === "climate") return Thermometer;
  if (d === "lock") return e.state === "locked" ? Lock : Unlock;
  if (d === "cover") return Blinds;
  if (d === "fan") return Wind;
  if (d === "media_player") return Play;
  if (d === "scene") return Sparkles;
  if (d === "script" || d === "automation") return Play;
  if (d === "alarm_control_panel") return ShieldCheck;
  return Activity;
}

// Map raw HA state to a friendlier label. Media players go through the
// shared `displayMediaState` helper so Wall tiles and this drawer agree on
// what "idle but actually streaming" looks like.
function displayState(entity: HAState, allStates?: HAState[]): string {
  const raw = entity.state;
  const cap = (s: string) =>
    s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
  if (domainOf(entity.entity_id) === "media_player") {
    return displayMediaState(entity, allStates);
  }
  return raw.includes("_")
    ? raw.split("_").map(cap).join(" ")
    : cap(raw);
}

function StatePill({
  entity,
  allStates,
}: {
  entity: HAState;
  allStates?: HAState[];
}) {
  const unit =
    (entity.attributes.unit_of_measurement as string | undefined) ?? "";
  const label = displayState(entity, allStates);
  return (
    <div className="rounded-xl p-4 bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.12)] flex items-center justify-between">
      <span className="text-xs uppercase tracking-wider text-[var(--cream-muted)]">
        Current state
      </span>
      <span className="text-xl font-semibold tabular-nums text-[var(--brass-bright)]">
        {label}
        {unit && (
          <span className="text-sm text-[var(--cream-muted)] ml-1">
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

type CallFn = (
  domain: string,
  service: string,
  data?: Record<string, unknown>,
) => Promise<void>;

function LightControls({
  entity,
  call,
}: {
  entity: HAState;
  call: CallFn;
}) {
  const on = entity.state === "on";
  const brightness = (entity.attributes.brightness as number | undefined) ?? 0;
  const pct = on ? Math.round((brightness / 255) * 100) : 0;
  const colorTemp = entity.attributes.color_temp as number | undefined;
  const minMireds = entity.attributes.min_mireds as number | undefined;
  const maxMireds = entity.attributes.max_mireds as number | undefined;
  const supportsColorTemp = colorTemp !== undefined && minMireds && maxMireds;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-4 rounded-xl bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.12)]">
        <span className="font-medium">Power</span>
        <SwitchInput
          checked={on}
          onCheckedChange={(c) =>
            call("light", c ? "turn_on" : "turn_off")
          }
        />
      </div>

      {on && (
        <div className="space-y-3 p-4 rounded-xl bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.12)]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--cream-muted)]">Brightness</span>
            <span className="tabular-nums text-[var(--brass-bright)] font-semibold">
              {pct}%
            </span>
          </div>
          <Slider
            value={[pct]}
            min={1}
            max={100}
            step={1}
            onValueCommit={(v) =>
              call("light", "turn_on", { brightness_pct: v[0] })
            }
          />
          <div className="grid grid-cols-4 gap-2">
            {[25, 50, 75, 100].map((p) => (
              <Button
                key={p}
                variant="outline"
                className="wall-btn"
                onClick={() =>
                  call("light", "turn_on", { brightness_pct: p })
                }
              >
                {p}%
              </Button>
            ))}
          </div>
        </div>
      )}

      {on && supportsColorTemp && (
        <div className="space-y-3 p-4 rounded-xl bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.12)]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--cream-muted)]">Color temperature</span>
            <span className="tabular-nums text-[var(--brass-bright)] font-semibold">
              {colorTemp} mireds
            </span>
          </div>
          <Slider
            value={[colorTemp ?? minMireds!]}
            min={minMireds}
            max={maxMireds}
            step={1}
            onValueCommit={(v) =>
              call("light", "turn_on", { color_temp: v[0] })
            }
          />
        </div>
      )}
    </div>
  );
}

function SwitchControls({
  entity,
  call,
  domain = "switch",
}: {
  entity: HAState;
  call: CallFn;
  domain?: string;
}) {
  const on = entity.state === "on";
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.12)]">
      <span className="font-medium">Power</span>
      <SwitchInput
        checked={on}
        onCheckedChange={(c) => call(domain, c ? "turn_on" : "turn_off")}
      />
    </div>
  );
}

function FanControls({ entity, call }: { entity: HAState; call: CallFn }) {
  const on = entity.state === "on";
  const pct = (entity.attributes.percentage as number | undefined) ?? 0;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-4 rounded-xl bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.12)]">
        <span className="font-medium">Power</span>
        <SwitchInput
          checked={on}
          onCheckedChange={(c) => call("fan", c ? "turn_on" : "turn_off")}
        />
      </div>
      {on && (
        <div className="space-y-3 p-4 rounded-xl bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.12)]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--cream-muted)]">Speed</span>
            <span className="tabular-nums text-[var(--brass-bright)] font-semibold">
              {pct}%
            </span>
          </div>
          <Slider
            value={[pct]}
            min={0}
            max={100}
            step={1}
            onValueCommit={(v) =>
              call("fan", "set_percentage", { percentage: v[0] })
            }
          />
        </div>
      )}
    </div>
  );
}

function ClimateControls({
  entity,
  call,
}: {
  entity: HAState;
  call: CallFn;
}) {
  const cur = entity.attributes.current_temperature as number | undefined;
  const target = entity.attributes.temperature as number | undefined;
  const u =
    (entity.attributes.temperature_unit as string | undefined) ?? "°";
  const mode = entity.state;
  const modes = (entity.attributes.hvac_modes as string[] | undefined) ?? [];
  const fanModes =
    (entity.attributes.fan_modes as string[] | undefined) ?? [];
  const fanMode = entity.attributes.fan_mode as string | undefined;
  const presetModes =
    (entity.attributes.preset_modes as string[] | undefined) ?? [];
  const presetMode = entity.attributes.preset_mode as string | undefined;
  // Ecobee surfaces the active schedule "comfort setting" name (Home, Away,
  // Sleep, custom climates) under `current_program` / `program`. It's
  // read-only — schedule changes go through `set_preset_mode`.
  const currentProgram =
    (entity.attributes.current_program as string | undefined) ??
    (entity.attributes.program as string | undefined);
  const [draft, setDraft] = useState<number | null>(null);
  useEffect(() => setDraft(null), [entity.entity_id, target]);
  const shown = draft ?? target ?? 70;

  const commit = (v: number) => {
    setDraft(v);
    call("climate", "set_temperature", { temperature: v });
  };

  return (
    <div className="space-y-5">
      <div className="p-6 rounded-xl bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.12)] flex flex-col items-center">
        <div className="text-xs uppercase tracking-wider text-[var(--cream-muted)] mb-2">
          Set to
        </div>
        <div className="text-6xl font-light tabular-nums text-[var(--brass-bright)]">
          {shown}
          {u}
        </div>
        {cur !== undefined && (
          <div className="text-sm text-[var(--cream-muted)] mt-1">
            currently {cur}
            {u}
          </div>
        )}
        <div className="flex items-center gap-3 mt-5">
          <Button
            variant="outline"
            className="wall-btn h-14 w-14 rounded-full p-0"
            onClick={() => commit(shown - 1)}
          >
            <Minus className="w-6 h-6" />
          </Button>
          <Button
            variant="outline"
            className="wall-btn h-14 w-14 rounded-full p-0"
            onClick={() => commit(shown + 1)}
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {modes.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-[var(--cream-muted)]">
            Mode
          </div>
          <div className="grid grid-cols-3 gap-2">
            {modes.map((m) => (
              <Button
                key={m}
                variant={mode === m ? "default" : "outline"}
                className={mode === m ? "wall-btn-active" : "wall-btn"}
                onClick={() => call("climate", "set_hvac_mode", { hvac_mode: m })}
              >
                {m}
              </Button>
            ))}
          </div>
        </div>
      )}

      {fanModes.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-[var(--cream-muted)]">
            Fan
          </div>
          <div className="grid grid-cols-3 gap-2">
            {fanModes.map((m) => (
              <Button
                key={m}
                variant={fanMode === m ? "default" : "outline"}
                className={fanMode === m ? "wall-btn-active" : "wall-btn"}
                onClick={() =>
                  call("climate", "set_fan_mode", { fan_mode: m })
                }
              >
                {m}
              </Button>
            ))}
          </div>
        </div>
      )}

      {presetModes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-[var(--cream-muted)]">
              Schedule
            </div>
            {currentProgram && currentProgram !== presetMode && (
              <div className="text-xs text-[var(--cream-muted)]">
                on schedule: {currentProgram}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {presetModes.map((p) => (
              <Button
                key={p}
                variant={presetMode === p ? "default" : "outline"}
                className={presetMode === p ? "wall-btn-active" : "wall-btn"}
                onClick={() =>
                  call("climate", "set_preset_mode", { preset_mode: p })
                }
              >
                {p}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LockControls({ entity, call }: { entity: HAState; call: CallFn }) {
  const locked = entity.state === "locked";
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        size="lg"
        className={locked ? "wall-btn-active" : "wall-btn"}
        variant="outline"
        onClick={() => call("lock", "lock")}
      >
        <Lock className="w-5 h-5 mr-2" /> Lock
      </Button>
      <Button
        size="lg"
        className={!locked ? "wall-btn-active" : "wall-btn"}
        variant="outline"
        onClick={() => call("lock", "unlock")}
      >
        <Unlock className="w-5 h-5 mr-2" /> Unlock
      </Button>
    </div>
  );
}

function SecurityControls({
  entity,
  call,
}: {
  entity: HAState;
  call: CallFn;
}) {
  // HA alarm_control_panel supported_features bitmask:
  //   1 ARM_HOME, 2 ARM_AWAY, 4 ARM_NIGHT, 8 TRIGGER,
  //   16 ARM_CUSTOM_BYPASS, 32 ARM_VACATION
  const feats = Number(entity.attributes.supported_features ?? 0);
  const has = (bit: number) => (feats & bit) === bit;
  // Total Connect tends to advertise nothing in supported_features. If we
  // got zero, fall back to "the common three" so the user gets useful
  // buttons instead of an empty drawer.
  const hasHome = has(1) || feats === 0;
  const hasAway = has(2) || feats === 0;
  const hasNight = has(4);
  const codeFormat = entity.attributes.code_format as string | null | undefined;
  const codeArmRequired = entity.attributes.code_arm_required as
    | boolean
    | undefined;
  const needsCode = codeFormat !== null && codeFormat !== undefined;
  const [code, setCode] = useState("");
  const state = entity.state;
  const isArmed = state.startsWith("armed_");
  const isDisarmed = state === "disarmed";
  const inFlight = state === "arming" || state === "disarming" || state === "pending";

  const armingDisabled = needsCode && codeArmRequired === true && code.length === 0;
  const disarmDisabled = needsCode && code.length === 0;

  const armCall = (service: string) => {
    const data: Record<string, unknown> = {};
    if (code) data.code = code;
    call("alarm_control_panel", service, data).then(() => setCode(""));
  };

  return (
    <div className="space-y-4">
      {needsCode && (
        <div className="space-y-2 p-4 rounded-xl bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.12)]">
          <label className="text-xs uppercase tracking-wider text-[var(--cream-muted)]">
            Code
          </label>
          <input
            type="password"
            inputMode={codeFormat === "number" ? "numeric" : "text"}
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={
              codeArmRequired ? "Required for arm & disarm" : "Required for disarm"
            }
            className="w-full px-3 py-2 rounded-lg bg-[rgba(0,0,0,0.4)] border border-[rgba(232,193,120,0.2)] text-[var(--cream)] tabular-nums text-lg tracking-widest focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]"
          />
        </div>
      )}

      {inFlight && (
        <div className="text-center text-sm text-[var(--cream-muted)] italic">
          {state === "arming"
            ? "Arming…"
            : state === "disarming"
              ? "Disarming…"
              : "Pending…"}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {hasHome && (
          <Button
            size="lg"
            variant="outline"
            disabled={armingDisabled || state === "armed_home"}
            className={state === "armed_home" ? "wall-btn-active" : "wall-btn"}
            onClick={() => armCall("alarm_arm_home")}
          >
            <HomeIcon className="w-5 h-5 mr-2" /> Arm Stay
          </Button>
        )}
        {hasAway && (
          <Button
            size="lg"
            variant="outline"
            disabled={armingDisabled || state === "armed_away"}
            className={state === "armed_away" ? "wall-btn-active" : "wall-btn"}
            onClick={() => armCall("alarm_arm_away")}
          >
            <ShieldCheck className="w-5 h-5 mr-2" /> Arm Away
          </Button>
        )}
        {hasNight && (
          <Button
            size="lg"
            variant="outline"
            disabled={armingDisabled || state === "armed_night"}
            className={state === "armed_night" ? "wall-btn-active" : "wall-btn"}
            onClick={() => armCall("alarm_arm_night")}
          >
            Arm Night
          </Button>
        )}
      </div>

      <Button
        size="lg"
        variant="outline"
        disabled={disarmDisabled || isDisarmed}
        className={
          isArmed
            ? "w-full h-14 text-base border-red-500/60 text-red-200 bg-red-500/15 hover:bg-red-500/25"
            : "wall-btn w-full h-14 text-base"
        }
        onClick={() => armCall("alarm_disarm")}
      >
        <Unlock className="w-5 h-5 mr-2" /> Disarm
      </Button>
    </div>
  );
}

function CoverControls({ entity, call }: { entity: HAState; call: CallFn }) {
  const pos = entity.attributes.current_position as number | undefined;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          className="wall-btn h-14"
          onClick={() => call("cover", "open_cover")}
        >
          <ArrowUp className="w-5 h-5" />
        </Button>
        <Button
          variant="outline"
          className="wall-btn h-14"
          onClick={() => call("cover", "stop_cover")}
        >
          <Square className="w-5 h-5" />
        </Button>
        <Button
          variant="outline"
          className="wall-btn h-14"
          onClick={() => call("cover", "close_cover")}
        >
          <ArrowDown className="w-5 h-5" />
        </Button>
      </div>
      {pos !== undefined && (
        <div className="space-y-2 p-4 rounded-xl bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.12)]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--cream-muted)]">Position</span>
            <span className="tabular-nums text-[var(--brass-bright)] font-semibold">
              {pos}%
            </span>
          </div>
          <Slider
            value={[pos]}
            min={0}
            max={100}
            step={1}
            onValueCommit={(v) =>
              call("cover", "set_cover_position", { position: v[0] })
            }
          />
        </div>
      )}
    </div>
  );
}

function MediaControls({
  entity,
  controller,
  states,
  call,
}: {
  entity: HAState;
  controller: HAState;
  states: HAState[];
  call: CallFn;
}) {
  // Playback metadata comes from the coordinator (the group "master"). When
  // the user opens a slave, the slave's own state is "idle" while the
  // coordinator says "playing" — we want to show the latter.
  const playing = controller.state === "playing";
  const off =
    controller.state === "off" || controller.state === "standby";
  // HA media_player supported_features bitmask. Bluesound players don't
  // implement TURN_OFF (they're always on) — calling `media_player.turn_off`
  // on them 500s. Detect feature support so we can fall back to STOP, or
  // hide the button entirely when neither is available.
  const features =
    (controller.attributes.supported_features as number | undefined) ?? 0;
  const SUPPORT_TURN_ON = 128;
  const SUPPORT_TURN_OFF = 256;
  const SUPPORT_STOP = 4096;
  const canTurnOff = (features & SUPPORT_TURN_OFF) !== 0;
  const canTurnOn = (features & SUPPORT_TURN_ON) !== 0;
  const canStop = (features & SUPPORT_STOP) !== 0;
  // What service should the power button fire? Prefer TURN_OFF/TURN_ON;
  // otherwise fall back to STOP (and there's no "turn on" without TURN_ON,
  // so the on-side button is hidden when only stop is supported).
  const powerOffService = canTurnOff ? "turn_off" : canStop ? "media_stop" : null;
  const powerOnService = canTurnOn ? "turn_on" : null;
  const powerLabel = off
    ? canTurnOn
      ? "Turn on"
      : null
    : canTurnOff
      ? "Turn off"
      : canStop
        ? "Stop"
        : null;
  // Volume + mute are per-zone, so they always come from the opened entity.
  const volume = entity.attributes.volume_level as number | undefined;
  const muted = entity.attributes.is_volume_muted as boolean | undefined;
  const title = controller.attributes.media_title as string | undefined;
  const artist = controller.attributes.media_artist as string | undefined;
  const sourceList = controller.attributes.source_list as
    | string[]
    | undefined;
  const currentSource = controller.attributes.source as string | undefined;
  // Bluesound never echoes `source` back after `select_source` for streaming
  // inputs like Spotify Connect, so the dropdown would snap back to "Choose
  // a source" the moment the user picks one. Remember the user's choice
  // locally and prefer it whenever HA hasn't reported a real source. Reset
  // when the user opens a different entity.
  const [optimisticSource, setOptimisticSource] = useState<string | null>(null);
  useEffect(() => {
    setOptimisticSource(null);
  }, [controller.entity_id]);
  const effectiveSource = currentSource ?? optimisticSource ?? undefined;
  // Group membership lives on the coordinator's entity.
  const groupMembers =
    (controller.attributes.group_members as string[] | undefined) ?? [];
  const selfZone = matchMusicZone(entity);

  // Local slider state — Radix Slider needs onValueChange to move the thumb.
  // Sync from HA when the user isn't actively dragging.
  const haVolumePct =
    volume !== undefined ? Math.round(volume * 100) : 0;
  const [draftVolume, setDraftVolume] = useState<number | null>(null);
  useEffect(() => {
    if (draftVolume === null) return;
    // If HA caught up to the drafted value, drop the draft.
    if (Math.abs(haVolumePct - draftVolume) <= 1) setDraftVolume(null);
  }, [haVolumePct, draftVolume]);
  const displayVolume = draftVolume ?? haVolumePct;

  return (
    <div className="space-y-4">
      {(title || artist) && (
        <div className="p-4 rounded-xl bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.12)]">
          {title && <div className="font-medium truncate">{title}</div>}
          {artist && (
            <div className="text-sm text-[var(--cream-muted)] truncate">
              {artist}
            </div>
          )}
        </div>
      )}

      {/* Transport must target the coordinator: when `entity` is a group
          slave, Bluesound 500s if you call media_play/pause/next/previous
          on the slave directly. The coordinator owns the playback queue. */}
      <div className="grid grid-cols-4 gap-2">
        <Button
          variant="outline"
          className="wall-btn h-14"
          onClick={() =>
            call("media_player", "media_previous_track", {
              entity_id: controller.entity_id,
            })
          }
        >
          <SkipBack className="w-5 h-5" />
        </Button>
        <Button
          variant="outline"
          className="wall-btn-active h-14 col-span-2"
          onClick={() =>
            call("media_player", playing ? "media_pause" : "media_play", {
              entity_id: controller.entity_id,
            })
          }
        >
          {playing ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6" />
          )}
        </Button>
        <Button
          variant="outline"
          className="wall-btn h-14"
          onClick={() =>
            call("media_player", "media_next_track", {
              entity_id: controller.entity_id,
            })
          }
        >
          <SkipForward className="w-5 h-5" />
        </Button>
      </div>

      {volume !== undefined && (
        <div className="space-y-3 p-4 rounded-xl bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.12)]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--cream-muted)] flex items-center gap-2">
              {muted ? (
                <VolumeX className="w-4 h-4" />
              ) : volume < 0.4 ? (
                <Volume1 className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
              Volume
            </span>
            <span className="tabular-nums text-[var(--brass-bright)] font-semibold">
              {displayVolume}%
            </span>
          </div>
          <Slider
            value={[displayVolume]}
            min={0}
            max={100}
            step={1}
            onValueChange={(v) => setDraftVolume(v[0] ?? 0)}
            onValueCommit={(v) => {
              const pct = v[0] ?? 0;
              setDraftVolume(pct);
              call("media_player", "volume_set", {
                volume_level: pct / 100,
              });
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="wall-btn"
              onClick={() =>
                call("media_player", "volume_mute", { is_volume_muted: !muted })
              }
            >
              {muted ? "Unmute" : "Mute"}
            </Button>
            {powerLabel && (
              <Button
                variant="outline"
                className="wall-btn"
                onClick={() => {
                  const svc = off ? powerOnService : powerOffService;
                  if (svc) call("media_player", svc);
                }}
              >
                {powerLabel}
              </Button>
            )}
          </div>
        </div>
      )}

      {sourceList && sourceList.length > 0 && (
        <div className="space-y-2 p-4 rounded-xl bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.12)]">
          <div className="flex items-center gap-2 text-sm text-[var(--cream-muted)]">
            <Radio className="w-4 h-4" />
            <span>Source</span>
          </div>
          <select
            value={effectiveSource ?? ""}
            onChange={(e) => {
              const next = e.target.value;
              if (!next) return;
              setOptimisticSource(next);
              call("media_player", "select_source", { source: next });
            }}
            className="w-full bg-[rgba(0,0,0,0.4)] border border-[rgba(232,193,120,0.2)] text-[var(--cream)] rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cream)]/60"
          >
            {effectiveSource === undefined && (
              <option value="">— Choose a source —</option>
            )}
            {sourceList.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>
        </div>
      )}

      {selfZone && (
        <GroupPicker
          entity={entity}
          controller={controller}
          states={states}
          call={call}
          groupMembers={groupMembers}
        />
      )}
    </div>
  );
}

function GroupPicker({
  entity,
  controller,
  states,
  call,
  groupMembers,
}: {
  entity: HAState;
  controller: HAState;
  states: HAState[];
  call: CallFn;
  groupMembers: string[];
}) {
  // Find one media_player entity per music zone (other than ourselves).
  const zonePlayers = MUSIC_ZONES.map((zone) => {
    const player = states.find(
      (s) =>
        s.entity_id !== entity.entity_id &&
        matchMusicZone(s) === zone,
    );
    return player ? { zone, player } : null;
  }).filter((x): x is { zone: string; player: HAState } => x !== null);

  if (zonePlayers.length === 0) return null;

  // Operate against the group's actual coordinator (the controller). When
  // the user opens a slave, joining/unjoining must target the master.
  const coordinatorId = controller.entity_id;

  // Optimistic overrides so the button flips instantly. Bluesound takes a
  // few seconds to reflect group changes back in `group_members`, and we
  // re-sync from real state below.
  const [pendingJoin, setPendingJoin] = useState<Set<string>>(new Set());
  const [pendingLeave, setPendingLeave] = useState<Set<string>>(new Set());

  // Robust "joined" check: either the coordinator's group_members lists the
  // target, or the target itself points back to our coordinator via the
  // shared `masterOf` helper (covers both Bluesound `master` and Sonos
  // `group_leader`). The latter updates immediately while group_members lags.
  const realJoined = (id: string) => {
    if (groupMembers.includes(id)) return true;
    const target = states.find((s) => s.entity_id === id);
    if (!target) return false;
    return masterOf(target, states) === coordinatorId;
  };

  const isGrouped = (id: string) => {
    if (pendingJoin.has(id)) return true;
    if (pendingLeave.has(id)) return false;
    return realJoined(id);
  };

  // Drop optimistic flags once HA confirms the change.
  useEffect(() => {
    if (pendingJoin.size > 0) {
      const next = new Set(pendingJoin);
      for (const id of pendingJoin) if (realJoined(id)) next.delete(id);
      if (next.size !== pendingJoin.size) setPendingJoin(next);
    }
    if (pendingLeave.size > 0) {
      const next = new Set(pendingLeave);
      for (const id of pendingLeave) if (!realJoined(id)) next.delete(id);
      if (next.size !== pendingLeave.size) setPendingLeave(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states, groupMembers]);

  const toggleGroup = async (player: HAState) => {
    const id = player.entity_id;
    if (isGrouped(id)) {
      // Optimistic: mark as leaving immediately.
      setPendingLeave((s) => new Set(s).add(id));
      setPendingJoin((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      if (!realJoined(id)) return;
      // Bluesound's HA integration does NOT support per-slave removal —
      // calling `media_player.unjoin` on the slave 500s ("Server got itself
      // in trouble"). The BluOS API only exposes group dissolution from the
      // master. So we dissolve the group and immediately re-form it with
      // everyone except the slave being removed. This causes a brief audio
      // dropout (~600ms) but is the only reliable way.
      const live = states.find((s) => s.entity_id === coordinatorId);
      const liveMembers =
        (live?.attributes.group_members as string[] | undefined) ?? [];
      const remaining = liveMembers.filter(
        (m) => m !== id && m !== coordinatorId,
      );
      await call("media_player", "unjoin", { entity_id: coordinatorId });
      if (remaining.length > 0) {
        await new Promise((r) => setTimeout(r, 600));
        await call("media_player", "join", {
          entity_id: coordinatorId,
          group_members: remaining,
        });
      }
    } else {
      // Optimistic: mark as joined immediately.
      setPendingJoin((s) => new Set(s).add(id));
      setPendingLeave((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      await call("media_player", "join", {
        entity_id: coordinatorId,
        group_members: [player.entity_id],
      });
    }
  };

  return (
    <div className="space-y-2 p-4 rounded-xl bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.12)]">
      <div className="flex items-center gap-2 text-sm text-[var(--cream-muted)]">
        <Users className="w-4 h-4" />
        <span>Also play in</span>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {zonePlayers.map(({ zone, player }) => {
          const joined = isGrouped(player.entity_id);
          return (
            <button
              key={player.entity_id}
              type="button"
              onClick={() => toggleGroup(player)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                joined
                  ? "bg-[rgba(201,153,74,0.18)] border border-[rgba(232,193,120,0.35)] text-[var(--cream)]"
                  : "bg-[rgba(0,0,0,0.3)] border border-[rgba(232,193,120,0.12)] text-[var(--cream-muted)] hover:text-[var(--cream)]"
              }`}
            >
              <span className="truncate">{zone}</span>
              <span className="text-xs tabular-nums shrink-0 ml-2">
                {joined ? "Joined" : "Add"}
              </span>
            </button>
          );
        })}
      </div>
      {groupMembers.length > 1 && (
        <Button
          variant="outline"
          className="wall-btn w-full mt-2"
          onClick={() => {
            // Live re-check: if HA already reports the coordinator solo
            // (group_members <= 1) skip the call so we don't 500 on a stale
            // render. The button visibility itself is based on a snapshot.
            const live = states.find((s) => s.entity_id === coordinatorId);
            const liveMembers =
              (live?.attributes.group_members as string[] | undefined) ?? [];
            if (liveMembers.length <= 1) return;
            call("media_player", "unjoin", { entity_id: coordinatorId });
          }}
        >
          Leave group
        </Button>
      )}
    </div>
  );
}

// --- Remote profiles -------------------------------------------------------
// Each TV brand uses a different HA integration with different services and
// command vocabularies. We model each one as a `RemoteProfile` so the UI
// can stay generic. Apps are per-profile because Fire TV launches by Android
// package and Samsung launches by numeric Tizen app id.

type NavKey =
  | "up"
  | "down"
  | "left"
  | "right"
  | "ok"
  | "back"
  | "home"
  | "apps";

type AppShortcut = { label: string; launch: () => Promise<void> };

type RemoteProfile = {
  kind: "firetv" | "samsung" | "generic";
  navKey: (k: NavKey) => Promise<void>;
  volumeUp: () => Promise<void>;
  volumeDown: () => Promise<void>;
  playPause: () => Promise<void>;
  apps: AppShortcut[];
  powerOn: () => Promise<void>;
  powerOff: () => Promise<void>;
};

// Fire TV apps launch via `androidtv.adb_command` + `monkey -p <pkg> 1`,
// matching the user's working Lovelace card.
const FIRE_TV_APPS: { label: string; pkg: string }[] = [
  { label: "YouTube TV", pkg: "com.amazon.firetv.youtube.tv" },
  { label: "Apple TV", pkg: "com.apple.atve.amazon.appletv" },
  { label: "Netflix", pkg: "com.netflix.ninja" },
  { label: "Max", pkg: "com.wbd.stream" },
];

// Samsung app launch on 2022+ Tizen TVs: neither the legacy
// `media_player.play_media { app }` path nor `remote.send_command` with app
// names works — both are silently dropped by the websocket. The only reliable
// path is installing the SmartThings HA integration, which exposes a scene
// per app that we can wire here once available. Until then the apps row is
// omitted for Samsung so the kiosk doesn't pretend.

function buildFireTvProfile(
  entityId: string,
  remoteId: string,
  call: CallFn,
): RemoteProfile {
  const sendAdb = (command: string) =>
    call("androidtv", "adb_command", { command });
  const adbKeyFor: Record<Exclude<NavKey, "apps">, string> = {
    up: "UP",
    down: "DOWN",
    left: "LEFT",
    right: "RIGHT",
    ok: "CENTER",
    back: "BACK",
    home: "HOME",
  };
  void entityId;
  void remoteId;
  return {
    kind: "firetv",
    navKey: (k) =>
      k === "apps"
        ? sendAdb("monkey -p com.amazon.tv.launcher 1")
        : sendAdb(adbKeyFor[k]),
    volumeUp: () => sendAdb("VOLUME_UP"),
    volumeDown: () => sendAdb("VOLUME_DOWN"),
    playPause: () => call("media_player", "media_play_pause"),
    apps: FIRE_TV_APPS.map((a) => ({
      label: a.label,
      launch: () => sendAdb(`monkey -p ${a.pkg} 1`),
    })),
    powerOn: () => call("media_player", "turn_on"),
    powerOff: () => call("media_player", "turn_off"),
  };
}

function buildSamsungProfile(
  remoteId: string | null,
  call: CallFn,
): RemoteProfile {
  // 2022+ Samsung Tizen TVs don't accept the legacy
  // `media_player.play_media { send_key }` path — that returns 200 but the TV
  // ignores it. The HA Samsung integration exposes a sibling `remote.*`
  // entity that accepts `remote.send_command` with KEY_* names; that is the
  // working path. Volume + power still go through the media_player entity
  // because those services are well supported on Samsung core.
  const sendKey = (command: string) => {
    if (!remoteId) {
      // Surface a real error rather than silently no-op'ing so the kiosk
      // error banner tells the user what to fix in HA.
      return Promise.reject(
        new Error(
          "No sibling remote.* entity found for this Samsung TV. " +
            "Reload the Samsung TV integration in HA so the remote entity is created.",
        ),
      );
    }
    return call("remote", "send_command", { entity_id: remoteId, command });
  };
  const samsungKeyFor: Record<NavKey, string> = {
    up: "KEY_UP",
    down: "KEY_DOWN",
    left: "KEY_LEFT",
    right: "KEY_RIGHT",
    ok: "KEY_ENTER",
    back: "KEY_RETURN",
    home: "KEY_HOME",
    apps: "KEY_HOME", // Smart Hub doubles as the apps screen on Samsung
  };
  return {
    kind: "samsung",
    navKey: (k) => sendKey(samsungKeyFor[k]),
    volumeUp: () => call("media_player", "volume_up"),
    volumeDown: () => call("media_player", "volume_down"),
    playPause: () => sendKey("KEY_PLAY"),
    apps: [],
    powerOn: () => call("media_player", "turn_on"),
    powerOff: () => call("media_player", "turn_off"),
  };
}

function buildGenericProfile(remoteId: string, call: CallFn): RemoteProfile {
  const sendKey = (command: string) =>
    call("remote", "send_command", { entity_id: remoteId, command });
  const dpadKeyFor: Record<NavKey, string> = {
    up: "DPAD_UP",
    down: "DPAD_DOWN",
    left: "DPAD_LEFT",
    right: "DPAD_RIGHT",
    ok: "DPAD_CENTER",
    back: "BACK",
    home: "HOME",
    apps: "MENU",
  };
  return {
    kind: "generic",
    navKey: (k) => sendKey(dpadKeyFor[k]),
    volumeUp: () => call("media_player", "volume_up"),
    volumeDown: () => call("media_player", "volume_down"),
    playPause: () => call("media_player", "media_play_pause"),
    apps: [],
    powerOn: () => call("media_player", "turn_on"),
    powerOff: () => call("media_player", "turn_off"),
  };
}

// Detect which remote profile applies to a given media_player. Order matters:
// Fire TV first by entity_id prefix (the AndroidTV integration follows a
// `media_player.fire_tv_*` / `media_player.androidtv_*` convention), then
// Samsung by the user's naming heuristics. Falls back to a generic remote
// when a sibling `remote.*` entity exists.
function detectProfileKind(
  entity: HAState,
  remoteEntity: HAState | undefined,
): RemoteProfile["kind"] | null {
  const id = entity.entity_id;
  if (/^media_player\.(fire_tv|androidtv|android_tv)/.test(id)) {
    return "firetv";
  }
  if (/^media_player\..*(oled|frame|samsung|qn\d+|q[ln]\d+)/i.test(id)) {
    return "samsung";
  }
  if (remoteEntity) return "generic";
  return null;
}

// Renders a TV remote pad (app shortcuts, D-pad, nav, volume, power) for any
// supported media_player. Profile selection picks the right HA services per
// brand so the same UI works for Fire TV (ADB), Samsung (send_key), and any
// other remote integration that exposes a sibling `remote.*` entity.
function RemoteControls({
  entity,
  states,
  call,
}: {
  entity: HAState;
  states: HAState[];
  call: CallFn;
}) {
  const suffix = entity.entity_id.split(".")[1] ?? "";
  // HA disambiguates duplicate entity ids with `_2`, `_3`, ... suffixes when
  // multiple integrations claim the same name. The sibling `remote.*` entity
  // is usually unique (only the Samsung integration creates one), so it sits
  // at the base name without a numeric suffix. Try exact match first, then
  // fall back to stripping a trailing `_<digits>`.
  const baseSuffix = suffix.replace(/_\d+$/, "");
  const remoteEntity =
    states.find((s) => s.entity_id === `remote.${suffix}`) ??
    states.find((s) => s.entity_id === `remote.${baseSuffix}`);
  const kind = detectProfileKind(entity, remoteEntity);
  if (!kind) return null;
  const profile: RemoteProfile =
    kind === "firetv"
      ? buildFireTvProfile(
          entity.entity_id,
          remoteEntity?.entity_id ?? "",
          call,
        )
      : kind === "samsung"
        ? buildSamsungProfile(remoteEntity?.entity_id ?? null, call)
        : buildGenericProfile(remoteEntity?.entity_id ?? "", call);
  const off =
    entity.state === "off" ||
    entity.state === "standby" ||
    entity.state === "unavailable";

  const PadButton = ({
    label,
    icon: Icon,
    nav,
    className = "",
  }: {
    label: string;
    icon: typeof Play;
    nav: NavKey;
    className?: string;
  }) => (
    <Button
      variant="outline"
      aria-label={label}
      title={label}
      className={`wall-btn h-12 ${className}`}
      onClick={() => profile.navKey(nav)}
    >
      <Icon className="w-5 h-5" />
    </Button>
  );

  return (
    <div className="space-y-3 p-4 rounded-xl bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.12)]">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--cream-muted)]">Remote</span>
        {off && (
          <Button
            variant="outline"
            className="wall-btn-active h-9 text-xs"
            onClick={() => profile.powerOn()}
          >
            <Power className="w-4 h-4 mr-1" /> Wake
          </Button>
        )}
      </div>

      {profile.apps.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {profile.apps.map((app) => (
            <Button
              key={app.label}
              variant="outline"
              className="wall-btn h-14 text-xs px-1 leading-tight whitespace-normal"
              onClick={() => app.launch()}
            >
              {app.label}
            </Button>
          ))}
        </div>
      )}

      {/* D-pad: 3x3 grid with arrows around a center OK */}
      <div className="grid grid-cols-3 gap-2">
        <div />
        <PadButton label="Up" icon={ArrowUp} nav="up" />
        <div />
        <PadButton label="Left" icon={ArrowLeft} nav="left" />
        <Button
          variant="outline"
          aria-label="OK"
          title="OK"
          className="wall-btn-active h-12 font-semibold"
          onClick={() => profile.navKey("ok")}
        >
          OK
        </Button>
        <PadButton label="Right" icon={ArrowRight} nav="right" />
        <div />
        <PadButton label="Down" icon={ArrowDown} nav="down" />
        <div />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <PadButton label="Back" icon={Undo2} nav="back" />
        <Button
          variant="outline"
          aria-label="Play / Pause"
          title="Play / Pause"
          className="wall-btn h-12"
          onClick={() => profile.playPause()}
        >
          <Play className="w-5 h-5" />
        </Button>
        <PadButton label="Home" icon={HomeIcon} nav="home" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          aria-label="Volume down"
          title="Volume down"
          className="wall-btn h-12"
          onClick={() => profile.volumeDown()}
        >
          <Minus className="w-4 h-4 mr-1" />
          <Volume1 className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          aria-label="Apps"
          title="Apps"
          className="wall-btn h-12"
          onClick={() => profile.navKey("apps")}
        >
          <MenuIcon className="w-4 h-4 mr-1" /> Apps
        </Button>
        <Button
          variant="outline"
          aria-label="Volume up"
          title="Volume up"
          className="wall-btn h-12"
          onClick={() => profile.volumeUp()}
        >
          <Plus className="w-4 h-4 mr-1" />
          <Volume2 className="w-4 h-4" />
        </Button>
      </div>

      {!off && (
        <Button
          variant="outline"
          className="wall-btn w-full h-12 mt-1 text-red-200 border-red-500/40 hover:bg-red-500/10"
          onClick={() => profile.powerOff()}
        >
          <Power className="w-4 h-4 mr-2" /> Power Off
        </Button>
      )}
    </div>
  );
}

function RunButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof Play;
  onClick: () => void;
}) {
  return (
    <Button
      size="lg"
      onClick={onClick}
      className="wall-btn-active w-full h-16 text-base"
      variant="outline"
    >
      <Icon className="w-5 h-5 mr-2" />
      {label}
    </Button>
  );
}

