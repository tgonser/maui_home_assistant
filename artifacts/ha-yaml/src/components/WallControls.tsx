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
  Square,
  Wind,
  Sparkles,
  Activity,
  Plus,
  Minus,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { haCallService, type HAState } from "@/lib/ha";

const friendly = (s: HAState) =>
  (s.attributes.friendly_name as string | undefined) ?? s.entity_id;
const domainOf = (id: string) => id.split(".")[0] ?? "";

type Props = {
  entity: HAState | null;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
};

export function WallControls({ entity, onClose, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
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
    await haCallService(domain, service, {
      entity_id: entity.entity_id,
      ...data,
    });
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
          <StatePill entity={entity} />

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
            <MediaControls entity={entity} call={call} />
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

function StatePill({ entity }: { entity: HAState }) {
  const unit =
    (entity.attributes.unit_of_measurement as string | undefined) ?? "";
  return (
    <div className="rounded-xl p-4 bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.12)] flex items-center justify-between">
      <span className="text-xs uppercase tracking-wider text-[var(--cream-muted)]">
        Current state
      </span>
      <span className="text-xl font-semibold tabular-nums text-[var(--brass-bright)]">
        {entity.state}
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

function MediaControls({ entity, call }: { entity: HAState; call: CallFn }) {
  const playing = entity.state === "playing";
  const off = entity.state === "off" || entity.state === "standby";
  const volume = entity.attributes.volume_level as number | undefined;
  const muted = entity.attributes.is_volume_muted as boolean | undefined;
  const title = entity.attributes.media_title as string | undefined;
  const artist = entity.attributes.media_artist as string | undefined;

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
              {Math.round(volume * 100)}%
            </span>
          </div>
          <Slider
            value={[Math.round(volume * 100)]}
            min={0}
            max={100}
            step={1}
            onValueCommit={(v) =>
              call("media_player", "volume_set", {
                volume_level: v[0] / 100,
              })
            }
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

