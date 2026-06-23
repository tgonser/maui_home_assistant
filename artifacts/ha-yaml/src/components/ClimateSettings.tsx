import { useState } from "react";
import { motion } from "framer-motion";
import { haCallService } from "@/lib/ha";
import type { HAState } from "@/lib/ha";

type Setpoint = {
  entity_id: string;
  label: string;
  hint?: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
};

const TEMP_SETPOINTS: { section: string; rows: Setpoint[] }[] = [
  {
    section: "Temperature Setpoints (°F)",
    rows: [
      {
        entity_id: "input_number.maui_temp_owners_awesome",
        label: "Owners Home — Solar Awesome",
        hint: "AC target when owners are home and solar is in the 'awesome' range (above the awesome threshold). Best comfort setpoint — solar is covering everything.",
        unit: "°F",
        min: 65,
        max: 85,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_visitors_awesome",
        label: "Visitors — Solar Awesome",
        hint: "AC target when guests are staying and solar is in the 'awesome' range. Slightly more conservative than owners mode.",
        unit: "°F",
        min: 65,
        max: 85,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_vacation_awesome",
        label: "Vacation — Solar Awesome",
        hint: "AC target when the house is empty and solar is awesome. House is unoccupied so a warmer setpoint is fine — just keeps humidity in check.",
        unit: "°F",
        min: 65,
        max: 85,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_owners_good",
        label: "Owners Home — Solar Good",
        hint: "AC target when owners are home and solar is in the 'good' range (between the good and awesome thresholds). Still comfortable, slightly warmer than awesome mode.",
        unit: "°F",
        min: 65,
        max: 85,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_visitors_good",
        label: "Visitors — Solar Good",
        hint: "AC target when guests are staying and solar is in the 'good' range.",
        unit: "°F",
        min: 65,
        max: 85,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_vacation_good",
        label: "Vacation — Solar Good",
        hint: "AC target when the house is empty and solar is good. House is unoccupied so comfort isn't the priority.",
        unit: "°F",
        min: 65,
        max: 85,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_owners_mod",
        label: "Owners Home — Moderate",
        hint: "AC target when owners are home but solar is below the 'good' threshold. Warmer setpoint to reduce battery drain.",
        unit: "°F",
        min: 65,
        max: 85,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_visitors_mod",
        label: "Visitors — Moderate",
        hint: "AC target when guests are staying but solar is moderate. Balances comfort against battery conservation.",
        unit: "°F",
        min: 65,
        max: 85,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_vacation_mod",
        label: "Vacation — Moderate",
        hint: "AC target when the house is empty and solar is moderate. Humidity protection only — warmer is fine.",
        unit: "°F",
        min: 65,
        max: 85,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_inactive",
        label: "Outside Active Window (all modes)",
        hint: "Setback temperature used before 9am and after 9pm HST, regardless of mode. Automation is inactive during these hours so this is a light hold.",
        unit: "°F",
        min: 65,
        max: 85,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_protect",
        label: "Protect / Peak Hours (all modes)",
        hint: "Used during peak rate hours (5–9pm) and when battery is critically low. AC backs off to this temperature to avoid expensive grid draw and protect battery longevity.",
        unit: "°F",
        min: 65,
        max: 90,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_boardroom_max",
        label: "Boardroom Maximum Cap",
        hint: "Hard upper limit for the boardroom/office mini-split. Prevents that unit from being set too warm even in conservative modes — it runs hotter than the rest of the house.",
        unit: "°F",
        min: 65,
        max: 85,
        step: 1,
      },
    ],
  },
  {
    section: "Thresholds",
    rows: [
      {
        entity_id: "input_number.maui_solar_awesome",
        label: "Solar 'Awesome' Threshold",
        hint: "Minimum total solar output (kW) to qualify as 'awesome'. Above this, the most aggressive (coolest) temperature setpoints apply.",
        unit: "kW",
        min: 1,
        max: 30,
        step: 1,
      },
      {
        entity_id: "input_number.maui_solar_good",
        label: "Solar 'Good' Threshold",
        hint: "Minimum solar output (kW) to qualify as 'good'. Between this and the awesome threshold, mid-tier setpoints apply. Below this is 'moderate'.",
        unit: "kW",
        min: 1,
        max: 30,
        step: 1,
      },
      {
        entity_id: "input_number.maui_batt_good",
        label: "Battery 'Good' Threshold",
        hint: "Battery state of charge (%) considered healthy. Above this, normal setpoints apply even when solar is low — the battery has enough reserve to cover the load.",
        unit: "%",
        min: 50,
        max: 100,
        step: 5,
      },
      {
        entity_id: "input_number.maui_batt_protect",
        label: "Battery Protect Threshold",
        hint: "Battery charge (%) that triggers protect mode. Below this, all units back off to the protect setpoint to stop draining the battery further.",
        unit: "%",
        min: 5,
        max: 50,
        step: 5,
      },
      {
        entity_id: "input_number.maui_grid_protect_kw",
        label: "Vacation Grid Draw Limit",
        hint: "Vacation mode only: if net grid draw exceeds this, AC backs off to 82°F. Set to 0 to trigger on any grid use at all. Owners and Visitors modes ignore this — they can draw from grid freely.",
        unit: "kW",
        min: 0,
        max: 10,
        step: 0.5,
      },
    ],
  },
];

function SetpointRow({
  sp,
  states,
  onChanged,
}: {
  sp: Setpoint;
  states: HAState[];
  onChanged: () => void;
}) {
  const entity = states.find((s) => s.entity_id === sp.entity_id);
  const current = entity ? parseFloat(entity.state) : null;
  const [busy, setBusy] = useState(false);
  const [localValue, setLocalValue] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const display = localValue ?? current;

  const set = async (v: number) => {
    if (busy) return;
    const clamped = Math.min(sp.max, Math.max(sp.min, v));
    setLocalValue(clamped);
    setBusy(true);
    await haCallService("input_number", "set_value", {
      entity_id: sp.entity_id,
      value: clamped,
    });
    setBusy(false);
    setLocalValue(null);
    setTimeout(onChanged, 600);
  };

  const missing = entity === undefined;

  return (
    <div className={`rounded-xl wall-tile ${missing ? "opacity-40" : ""}`}>
      <div className="flex items-center justify-between py-3 px-4 gap-4">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <div className="text-sm font-medium truncate">{sp.label}</div>
          {sp.hint && (
            <button
              type="button"
              onClick={() => setShowHint((v) => !v)}
              className={`shrink-0 w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center transition-colors ${showHint ? "bg-[var(--brass)] text-black" : "bg-white/10 text-[var(--cream-muted)] hover:bg-white/20"}`}
              aria-label="Show description"
            >
              i
            </button>
          )}
          {missing && (
            <div className="text-[10px] text-[var(--cream-muted)] mt-0.5">
              not in HA
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={busy || missing || display === null || display <= sp.min}
            onClick={() => display !== null && set(display - sp.step)}
            className="w-9 h-9 rounded-lg wall-tile flex items-center justify-center text-lg font-light disabled:opacity-30 hover:wall-tile--active transition-all"
            aria-label={`Decrease ${sp.label}`}
          >
            −
          </button>
          <div className="w-20 text-center">
            {display !== null ? (
              <span className="text-xl font-semibold tabular-nums">
                {display}
                <span className="text-xs font-normal ml-0.5 text-[var(--cream-muted)]">
                  {sp.unit}
                </span>
              </span>
            ) : (
              <span className="text-sm text-[var(--cream-muted)]">—</span>
            )}
          </div>
          <button
            type="button"
            disabled={busy || missing || display === null || display >= sp.max}
            onClick={() => display !== null && set(display + sp.step)}
            className="w-9 h-9 rounded-lg wall-tile flex items-center justify-center text-lg font-light disabled:opacity-30 hover:wall-tile--active transition-all"
            aria-label={`Increase ${sp.label}`}
          >
            +
          </button>
        </div>
      </div>
      {showHint && sp.hint && (
        <div className="px-4 pb-3 text-xs text-[var(--cream-muted)] leading-relaxed border-t border-white/5 pt-2">
          {sp.hint}
        </div>
      )}
    </div>
  );
}

export function ClimateSettings({
  states,
  onChanged,
}: {
  states: HAState[];
  onChanged: () => void;
}) {
  const missingIds = TEMP_SETPOINTS.flatMap((s) => s.rows)
    .filter((sp) => !states.find((s) => s.entity_id === sp.entity_id))
    .map((sp) => sp.entity_id);
  const anyMissing = missingIds.length > 0;

  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-8 max-w-2xl"
    >
      {anyMissing && (
        <div className="wall-tile rounded-xl p-4 text-sm space-y-2 border border-[var(--brass)]/30">
          <div className="font-semibold text-[var(--brass)]">
            ⚠ {missingIds.length} helper{missingIds.length !== 1 ? "s" : ""} not found in HA
          </div>
          <p className="text-[var(--cream-muted)] leading-relaxed">
            These entity IDs are expected but missing from the current HA state. Check that the names match exactly (HA converts spaces to underscores automatically).
          </p>
          <pre className="text-xs bg-black/30 rounded-lg p-3 overflow-x-auto leading-relaxed text-[var(--cream)]">{missingIds.join("\n")}</pre>
          <p className="text-[var(--cream-muted)] leading-relaxed">
            If they don&apos;t exist yet, add them to your HA{" "}
            <code className="text-xs bg-black/20 px-1 rounded">
              configuration.yaml
            </code>{" "}
            and restart Home Assistant.
          </p>
          <pre className="text-xs bg-black/30 rounded-lg p-3 overflow-x-auto leading-relaxed text-[var(--cream)]">{`input_number:
  maui_temp_owners_awesome:
    name: "Maui: Owners Home - Solar Awesome"
    min: 65
    max: 85
    step: 1
    unit_of_measurement: "°F"
    initial: 72
  maui_temp_visitors_awesome:
    name: "Maui: Visitors - Solar Awesome"
    min: 65
    max: 85
    step: 1
    unit_of_measurement: "°F"
    initial: 74
  maui_temp_vacation_awesome:
    name: "Maui: Vacation - Solar Awesome"
    min: 65
    max: 85
    step: 1
    unit_of_measurement: "°F"
    initial: 80
  maui_solar_awesome:
    name: "Maui: Solar Awesome Threshold (kW)"
    min: 1
    max: 30
    step: 1
    unit_of_measurement: "kW"
    initial: 14
  maui_temp_owners_good:
    name: "Maui: Owners Home - Solar Good"
    min: 65
    max: 85
    step: 1
    unit_of_measurement: "°F"
    initial: 74
  maui_temp_visitors_good:
    name: "Maui: Visitors - Solar Good"
    min: 65
    max: 85
    step: 1
    unit_of_measurement: "°F"
    initial: 76
  maui_temp_vacation_good:
    name: "Maui: Vacation - Solar Good"
    min: 65
    max: 85
    step: 1
    unit_of_measurement: "°F"
    initial: 80
  maui_temp_owners_mod:
    name: "Maui: Owners Home - Moderate"
    min: 65
    max: 85
    step: 1
    unit_of_measurement: "°F"
    initial: 79
  maui_temp_visitors_mod:
    name: "Maui: Visitors - Moderate"
    min: 65
    max: 85
    step: 1
    unit_of_measurement: "°F"
    initial: 81
  maui_temp_vacation_mod:
    name: "Maui: Vacation - Moderate"
    min: 65
    max: 85
    step: 1
    unit_of_measurement: "°F"
    initial: 84
  maui_temp_inactive:
    name: "Maui: Outside Active Window"
    min: 65
    max: 85
    step: 1
    unit_of_measurement: "°F"
    initial: 82
  maui_temp_protect:
    name: "Maui: Protect / Peak Mode"
    min: 65
    max: 90
    step: 1
    unit_of_measurement: "°F"
    initial: 84
  maui_temp_boardroom_max:
    name: "Maui: Boardroom Max Cap"
    min: 65
    max: 85
    step: 1
    unit_of_measurement: "°F"
    initial: 78
  maui_solar_good:
    name: "Maui: Solar Good Threshold (kW)"
    min: 1
    max: 30
    step: 1
    unit_of_measurement: "kW"
    initial: 10
  maui_batt_good:
    name: "Maui: Battery Good Threshold (%)"
    min: 50
    max: 100
    step: 5
    unit_of_measurement: "%"
    initial: 80
  maui_batt_protect:
    name: "Maui: Battery Protect Threshold (%)"
    min: 5
    max: 50
    step: 5
    unit_of_measurement: "%"
    initial: 25
  maui_grid_protect_kw:
    name: "Maui: Vacation Grid Draw Limit (kW)"
    min: 0
    max: 10
    step: 0.5
    unit_of_measurement: "kW"
    initial: 0`}</pre>
        </div>
      )}

      {TEMP_SETPOINTS.map(({ section, rows }) => (
        <section key={section}>
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--cream-muted)] mb-3">
            {section}
          </div>
          <div className="space-y-2">
            {rows.map((sp) => (
              <SetpointRow
                key={sp.entity_id}
                sp={sp}
                states={states}
                onChanged={onChanged}
              />
            ))}
          </div>
        </section>
      ))}
    </motion.div>
  );
}
