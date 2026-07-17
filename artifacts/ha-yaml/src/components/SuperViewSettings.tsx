import { useMemo, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { X, Search, Check } from "lucide-react";
import type { HAState } from "@/lib/ha";
import { CoolingMatrix } from "./CoolingMatrix";

export type SuperViewSlot =
  | "weather"
  | "atriumClimate"
  | "atriumTemp"
  | "solar"
  | "energyUse"
  | "powerwall"
  | "tvMediaPlayer"
  | "tvRemote"
  | "lastMotionCamera";

export type SuperViewOverrides = Partial<Record<SuperViewSlot, string>>;

type Store = {
  overrides: SuperViewOverrides;
  setOverride: (slot: SuperViewSlot, entityId: string | null) => void;
  reset: () => void;
};

export const useSuperViewOverrides = create<Store>()(
  persist(
    (set) => ({
      overrides: {},
      setOverride: (slot, entityId) =>
        set((s) => {
          const next = { ...s.overrides };
          if (entityId) next[slot] = entityId;
          else delete next[slot];
          return { overrides: next };
        }),
      reset: () => set({ overrides: {} }),
    }),
    { name: "ha-yaml:superview-overrides" },
  ),
);

type SlotSpec = {
  slot: SuperViewSlot;
  label: string;
  hint: string;
  domains: string[];
  filter?: (s: HAState) => boolean;
};

const SLOTS: SlotSpec[] = [
  {
    slot: "weather",
    label: "Weather",
    hint: "Used for the big weather tile + temperature trend.",
    domains: ["weather"],
  },
  {
    slot: "atriumClimate",
    label: "Atrium climate",
    hint: "Thermostat for the atrium temp tile (preferred over a sensor).",
    domains: ["climate"],
  },
  {
    slot: "atriumTemp",
    label: "Atrium temperature sensor",
    hint: "Used if no climate is set. Should be a temperature sensor.",
    domains: ["sensor"],
    filter: (s) =>
      s.attributes.device_class === "temperature" ||
      ["°F", "°C"].includes(
        (s.attributes.unit_of_measurement as string | undefined) ?? "",
      ),
  },
  {
    slot: "solar",
    label: "Solar production",
    hint: "Sensor reporting current solar production (W or kW).",
    domains: ["sensor"],
    filter: (s) => {
      const u = (s.attributes.unit_of_measurement as string | undefined) ?? "";
      return /W$|kW$/.test(u) || s.attributes.device_class === "power";
    },
  },
  {
    slot: "energyUse",
    label: "Energy usage",
    hint: "Sensor reporting current home / grid power consumption.",
    domains: ["sensor"],
    filter: (s) => {
      const u = (s.attributes.unit_of_measurement as string | undefined) ?? "";
      return /W$|kW$/.test(u) || s.attributes.device_class === "power";
    },
  },
  {
    slot: "powerwall",
    label: "Powerwall battery",
    hint: "Battery percentage sensor.",
    domains: ["sensor"],
    filter: (s) =>
      s.attributes.device_class === "battery" ||
      (s.attributes.unit_of_measurement as string | undefined) === "%",
  },
  {
    slot: "tvMediaPlayer",
    label: "Atrium TV (media player)",
    hint: "Used for power, volume, play/pause, source.",
    domains: ["media_player"],
  },
  {
    slot: "tvRemote",
    label: "Atrium TV (remote, optional)",
    hint: "If your TV has a remote.* entity, prefer it for the d-pad. Otherwise leave blank — Android TV ADB commands will be used.",
    domains: ["remote"],
  },
  {
    slot: "lastMotionCamera",
    label: "Default camera tile",
    hint: "Camera shown when there's no recent motion (or to lock the tile to one camera).",
    domains: ["camera"],
  },
];

function EntityPicker({
  states,
  spec,
  value,
  onChange,
}: {
  states: HAState[];
  spec: SlotSpec;
  value: string | undefined;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const candidates = useMemo(() => {
    const inDomain = states.filter((s) =>
      spec.domains.includes(s.entity_id.split(".")[0]),
    );
    const filtered = spec.filter ? inDomain.filter(spec.filter) : inDomain;
    if (!q) return filtered.slice(0, 200);
    const needle = q.toLowerCase();
    return filtered
      .filter(
        (s) =>
          s.entity_id.toLowerCase().includes(needle) ||
          ((s.attributes.friendly_name as string | undefined) ?? "")
            .toLowerCase()
            .includes(needle),
      )
      .slice(0, 200);
  }, [states, spec, q]);

  const selected = value ? states.find((s) => s.entity_id === value) : undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs uppercase tracking-wider text-stone-300">
          {spec.label}
        </label>
        {value && (
          <button
            onClick={() => onChange(null)}
            className="text-[10px] uppercase text-amber-400 hover:text-amber-300"
          >
            clear
          </button>
        )}
      </div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-3 py-2 rounded-lg bg-stone-900/60 border border-stone-700 hover:border-amber-700 transition"
      >
        {selected ? (
          <div>
            <div className="text-sm text-amber-100">
              {(selected.attributes.friendly_name as string | undefined) ??
                selected.entity_id}
            </div>
            <div className="text-[11px] text-stone-400 font-mono">
              {selected.entity_id}
            </div>
          </div>
        ) : value ? (
          <div className="text-sm text-rose-300 font-mono">
            {value} (not currently in states)
          </div>
        ) : (
          <div className="text-sm text-stone-400 italic">
            Auto-detect — click to override
          </div>
        )}
        <div className="text-[10px] text-stone-500 mt-1">{spec.hint}</div>
      </button>
      {open && (
        <div className="rounded-lg bg-stone-950/80 border border-stone-700 p-2 space-y-2">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-stone-900 border border-stone-700">
            <Search className="w-3.5 h-3.5 text-stone-500" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-sm text-stone-100 outline-none placeholder:text-stone-600"
            />
          </div>
          <div className="max-h-64 overflow-auto space-y-1">
            {candidates.length === 0 ? (
              <div className="text-xs text-stone-500 px-2 py-3 text-center">
                No matching entities.
              </div>
            ) : (
              candidates.map((s) => (
                <button
                  key={s.entity_id}
                  onClick={() => {
                    onChange(s.entity_id);
                    setOpen(false);
                    setQ("");
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-md hover:bg-stone-800 flex items-center gap-2 ${
                    value === s.entity_id ? "bg-stone-800" : ""
                  }`}
                >
                  {value === s.entity_id ? (
                    <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <div className="w-3.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-stone-100 truncate">
                      {(s.attributes.friendly_name as string | undefined) ??
                        s.entity_id}
                    </div>
                    <div className="text-[11px] text-stone-500 font-mono truncate">
                      {s.entity_id} · {s.state}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SuperViewSettings({
  open,
  onClose,
  states,
}: {
  open: boolean;
  onClose: () => void;
  states: HAState[];
}) {
  const { overrides, setOverride, reset } = useSuperViewOverrides();

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl bg-stone-900 border border-stone-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-stone-900 border-b border-stone-800">
          <div>
            <h2 className="text-lg font-semibold text-amber-100">
              Super View entities
            </h2>
            <p className="text-xs text-stone-400">
              Pick the exact entity for each tile. Leave blank to auto-detect by
              name.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-stone-800 text-stone-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <CoolingMatrix states={states} />
          <div className="border-t border-stone-800" />
          {SLOTS.map((spec) => (
            <EntityPicker
              key={spec.slot}
              spec={spec}
              states={states}
              value={overrides[spec.slot]}
              onChange={(id) => setOverride(spec.slot, id)}
            />
          ))}
          <div className="pt-2 flex justify-between">
            <button
              onClick={reset}
              className="text-xs text-stone-400 hover:text-rose-300"
            >
              Reset all to auto-detect
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
