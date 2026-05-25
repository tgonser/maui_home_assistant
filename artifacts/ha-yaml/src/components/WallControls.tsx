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
  // state (playing, title, source). Resolve it so the header pill and
  // transport reflect what's actually playing.
  const masterId = entity.attributes.master as string | undefined;
  const controller =
    d === "media_player" && masterId
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
          <StatePill entity={controller} />

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

// Map raw HA state to a friendlier label. Media players need extra care
// because Bluesound reports `state: "idle"` whenever the active source is
// line-in or the TV hub passthrough — even while audio is actively playing.
function displayState(entity: HAState): string {
  const raw = entity.state;
  const cap = (s: string) =>
    s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
  if (domainOf(entity.entity_id) !== "media_player") {
    return raw.includes("_")
      ? raw.split("_").map(cap).join(" ")
      : cap(raw);
  }
  if (raw === "off") return "Off";
  if (raw === "standby") return "Standby";
  if (raw === "playing") return "Playing";
  if (raw === "paused") return "Paused";
  if (raw === "buffering") return "Buffering";
  if (raw === "unavailable") return "Unavailable";
  if (raw === "unknown") return "Unknown";
  // raw is typically "idle" at this point. Bluesound players streaming a
  // line-in / TV passthrough source report idle even while audio plays, so
  // look for tell-tale signs of an active stream.
  const title = entity.attributes.media_title as string | undefined;
  const source = entity.attributes.source as string | undefined;
  const groupMembers =
    (entity.attributes.group_members as string[] | undefined) ?? [];
  if (title && title.trim().length > 0) return "Streaming";
  if (source && groupMembers.length > 1) return `Streaming · ${source}`;
  if (source && source.toLowerCase() !== "idle") return source;
  return "Idle";
}

function StatePill({ entity }: { entity: HAState }) {
  const unit =
    (entity.attributes.unit_of_measurement as string | undefined) ?? "";
  const label = displayState(entity);
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
  // Volume + mute are per-zone, so they always come from the opened entity.
  const volume = entity.attributes.volume_level as number | undefined;
  const muted = entity.attributes.is_volume_muted as boolean | undefined;
  const title = controller.attributes.media_title as string | undefined;
  const artist = controller.attributes.media_artist as string | undefined;
  const sourceList = controller.attributes.source_list as
    | string[]
    | undefined;
  const currentSource = controller.attributes.source as string | undefined;
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

      <div className="grid grid-cols-4 gap-2">
        <Button
          variant="outline"
          className="wall-btn h-14"
          onClick={() => call("media_player", "media_previous_track")}
        >
          <SkipBack className="w-5 h-5" />
        </Button>
        <Button
          variant="outline"
          className="wall-btn-active h-14 col-span-2"
          onClick={() =>
            call("media_player", playing ? "media_pause" : "media_play")
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
          onClick={() => call("media_player", "media_next_track")}
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
            <Button
              variant="outline"
              className="wall-btn"
              onClick={() =>
                call("media_player", off ? "turn_on" : "turn_off")
              }
            >
              {off ? "Turn on" : "Turn off"}
            </Button>
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
            value={currentSource ?? ""}
            onChange={(e) =>
              call("media_player", "select_source", { source: e.target.value })
            }
            className="w-full bg-[rgba(0,0,0,0.4)] border border-[rgba(232,193,120,0.2)] text-[var(--cream)] rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cream)]/60"
          >
            {currentSource === undefined && (
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
  // target, or the target itself points to our coordinator via `master`.
  // The latter updates immediately on Bluesound while the former lags.
  const realJoined = (id: string) => {
    if (groupMembers.includes(id)) return true;
    const target = states.find((s) => s.entity_id === id);
    const targetMaster = target?.attributes.master as string | undefined;
    if (targetMaster && targetMaster === coordinatorId) return true;
    return false;
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
      await call("media_player", "unjoin", { entity_id: id });
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
          onClick={() => call("media_player", "unjoin")}
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

// Samsung Tizen app IDs (2020+ Smart TVs). IDs occasionally vary by firmware
// year; if a button does nothing, ask the user to check the working ID via
// SmartThings or `tizenbrew`/SmartThings app inspector and update here.
const SAMSUNG_APPS: { label: string; appId: string }[] = [
  { label: "YouTube TV", appId: "3201707014489" },
  { label: "Apple TV", appId: "3201807016597" },
  { label: "Netflix", appId: "3201907018807" },
  { label: "Max", appId: "3202112023754" },
];

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

function buildSamsungProfile(call: CallFn): RemoteProfile {
  const sendKey = (key: string) =>
    call("media_player", "play_media", {
      media_content_type: "send_key",
      media_content_id: key,
    });
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
    playPause: () => call("media_player", "media_play_pause"),
    apps: SAMSUNG_APPS.map((a) => ({
      label: a.label,
      launch: () =>
        call("media_player", "play_media", {
          media_content_type: "app",
          media_content_id: a.appId,
        }),
    })),
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
  const remoteEntity = states.find(
    (s) => s.entity_id === `remote.${suffix}`,
  );
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
        ? buildSamsungProfile(call)
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

