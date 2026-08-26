import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ShieldCheck, Check, X, ShieldAlert, Loader2, CloudLightning } from "lucide-react";
import {
  haCallService,
  haStormPrepSecurity,
  haUnlockStormPrep,
  type HAState,
  type StormPrepSecurityState,
} from "@/lib/ha";
import { getStormPrepStatus } from "@/lib/stormPrep";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function formatHawaiiDeadline(value: string): string {
  if (!value) return "";
  const hasOffset = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  const normalized = hasOffset ? value : `${value.replace(" ", "T")}-10:00`;
  const timestamp = new Date(normalized);
  if (Number.isNaN(timestamp.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "Pacific/Honolulu",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(timestamp);
}

export function StormPrepTile({
  states,
  onChanged,
}: {
  states: HAState[];
  onChanged?: () => void | Promise<void>;
}) {
  const status = getStormPrepStatus(states);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasEntities = states.some(s => s.entity_id.startsWith("input_text.maui_storm_prep_weather_entity"));
  const [pin, setPin] = useState("");
  const [securityLoading, setSecurityLoading] = useState(true);
  const [security, setSecurity] = useState<StormPrepSecurityState>({
    pinConfigured: false,
    secureTransport: false,
    unlocked: false,
    expiresAt: null,
  });

  const refreshSecurity = async () => {
    setSecurityLoading(true);
    const result = await haStormPrepSecurity();
    if (result.ok) {
      setSecurity(result.data);
    } else {
      setError(result.error);
    }
    setSecurityLoading(false);
  };

  useEffect(() => {
    if (hasEntities) void refreshSecurity();
  }, [hasEntities]);

  useEffect(() => {
    if (!security.unlocked || !security.expiresAt) return;
    const remaining = new Date(security.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      setSecurity((current) => ({ ...current, unlocked: false }));
      return;
    }
    const timeout = window.setTimeout(() => {
      setSecurity((current) => ({ ...current, unlocked: false }));
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [security.expiresAt, security.unlocked]);

  if (!hasEntities) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="wall-tile col-span-2 row-span-1 p-6 flex flex-col justify-center items-center text-center gap-2"
      >
        <ShieldCheck className="w-6 h-6 text-stone-600" />
        <div className="text-sm font-medium uppercase tracking-wider text-stone-500">Storm Prep</div>
        <div className="text-xs text-stone-600">Setup required in Home Assistant</div>
      </motion.div>
    );
  }

  const handleAction = async (action: string, script: string, vars?: Record<string, unknown>) => {
    setLoading(action);
    setError(null);
    try {
      const res = await haCallService("script", "turn_on", { entity_id: script, variables: vars });
      if (!res.ok) throw new Error(res.error || "Action failed");
      await onChanged?.();
      await sleep(action === "approve" || action === "end" ? 6500 : 1200);
      await onChanged?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Action failed";
      setError(message);
      if (/PIN|unlock|required|HTTPS|secure/i.test(message)) {
        setSecurity((current) => ({ ...current, unlocked: false }));
      }
    } finally {
      setLoading(null);
    }
  };

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading("unlock");
    setError(null);
    const result = await haUnlockStormPrep(pin);
    if (result.ok) {
      setSecurity(result.data);
      setPin("");
    } else {
      setError(result.error);
    }
    setLoading(null);
  };

  const hasFailure = /failed|rejected|unavailable/i.test(status.lastResult);
  const tokenValid = Boolean(status.approvalToken && status.approvalValid);
  const recoveryUrgent =
    status.recoveryRequired && (!status.active || status.recoveryFailed);
  const homeownerUnlocked =
    security.secureTransport && security.pinConfigured && security.unlocked;

  const securityGate = homeownerUnlocked ? null : (
    <div className="rounded-lg border border-amber-700/40 bg-amber-950/25 p-2.5">
      {securityLoading ? (
        <div className="flex items-center gap-2 text-xs text-amber-200">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Checking homeowner controls…
        </div>
      ) : !security.secureTransport ? (
        <div className="text-xs leading-relaxed text-amber-200">
          Storm-prep actions are disabled on plain HTTP. Open this kiosk through
          HTTPS or secure Home Assistant ingress before entering the homeowner PIN.
        </div>
      ) : !security.pinConfigured ? (
        <div className="text-xs leading-relaxed text-amber-200">
          Set a homeowner PIN in the Wall Kiosk add-on options before storm-prep controls can be used.
        </div>
      ) : (
        <form onSubmit={handleUnlock} className="flex gap-2">
          <input
            type="password"
            autoComplete="current-password"
            minLength={6}
            required
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="Homeowner PIN"
            aria-label="Homeowner PIN"
            className="min-w-0 flex-1 rounded-lg border border-stone-700 bg-black/30 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-600"
          />
          <button
            type="submit"
            disabled={loading !== null || pin.length < 6}
            className="wall-btn rounded-lg px-3 py-2 text-xs text-amber-100 disabled:opacity-40"
          >
            {loading === "unlock" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
          </button>
        </form>
      )}
    </div>
  );

  // Determine state for presentation
  let stateTitle = "Storm Protection";
  let stateColor = "text-stone-400";
  let StateIcon = ShieldCheck;
  let bgClass = "wall-tile";

  if (recoveryUrgent) {
    stateTitle = "Recovery Required";
    stateColor = "text-red-400";
    StateIcon = AlertTriangle;
    bgClass = "wall-tile border-red-500/50 bg-red-950/20";
  } else if (status.active) {
    stateTitle = "Active Protection";
    stateColor = "text-amber-400";
    StateIcon = ShieldAlert;
    bgClass = "wall-tile border-amber-500/30";
  } else if (status.pending) {
    stateTitle = "Action Required";
    stateColor = "text-rose-400";
    StateIcon = AlertTriangle;
    bgClass = "wall-tile border-rose-500/50 bg-rose-950/20";
  } else if (hasFailure) {
    stateTitle = "Action Failed";
    stateColor = "text-red-400";
    StateIcon = AlertTriangle;
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`${bgClass} col-span-2 ${homeownerUnlocked ? "row-span-2" : "row-span-3"} p-6 flex flex-col justify-between`}
    >
      <div className="flex items-start justify-between relative z-[1]">
        <div className="flex items-center gap-3">
          <div className="wall-icon-wrap p-3">
            <StateIcon className={`w-6 h-6 ${stateColor}`} />
          </div>
          <div>
            <div className={`text-sm font-medium uppercase tracking-wider ${stateColor}`}>
              {stateTitle}
            </div>
             {recoveryUrgent ? (
              <div className="text-xs text-red-200 mt-1">Manual restore intervention needed</div>
            ) : status.active ? (
              <div className="text-xs text-amber-200 mt-1">{status.proposedAction}</div>
            ) : status.pending ? (
              <div className="text-xs text-rose-200 mt-1">{status.reason} forecasted</div>
             ) : !status.configValid ? (
               <div className="text-xs text-red-400 mt-1">Configuration Invalid</div>
            ) : (
              <div className="text-xs text-stone-400 mt-1">Monitoring forecast</div>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-[1] mt-4">
        {recoveryUrgent ? (
          <div className="space-y-4">
             <div className="p-3 bg-red-950/40 rounded-lg border border-red-500/30">
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-stone-400 text-xs">Last Action</div>
                <div className="text-red-200">Failed: {status.lastResult}</div>
                <div className="text-stone-400 text-xs">Action</div>
                <div className="text-stone-200">End protection and restore standard mode</div>
              </div>
            </div>
             {securityGate}
            {error && <div className="text-xs text-red-400 p-2 bg-red-950/20 rounded">{error}</div>}
            <button
               disabled={loading !== null || !homeownerUnlocked}
              onClick={() => handleAction("end", "script.maui_storm_prep_end")}
              className="w-full wall-btn py-2.5 rounded-xl flex items-center justify-center gap-2 text-red-300 hover:text-red-100"
            >
              {loading === "end" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Retry Safe Restore
            </button>
          </div>
        ) : status.pending ? (
          <div className="space-y-4">
            <div className="p-3 bg-black/30 rounded-lg border border-rose-500/20">
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-stone-400 text-xs">Risk</div>
                <div className="text-rose-200">{status.reason}</div>
                <div className="text-stone-400 text-xs">Window</div>
                <div className="text-stone-200">{status.forecastWindow}</div>
                <div className="text-stone-400 text-xs">Proposed</div>
                <div className="text-amber-200 font-medium">{status.proposedAction}</div>
                {status.approvalExpiresAt && (
                  <>
                    <div className="text-stone-400 text-xs">Expires</div>
                    <div className="text-stone-400 text-xs">{formatHawaiiDeadline(status.approvalExpiresAt)}</div>
                  </>
                )}
              </div>
            </div>
            {securityGate}
            {error && <div className="text-xs text-red-400 p-2 bg-red-950/20 rounded">{error}</div>}
            {!status.configValid && (
              <div className="text-xs text-rose-300 p-2 bg-rose-950/30 rounded">
                The proposed battery control is no longer valid. You can decline this request, but it cannot be approved.
              </div>
            )}
            {!tokenValid && <div className="text-xs text-rose-300 p-2 bg-rose-950/30 rounded">Approval token is missing or expired.</div>}
            <div className="flex gap-3">
              <button
                disabled={loading !== null || !tokenValid || !status.configValid || !homeownerUnlocked}
                onClick={() => handleAction("approve", "script.maui_storm_prep_approve", { approval_token: status.approvalToken })}
                className="flex-1 wall-btn-active py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {loading === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Approve
              </button>
              <button
                disabled={loading !== null || !tokenValid || !homeownerUnlocked}
                onClick={() => handleAction("decline", "script.maui_storm_prep_decline", { approval_token: status.approvalToken })}
                className="flex-1 wall-btn py-2.5 rounded-xl flex items-center justify-center gap-2 text-stone-300 disabled:opacity-40"
              >
                {loading === "decline" ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                Decline
              </button>
            </div>
          </div>
        ) : status.active ? (
          <div className="space-y-4">
             <div className="p-3 bg-black/30 rounded-lg border border-amber-500/20">
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-stone-400 text-xs">Status</div>
                <div className="text-amber-200 font-medium">Protection Engaged</div>
                <div className="text-stone-400 text-xs">Action</div>
                <div className="text-stone-200">{status.proposedAction}</div>
                {status.reviewAt && (
                  <>
                    <div className="text-stone-400 text-xs">Deadline</div>
                     <div className="text-stone-400 text-xs">{formatHawaiiDeadline(status.reviewAt)}</div>
                  </>
                )}
                <div className="text-stone-400 text-xs">Triggered By</div>
                <div className="text-stone-400">{status.triggerSource}</div>
              </div>
            </div>
             {securityGate}
            {error && <div className="text-xs text-red-400 p-2 bg-red-950/20 rounded">{error}</div>}
            <button
               disabled={loading !== null || !homeownerUnlocked}
              onClick={() => handleAction("end", "script.maui_storm_prep_end")}
              className="w-full wall-btn py-2.5 rounded-xl flex items-center justify-center gap-2 text-stone-300"
            >
              {loading === "end" ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              End Protection
            </button>
          </div>
        ) : !status.configValid ? (
          <div className="space-y-4">
            <div className="text-sm text-stone-400 p-3 bg-black/20 rounded-lg border border-red-500/20">
              Battery control entity is missing or invalid. Unlock homeowner controls, then configure and verify one exact control in Settings.
            </div>
            {securityGate}
          </div>
        ) : (
          <div className="space-y-4">
             {hasFailure && (
               <div className="p-2 text-xs text-red-400 bg-red-950/30 rounded border border-red-900/30">
                 Last operation failed. Check logs or verify entity state.
               </div>
             )}
             {error && <div className="text-xs text-red-400 p-2 bg-red-950/20 rounded">{error}</div>}
              {securityGate}
             <div className="flex justify-between items-center text-xs text-stone-500">
               <span>System is idle. No severe weather forecasted.</span>
             </div>
             <button
                disabled={loading !== null || !homeownerUnlocked}
               onClick={() => handleAction("request", "script.maui_storm_prep_manual_request")}
               className="w-full wall-btn py-2.5 rounded-xl flex items-center justify-center gap-2 text-stone-300"
             >
               {loading === "request" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudLightning className="w-4 h-4" />}
               Request Manual Protection
             </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}