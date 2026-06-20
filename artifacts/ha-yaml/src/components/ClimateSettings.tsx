import { useState } from "react";
import { motion } from "framer-motion";
import { haCallService } from "@/lib/ha";
import type { HAState } from "@/lib/ha";

type Setpoint = {
  entity_id: string;
  label: string;
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
        entity_id: "input_number.maui_temp_owners_good",
        label: "Owners Home — Solar Good",
        unit: "°F",
        min: 65,
        max: 85,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_visitors_good",
        label: "Visitors — Solar Good",
        unit: "°F",
        min: 65,
        max: 85,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_vacation_good",
        label: "Vacation — Solar Good",
        unit: "°F",
        min: 65,
        max: 85,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_owners_mod",
        label: "Owners Home — Moderate",
        unit: "°F",
        min: 65,
        max: 85,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_visitors_mod",
        label: "Visitors — Moderate",
        unit: "°F",
        min: 65,
        max: 85,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_vacation_mod",
        label: "Vacation — Moderate",
        unit: "°F",
        min: 65,
        max: 85,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_inactive",
        label: "Outside Active Window (all modes)",
        unit: "°F",
        min: 65,
        max: 85,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_protect",
        label: "Protect / Peak Hours (all modes)",
        unit: "°F",
        min: 65,
        max: 90,
        step: 1,
      },
      {
        entity_id: "input_number.maui_temp_boardroom_max",
        label: "Boardroom Maximum Cap",
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
        entity_id: "input_number.maui_solar_good",
        label: "Solar 'Good' Threshold",
        unit: "kW",
        min: 1,
        max: 30,
        step: 1,
      },
      {
        entity_id: "input_number.maui_batt_good",
        label: "Battery 'Good' Threshold",
        unit: "%",
        min: 50,
        max: 100,
        step: 5,
      },
      {
        entity_id: "input_number.maui_batt_protect",
        label: "Battery Protect Threshold",
        unit: "%",
        min: 5,
        max: 50,
        step: 5,
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
    <div
      className={`flex items-center justify-between py-3 px-4 rounded-xl wall-tile gap-4 ${missing ? "opacity-40" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{sp.label}</div>
        {missing && (
          <div className="text-[10px] text-[var(--cream-muted)] mt-0.5">
            Helper not found in HA — see setup instructions
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
  );
}

export function ClimateSettings({
  states,
  onChanged,
}: {
  states: HAState[];
  onChanged: () => void;
}) {
  const anyMissing = TEMP_SETPOINTS.flatMap((s) => s.rows).some(
    (sp) => !states.find((s) => s.entity_id === sp.entity_id),
  );

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
            ⚠ Setup required
          </div>
          <p className="text-[var(--cream-muted)] leading-relaxed">
            Add the following to your HA{" "}
            <code className="text-xs bg-black/20 px-1 rounded">
              configuration.yaml
            </code>{" "}
            and restart Home Assistant, then update the automation variables to
            reference these helpers.
          </p>
          <pre className="text-xs bg-black/30 rounded-lg p-3 overflow-x-auto leading-relaxed text-[var(--cream)]">{`input_number:
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
    initial: 25`}</pre>
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
