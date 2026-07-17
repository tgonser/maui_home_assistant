import { useMemo, useState } from "react";
import { Minus, Plus, Sun } from "lucide-react";
import { haCallService, type HAState } from "@/lib/ha";

const MODES = [
  { key: "owners", label: "Owners" },
  { key: "visitors", label: "Visitors" },
  { key: "vacation", label: "Vacation" },
] as const;

const TIERS = [
  { key: "poor", label: "Poor", range: "≤ 5 kW" },
  { key: "fair", label: "Fair", range: "5–10 kW" },
  { key: "good", label: "Good", range: "10–15 kW" },
  { key: "strong", label: "Strong", range: "15–20 kW" },
  { key: "excellent", label: "Excellent", range: "> 20 kW" },
] as const;

const GROUPS = [
  { key: "master", label: "Master" },
  { key: "sitting", label: "Sitting" },
  { key: "rest", label: "Rest" },
] as const;

const DEFAULTS: Record<string, Record<string, [number, number, number]>> = {
  owners: {
    poor: [84, 84, 84],
    fair: [78, 84, 84],
    good: [76, 76, 84],
    strong: [76, 76, 78],
    excellent: [76, 76, 76],
  },
  visitors: {
    poor: [84, 84, 84],
    fair: [78, 84, 84],
    good: [76, 76, 84],
    strong: [76, 76, 78],
    excellent: [76, 76, 76],
  },
  vacation: {
    poor: [84, 84, 84],
    fair: [80, 84, 84],
    good: [78, 78, 84],
    strong: [78, 78, 80],
    excellent: [78, 78, 78],
  },
};

const entityId = (mode: string, tier: string, group: string) =>
  `input_number.maui_ct_${mode}_${tier}_${group}`;

export function CoolingMatrix({ states }: { states: HAState[] }) {
  const [mode, setMode] = useState<string>("owners");
  const [pending, setPending] = useState<Record<string, number>>({});
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => {
    const m = new Map<string, HAState>();
    for (const s of states)
      if (s.entity_id.startsWith("input_number.maui_ct_"))
        m.set(s.entity_id, s);
    return m;
  }, [states]);

  const helpersPresent = byId.size > 0;

  const valueOf = (id: string): number | null => {
    if (id in pending) return pending[id];
    const st = byId.get(id);
    if (!st) return null;
    const n = parseFloat(st.state);
    return isNaN(n) ? null : Math.round(n);
  };

  const writeValue = async (id: string, v: number): Promise<boolean> => {
    setPending((p) => ({ ...p, [id]: v }));
    let ok = false;
    try {
      const res = await haCallService("input_number", "set_value", {
        entity_id: id,
        value: v,
      });
      ok = (res as { ok?: boolean }).ok !== false;
    } catch {
      ok = false;
    }
    if (!ok) {
      // Roll back the optimistic value so the UI never shows a temperature
      // Home Assistant actually rejected.
      setPending((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      setError("Home Assistant rejected the update — value not saved.");
    } else {
      setError(null);
    }
    return ok;
  };

  const setValue = (id: string, value: number) =>
    writeValue(id, Math.min(84, Math.max(68, value)));

  const seedDefaults = async () => {
    setSeeding(true);
    setError(null);
    let failures = 0;
    try {
      for (const m of MODES)
        for (const t of TIERS)
          for (let g = 0; g < GROUPS.length; g++) {
            const ok = await writeValue(
              entityId(m.key, t.key, GROUPS[g].key),
              DEFAULTS[m.key][t.key][g],
            );
            if (!ok) failures++;
          }
    } finally {
      setSeeding(false);
      if (failures > 0)
        setError(
          `${failures} value(s) could not be saved — check that the matrix helpers exist in Home Assistant.`,
        );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-300 flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5 text-amber-400" /> Cooling matrix
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5">
            AC targets (°F) per solar tier. Peak (5–9pm) always eases to 84°;
            the dew-point floor can raise these.
          </div>
        </div>
      </div>

      {!helpersPresent ? (
        <div className="rounded-lg bg-stone-950/80 border border-stone-700 p-3 text-xs text-stone-400">
          Matrix helpers not found in Home Assistant. Add{" "}
          <span className="font-mono text-amber-300">
            maui_solar_tier_package.yaml
          </span>{" "}
          to your HA packages, restart HA, then reopen this menu.
        </div>
      ) : (
        <>
          <div className="flex gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  mode === m.key
                    ? "bg-amber-700 text-amber-50"
                    : "bg-stone-900/60 border border-stone-700 text-stone-300 hover:border-amber-700"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="rounded-lg bg-stone-950/80 border border-stone-700 overflow-hidden">
            <div className="grid grid-cols-[1.2fr_repeat(3,1fr)] text-[10px] uppercase tracking-wider text-stone-500 border-b border-stone-800">
              <div className="px-3 py-2">Solar tier</div>
              {GROUPS.map((g) => (
                <div key={g.key} className="px-2 py-2 text-center">
                  {g.label}
                </div>
              ))}
            </div>
            {TIERS.map((t) => (
              <div
                key={t.key}
                className="grid grid-cols-[1.2fr_repeat(3,1fr)] items-center border-b border-stone-800/60 last:border-b-0"
              >
                <div className="px-3 py-2">
                  <div className="text-sm text-amber-100">{t.label}</div>
                  <div className="text-[10px] text-stone-500">{t.range}</div>
                </div>
                {GROUPS.map((g) => {
                  const id = entityId(mode, t.key, g.key);
                  const v = valueOf(id);
                  return (
                    <div
                      key={g.key}
                      className="px-1 py-1.5 flex items-center justify-center gap-1"
                    >
                      <button
                        aria-label={`Lower ${t.label} ${g.label}`}
                        disabled={v === null}
                        onClick={() => v !== null && setValue(id, v - 1)}
                        className="p-1.5 rounded-md bg-stone-900 border border-stone-700 text-stone-300 hover:border-amber-700 disabled:opacity-30"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <div className="w-9 text-center text-sm tabular-nums text-stone-100">
                        {v === null ? "—" : `${v}°`}
                      </div>
                      <button
                        aria-label={`Raise ${t.label} ${g.label}`}
                        disabled={v === null}
                        onClick={() => v !== null && setValue(id, v + 1)}
                        className="p-1.5 rounded-md bg-stone-900 border border-stone-700 text-stone-300 hover:border-amber-700 disabled:opacity-30"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {error && (
            <div className="rounded-lg bg-rose-950/40 border border-rose-800 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-stone-500">
              Master = master bedroom · Sitting = sitting room · Rest =
              boardroom, beach room, upper mauka. Atrium / Bar / Kitchen are
              excluded (doors open).
            </div>
            <button
              onClick={seedDefaults}
              disabled={seeding}
              className="shrink-0 ml-3 px-3 py-1.5 rounded-lg text-xs bg-stone-900/60 border border-stone-700 text-stone-300 hover:border-amber-700 disabled:opacity-50"
            >
              {seeding ? "Loading…" : "Load recommended defaults"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
