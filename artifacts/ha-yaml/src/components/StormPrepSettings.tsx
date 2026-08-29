import { useEffect, useState } from "react";
import { haCallService, type HAState } from "@/lib/ha";
import {
  validateControlTarget,
  getStormPrepSettings,
  getCandidateBatteryControls,
  getStormPrepStatus,
  hasCompleteStormPrepDualHelperSet,
} from "@/lib/stormPrep";
import { Check, Save, ShieldCheck, AlertTriangle } from "lucide-react";
import { StormPrepTile } from "./StormPrepTile";

export function StormPrepSettings({
  states,
  onChanged,
}: {
  states: HAState[];
  onChanged: () => void | Promise<void>;
}) {
  const settings = getStormPrepSettings(states);
  const candidates = getCandidateBatteryControls(states);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [form, setForm] = useState(settings);
  const settingsJson = JSON.stringify(settings);
  const formJson = JSON.stringify(form);
  const hasChanges = JSON.stringify(form) !== JSON.stringify(settings);

  const status = getStormPrepStatus(states);

  useEffect(() => {
    if (!dirty) setForm(settings);
  }, [dirty, settingsJson]);

  useEffect(() => {
    if (dirty && formJson === settingsJson) setDirty(false);
  }, [dirty, formJson, settingsJson]);

  const updateForm = (next: Partial<typeof form>) => {
    setDirty(true);
    setForm((current) => ({ ...current, ...next }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const calls: {id: string, val: string | number, type: "text" | "num"}[] = [];
      const addText = (id: string, current: string, next: string) => {
        if (current !== next) calls.push({ id, val: next, type: "text" });
      };
      const addNum = (id: string, current: number, next: number) => {
        if (current !== next) calls.push({ id, val: next, type: "num" });
      };
      const controlChanged =
        settings.controlEntity !== form.controlEntity ||
        settings.controlValue !== form.controlValue ||
        settings.verifiedControl !== form.controlEntity;
      const control2Changed =
        settings.controlEntity2 !== form.controlEntity2 ||
        settings.controlValue2 !== form.controlValue2 ||
        settings.verifiedControl2 !== form.controlEntity2;

      addText("input_text.maui_storm_prep_weather_entity", settings.weatherEntity, form.weatherEntity);
      addText("input_text.maui_storm_prep_alert_entity", settings.alertEntity, form.alertEntity);
      addText("input_text.maui_storm_prep_notify_service", settings.notifyService, form.notifyService);
      addNum("input_number.maui_storm_prep_rain_threshold", settings.rainThreshold, form.rainThreshold);
      addNum("input_number.maui_storm_prep_low_sun_days", settings.lowSunDays, form.lowSunDays);
      addNum("input_number.maui_storm_prep_duration_hours", settings.durationHours, form.durationHours);

      // Invalidate changed verified pairs before writing either bank. If any
      // later HA call fails, a partially saved pair cannot remain verified.
      if (controlChanged && settings.verifiedControl) {
        calls.push({
          id: "input_text.maui_storm_prep_verified_control",
          val: "",
          type: "text",
        });
      }
      if (control2Changed && settings.verifiedControl2) {
        calls.push({
          id: "input_text.maui_storm_prep_verified_control_2",
          val: "",
          type: "text",
        });
      }
      addText("input_text.maui_storm_prep_control_entity", settings.controlEntity, form.controlEntity);
      addText("input_text.maui_storm_prep_control_value", settings.controlValue, form.controlValue);
      addText("input_text.maui_storm_prep_control_entity_2", settings.controlEntity2, form.controlEntity2);
      addText("input_text.maui_storm_prep_control_value_2", settings.controlValue2, form.controlValue2);
      if (controlChanged) {
        calls.push({
          id: "input_text.maui_storm_prep_verified_control",
          val: form.controlEntity,
          type: "text",
        });
      }
      if (control2Changed) {
        calls.push({
          id: "input_text.maui_storm_prep_verified_control_2",
          val: form.controlEntity2,
          type: "text",
        });
      }

      for (const call of calls) {
        const domain = call.type === "text" ? "input_text" : "input_number";
        const res = await haCallService(domain, "set_value", { entity_id: call.id, value: call.val });
        if (!res.ok) throw new Error(`Save failed for ${call.id}: ${res.error}`);
      }
      setForm((current) => ({
        ...current,
        verifiedControl: current.controlEntity,
        verifiedControl2: current.controlEntity2,
      }));
      await onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Storm-prep settings could not be saved");
    } finally {
      setSaving(false);
    }
  };

  const selectedCandidate = candidates.find(c => c.entity_id === form.controlEntity);
  const isCandidateValid = !!selectedCandidate;
  const validation = validateControlTarget(selectedCandidate, form.controlValue);
  const selectedCandidate2 = candidates.find(c => c.entity_id === form.controlEntity2);
  const isCandidate2Valid = !!selectedCandidate2;
  const validation2 = form.controlEntity2 || form.controlValue2
    ? validateControlTarget(selectedCandidate2, form.controlValue2)
    : { valid: true };
  const controlsDistinct =
    !form.controlEntity2 || form.controlEntity !== form.controlEntity2;
  const controlsValid = validation.valid && validation2.valid && controlsDistinct;

  const isLocked = status.pending || status.active || status.recoveryRequired;

  // Render setup required if entities missing
  const hasEntities = states.some(s => s.entity_id.startsWith("input_text.maui_storm_prep_weather_entity"));
  const hasDualControlPackage = hasCompleteStormPrepDualHelperSet(states);
  if (!hasEntities) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-stone-300 border-b border-stone-800 pb-2">
          <ShieldCheck className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-medium uppercase tracking-wider">Storm Prep</h3>
        </div>
        <div className="p-4 rounded-lg bg-stone-900 border border-stone-800 text-sm text-stone-400">
          Package entities are missing. Setup required in Home Assistant.
        </div>
      </div>
    );
  }

  if (!hasDualControlPackage) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-stone-300 border-b border-stone-800 pb-2">
          <ShieldCheck className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-medium uppercase tracking-wider">Storm Prep</h3>
        </div>
        <div className="p-4 rounded-lg bg-amber-950/50 border border-amber-900/50 text-sm text-amber-100 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Storm Prep controls are unavailable until the separately installed Home Assistant package is updated for the required dual-battery transaction.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StormPrepTile states={states} onChanged={onChanged} />
      <div className="flex items-center justify-between border-b border-stone-800 pb-2">
        <div className="flex items-center gap-2 text-stone-300">
          <ShieldCheck className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-medium uppercase tracking-wider">Storm Prep Controls</h3>
        </div>
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={saving || !controlsValid || isLocked}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-amber-700 hover:bg-amber-600 text-amber-50 text-xs font-medium disabled:opacity-50 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save"}
          </button>
        )}
      </div>
      
      {isLocked && (
        <div className="p-3 rounded-lg bg-amber-950/50 border border-amber-900/50 text-amber-200 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Settings are locked while protection is active, pending, or requires recovery.
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-200 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-400 mb-1">Battery Bank 1 Control</label>
            <select 
              value={form.controlEntity}
              onChange={e => updateForm({ controlEntity: e.target.value })}
              disabled={isLocked}
              className="w-full bg-stone-900/60 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-700 appearance-none"
            >
              <option value="">Select an entity...</option>
              {form.controlEntity && !isCandidateValid && (
                <option value={form.controlEntity}>{form.controlEntity} (Invalid)</option>
              )}
              {candidates.map(c => (
                <option key={c.entity_id} value={c.entity_id}>
                  {(c.attributes.friendly_name as string) || c.entity_id}
                </option>
              ))}
            </select>
            {!isCandidateValid && form.controlEntity && (
              <div className="mt-1 text-[11px] text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Entity not found or not a valid battery control.
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-400 mb-1">Bank 1 Target</label>
            <input 
              value={form.controlValue}
              onChange={e => updateForm({ controlValue: e.target.value })}
              disabled={isLocked}
              placeholder="e.g. 100 or on"
              className={`w-full bg-stone-900/60 border ${!validation.valid && form.controlValue ? 'border-red-500' : 'border-stone-700'} rounded-lg px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-700`}
            />
            {!validation.valid && form.controlValue && (
               <div className="mt-1 text-[11px] text-red-400 flex items-center gap-1">
                 <AlertTriangle className="w-3 h-3" /> {validation.reason}
               </div>
            )}
          </div>

          <div className="border-t border-stone-800 pt-3 space-y-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-400 mb-1">Battery Bank 2 Control (Optional)</label>
              <select
                value={form.controlEntity2}
                onChange={e => updateForm({
                  controlEntity2: e.target.value,
                  ...(e.target.value ? {} : { controlValue2: "" }),
                })}
                disabled={isLocked}
                className={`w-full bg-stone-900/60 border ${!controlsDistinct ? "border-red-500" : "border-stone-700"} rounded-lg px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-700 appearance-none`}
              >
                <option value="">No second bank (legacy setup)</option>
                {form.controlEntity2 && !isCandidate2Valid && (
                  <option value={form.controlEntity2}>{form.controlEntity2} (Invalid)</option>
                )}
                {candidates.map(c => (
                  <option key={c.entity_id} value={c.entity_id}>
                    {(c.attributes.friendly_name as string) || c.entity_id}
                  </option>
                ))}
              </select>
              {!controlsDistinct && (
                <div className="mt-1 text-[11px] text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Select a different control for each battery bank.
                </div>
              )}
              {form.controlEntity2 && !isCandidate2Valid && (
                <div className="mt-1 text-[11px] text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Entity not found or not a valid battery control.
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-400 mb-1">Bank 2 Target</label>
              <input
                value={form.controlValue2}
                onChange={e => updateForm({ controlValue2: e.target.value })}
                disabled={isLocked || !form.controlEntity2}
                placeholder={form.controlEntity2 ? "e.g. 100 or on" : "Select a second bank first"}
                className={`w-full bg-stone-900/60 border ${!validation2.valid && form.controlValue2 ? "border-red-500" : "border-stone-700"} rounded-lg px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-700 disabled:opacity-50`}
              />
              {!validation2.valid && (form.controlEntity2 || form.controlValue2) && (
                <div className="mt-1 text-[11px] text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {validation2.reason}
                </div>
              )}
            </div>
            {selectedCandidate2 && (
              <div className="p-3 bg-stone-900/40 rounded-lg border border-stone-800 text-sm text-stone-200">
                <div className="text-xs text-stone-400 mb-1">Bank 2 Current Value</div>
                <span className="font-mono text-xs text-stone-500">{selectedCandidate2.entity_id}</span><br/>
                Current: <span className="font-medium text-amber-100">{selectedCandidate2.state}</span>
              </div>
            )}
          </div>

          <div className="p-3 bg-stone-900/40 rounded-lg border border-stone-800">
            <div className="text-xs text-stone-400 mb-1">Selected Control Status</div>
            {selectedCandidate ? (
              <div className="text-sm text-stone-200">
                <span className="font-mono text-xs text-stone-500">{selectedCandidate.entity_id}</span><br/>
                Current: <span className="font-medium text-amber-100">{selectedCandidate.state}</span>
                <div className="mt-2 text-[10px] text-emerald-400/80 bg-emerald-950/20 p-1.5 rounded border border-emerald-900/30">
                  <Check className="w-3 h-3 inline mr-1" />
                  Valid writable battery control (matches reserve/backup semantics)
                </div>
              </div>
            ) : (
              <div className="text-sm text-stone-500 italic">No valid control selected</div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-400 mb-1">Weather Entity</label>
            <input 
              value={form.weatherEntity}
              onChange={e => updateForm({ weatherEntity: e.target.value })}
              disabled={isLocked}
              className="w-full bg-stone-900/60 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-700"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-400 mb-1">Alert Entity (Optional)</label>
            <input 
              value={form.alertEntity}
              onChange={e => updateForm({ alertEntity: e.target.value })}
              disabled={isLocked}
              className="w-full bg-stone-900/60 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-700"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-400 mb-1">Notify Service (Optional)</label>
            <input 
              value={form.notifyService}
              onChange={e => updateForm({ notifyService: e.target.value })}
              disabled={isLocked}
              className="w-full bg-stone-900/60 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-700"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">Rain Thr (in)</label>
              <input 
                type="number"
                min={0.5}
                max={8}
                step="0.1"
                value={form.rainThreshold}
                onChange={e => updateForm({ rainThreshold: parseFloat(e.target.value) || 0 })}
                disabled={isLocked}
                className="w-full bg-stone-900/60 border border-stone-700 rounded-lg px-2 py-2 text-sm text-stone-100 outline-none focus:border-amber-700"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">Low Sun (days)</label>
              <input 
                type="number"
                min={2}
                max={3}
                value={form.lowSunDays}
                onChange={e => updateForm({ lowSunDays: parseInt(e.target.value) || 0 })}
                disabled={isLocked}
                className="w-full bg-stone-900/60 border border-stone-700 rounded-lg px-2 py-2 text-sm text-stone-100 outline-none focus:border-amber-700"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">Dur. (hrs)</label>
              <input 
                type="number"
                min={24}
                max={120}
                step={6}
                value={form.durationHours}
                onChange={e => updateForm({ durationHours: parseInt(e.target.value) || 0 })}
                disabled={isLocked}
                className="w-full bg-stone-900/60 border border-stone-700 rounded-lg px-2 py-2 text-sm text-stone-100 outline-none focus:border-amber-700"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}