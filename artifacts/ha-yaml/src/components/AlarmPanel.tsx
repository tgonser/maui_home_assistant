import { useEffect, useMemo, useRef, useState } from "react";
import {
  ShieldCheck, ShieldAlert, ShieldOff, Moon, Home as HomeIcon, Unlock, Lock, RefreshCw,
  Search, Loader2, AlertTriangle, CheckCircle2, X, Eye, EyeOff, ChevronDown, ChevronUp, WifiOff,
} from "lucide-react";
import { haCallService, haStormPrepSecurity, type HAState } from "@/lib/ha";
import {
  discoverAlarmSystems, companionHealth, keypadInfo, panelTone, prettyState, zoneBadges,
  filterZones, availableActions, validCode, writeGuard, activeIssues, parseAcks, pruneAcks,
  ackStorageKey, COMPANION_KEYS, type AlarmSystem, type AlarmAction, type Tone, type ZoneFilter,
  type AckMap, type ActiveIssue,
} from "@/lib/alarm";

const TONE: Record<Tone, string> = {
  ok: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
  warn: "bg-amber-500/15 text-amber-200 border-amber-500/40",
  alert: "bg-red-500/20 text-red-100 border-red-500/60",
  unknown: "bg-[rgba(140,130,120,0.18)] text-[var(--cream-muted)] border-dashed border-[rgba(232,193,120,0.35)]",
  neutral: "bg-[rgba(201,153,74,0.14)] text-[var(--brass-bright)] border-[rgba(232,193,120,0.3)]",
};
const card = "rounded-2xl bg-[rgba(0,0,0,0.25)] border border-[rgba(232,193,120,0.14)]";
const ACTION_ICON = { alarm_arm_home: HomeIcon, alarm_arm_away: Lock, alarm_arm_night: Moon, alarm_disarm: Unlock } as const;
const CONFIRM_TIMEOUT_MS = 90_000;

function Badge({ tone, children, testId }: { tone: Tone; children: React.ReactNode; testId?: string }) {
  return (
    <span data-testid={testId} className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${TONE[tone]}`}>
      {tone === "unknown" && <span aria-hidden>?</span>}
      {children}
    </span>
  );
}

type Props = {
  states: HAState[];
  connected: boolean;
  lastOkMs: number | null;
  connection: string;
  onRefresh: () => Promise<void> | void;
};

export function AlarmPanel({ states, connected, lastOkMs, connection, onRefresh }: Props) {
  const systems = useMemo(() => discoverAlarmSystems(states), [states]);
  const [secure, setSecure] = useState<boolean | null>(null);
  const [secureErr, setSecureErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let off = false;
    haStormPrepSecurity().then((r) => {
      if (off) return;
      if (r.ok) setSecure(r.data.secureTransport);
      else { setSecure(false); setSecureErr(r.error); }
    });
    const id = window.setInterval(() => setNow(Date.now()), 2000);
    return () => { off = true; window.clearInterval(id); };
  }, []);

  // Local acknowledgements — this wall only.
  const storageKey = ackStorageKey(connection);
  const [acks, setAcks] = useState<AckMap>(() => {
    try { return parseAcks(localStorage.getItem(storageKey)); } catch { return {}; }
  });
  const allIssues = useMemo(() => systems.flatMap(activeIssues), [systems]);
  useEffect(() => {
    // Only prune against fresh, connected data so a blip doesn't forget acks.
    if (!connected || states.length === 0) return;
    setAcks((prev) => {
      const next = pruneAcks(prev, allIssues);
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [allIssues, connected, states.length]);
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(acks)); } catch { /* storage optional */ }
  }, [acks, storageKey]);
  const ack = (ids: string[]) => setAcks((p) => { const n = { ...p }; for (const i of ids) n[i] = Date.now(); return n; });
  const unack = (id: string) => setAcks((p) => { const n = { ...p }; delete n[id]; return n; });

  const doRefresh = async () => {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };

  const ageS = lastOkMs === null ? null : Math.max(0, Math.round((now - lastOkMs) / 1000));
  const stale = ageS === null || ageS > 20;

  if (states.length === 0 && !connected) {
    return (
      <div className="space-y-4" data-testid="alarm-loading">
        {[0, 1].map((i) => <div key={i} className={`${card} h-40 animate-pulse`} />)}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="alarm-panel">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2 text-xs text-[var(--cream-muted)]" data-testid="text-alarm-freshness">
          {connected ? <span className={`w-2 h-2 rounded-full ${stale ? "bg-amber-400" : "bg-emerald-400"}`} /> : <WifiOff className="w-4 h-4 text-red-300" />}
          {!connected ? "Offline — showing last known state" : ageS === null ? "Waiting for first update" : `Updated ${ageS}s ago${stale ? " · stale" : ""}`}
        </div>
        <button type="button" data-testid="button-alarm-refresh" onClick={doRefresh} disabled={refreshing}
          className="wall-btn inline-flex items-center gap-2 h-12 px-5 rounded-xl border text-sm disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {secure === false && (
        <div role="alert" data-testid="notice-insecure" className={`p-4 rounded-xl border ${TONE.warn} text-sm flex gap-3`}>
          <ShieldOff className="w-5 h-5 shrink-0" />
          <div>Arming and disarming are disabled: this wall isn't on a secure (HTTPS) connection, so alarm codes can't be entered here. Status below is read-only.{secureErr ? ` (${secureErr})` : ""}</div>
        </div>
      )}

      {systems.length === 0 ? (
        <div className={`${card} p-10 text-center text-[var(--cream-muted)]`} data-testid="alarm-empty">
          <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-base text-[var(--cream)]">No alarm partitions found</p>
          <p className="text-sm mt-1">Looking for <span className="font-mono">alarm_control_panel.*_partition_N</span> entities from Home Assistant.</p>
        </div>
      ) : systems.map((sys) => (
        <SystemCard key={sys.panel.entity_id} sys={sys} secure={secure} connected={connected} lastOkMs={lastOkMs}
          now={now} onRefresh={onRefresh} acks={acks} onAck={ack} onUnack={unack} />
      ))}
    </div>
  );
}

function SystemCard({ sys, secure, connected, lastOkMs, now, onRefresh, acks, onAck, onUnack }: {
  sys: AlarmSystem; secure: boolean | null; connected: boolean; lastOkMs: number | null; now: number;
  onRefresh: () => Promise<void> | void; acks: AckMap; onAck: (ids: string[]) => void; onUnack: (id: string) => void;
}) {
  const p = sys.panel;
  const tone = panelTone(p.state);
  const kp = keypadInfo(sys.keypad);
  const Icon = tone === "alert" ? ShieldAlert : tone === "unknown" ? ShieldOff : ShieldCheck;
  const name = (p.attributes.friendly_name as string | undefined) ?? p.entity_id;
  const issues = activeIssues(sys);
  return (
    <section className="space-y-4" data-testid={`alarm-system-${p.entity_id}`}>
      <div className={`rounded-2xl p-5 sm:p-6 border ${tone === "alert" ? "bg-red-500/15 border-red-500/60" : "bg-[rgba(232,193,120,0.06)] border-[rgba(232,193,120,0.25)]"}`}>
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className={`p-4 rounded-2xl border ${TONE[tone]}`}><Icon className="w-10 h-10" /></div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--cream-muted)]">{name} · Partition {sys.partition}</div>
              <div className="text-3xl sm:text-4xl font-light text-[var(--cream)] mt-1" data-testid={`status-panel-${p.entity_id}`}>{prettyState(p.state)}</div>
              <div className="text-[11px] font-mono text-[var(--cream-muted)] truncate">{p.entity_id}</div>
            </div>
          </div>
          <div className="md:w-[44%] rounded-xl bg-[rgba(10,8,4,0.6)] border border-[rgba(232,193,120,0.2)] px-4 py-3 font-mono" data-testid={`text-keypad-${p.entity_id}`}>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--cream-muted)] font-sans mb-1">Keypad</div>
            <div className="text-lg text-[var(--brass-bright)] tracking-wider break-words">{kp.text ?? (sys.keypad ? "—" : "No keypad sensor")}</div>
            {kp.troubles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">{kp.troubles.map((t) => <Badge key={t} tone="warn">{t}</Badge>)}</div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-5">
          {COMPANION_KEYS.map((k) => {
            const h = companionHealth(k, sys.companions[k]);
            return (
              <div key={k} className={`rounded-xl border px-3 py-2.5 ${TONE[h.tone]}`} data-testid={`status-${k}-${p.entity_id}`} title={h.entity?.entity_id ?? "entity not found"}>
                <div className="text-[10px] uppercase tracking-wider opacity-80">{h.label}</div>
                <div className="text-base font-semibold">{h.value}</div>
              </div>
            );
          })}
        </div>
      </div>

      <ActionBar sys={sys} secure={secure} connected={connected} lastOkMs={lastOkMs} now={now} onRefresh={onRefresh} />
      <IssuesList issues={issues} acks={acks} onAck={onAck} onUnack={onUnack} />
      <ZoneList sys={sys} />
    </section>
  );
}

type Phase =
  | { k: "idle" }
  | { k: "code"; action: AlarmAction }
  | { k: "confirm"; action: AlarmAction }
  | { k: "sending"; action: AlarmAction }
  | { k: "waiting"; action: AlarmAction; since: number }
  | { k: "done"; action: AlarmAction }
  | { k: "timeout"; action: AlarmAction; last: string }
  | { k: "error"; action: AlarmAction; message: string };

function ActionBar({ sys, secure, connected, lastOkMs, now, onRefresh }: {
  sys: AlarmSystem; secure: boolean | null; connected: boolean; lastOkMs: number | null; now: number; onRefresh: () => Promise<void> | void;
}) {
  const p = sys.panel;
  const actions = availableActions(p);
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const lock = useRef(false);
  const guard = writeGuard({ secureTransport: secure, connected, lastOkMs, nowMs: now, panelState: p.state });
  const codeFormat = p.attributes.code_format;
  const name = (p.attributes.friendly_name as string | undefined) ?? p.entity_id;

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; lock.current = false; };
  }, []);

  // Invalidate a pending code/confirm step (and drop the code) if the panel
  // state, entity or connection changes underneath it.
  const pendingSnap = useRef<string | null>(null);
  const snap = `${p.entity_id}|${p.state}|${p.last_changed}|${connected}`;
  const latest = useRef({ snap, secure, connected, lastOkMs, panelState: p.state });
  latest.current = { snap, secure, connected, lastOkMs, panelState: p.state };
  useEffect(() => {
    if (phase.k !== "code" && phase.k !== "confirm") return;
    const action = phase.action;
    const timer = window.setTimeout(() => {
      setCode(""); setShow(false);
      setPhase({ k: "error", action, message: "Code entry expired and was cleared. Start again when ready." });
    }, 60_000);
    return () => window.clearTimeout(timer);
  }, [phase.k]);
  useEffect(() => {
    const pending = phase.k === "code" || phase.k === "confirm";
    if (!pending) { pendingSnap.current = null; return; }
    if (pendingSnap.current === null) { pendingSnap.current = snap; return; }
    if (pendingSnap.current !== snap) {
      pendingSnap.current = null;
      setCode(""); setShow(false);
      setPhase({ k: "error", action: phase.action, message: "Panel state or connection changed — request cancelled and code cleared. Review the current state and start again." });
    }
  }, [phase, snap]);

  // Watch live state for confirmation.
  useEffect(() => {
    if (phase.k !== "waiting") return;
    if (p.state === phase.action.expect) setPhase({ k: "done", action: phase.action });
    else if (now - phase.since > CONFIRM_TIMEOUT_MS) setPhase({ k: "timeout", action: phase.action, last: p.state });
  }, [phase, p.state, now]);

  useEffect(() => {
    if (phase.k !== "waiting") return;
    const id = window.setInterval(() => { void onRefresh(); }, 3000);
    return () => window.clearInterval(id);
  }, [phase.k, onRefresh]);

  const cancel = () => { setCode(""); setShow(false); setPhase({ k: "idle" }); };
  const busy = phase.k === "sending" || phase.k === "waiting";

  const send = async (action: AlarmAction) => {
    if (lock.current) return;
    const c = code;
    setCode(""); setShow(false);
    if (guard.blocked) { setPhase({ k: "error", action, message: guard.reason ?? "Blocked" }); return; }
    lock.current = true;
    setPhase({ k: "sending", action });
    try {
      const sec = await haStormPrepSecurity();
      if (!sec.ok || !sec.data.secureTransport) {
        setPhase({ k: "error", action, message: "Secure connection could not be verified; nothing was sent." });
        return;
      }
      const current = latest.current;
      if (!mounted.current) return;
      const freshGuard = writeGuard({
        secureTransport: sec.data.secureTransport, connected: current.connected,
        lastOkMs: current.lastOkMs, nowMs: Date.now(), panelState: current.panelState,
      });
      if (current.snap !== snap || freshGuard.blocked) {
        setPhase({ k: "error", action, message: "Panel state or connection changed; nothing was sent. Review the current state and start again." });
        return;
      }
      const r = await haCallService("alarm_control_panel", action.service, { entity_id: p.entity_id, code: c });
      if (!r.ok) {
        setPhase({ k: "error", action, message: r.status === 429
          ? "Too many alarm commands. Wait one minute and check the keypad before retrying."
          : `The request was not confirmed (${r.status || "network"}). Check the keypad before retrying; the code may be wrong or the panel busy.` });
        return;
      }
      setPhase({ k: "waiting", action, since: Date.now() });
      await onRefresh();
    } catch {
      setPhase({ k: "error", action, message: "The request could not be confirmed. Check the physical keypad before retrying." });
    } finally {
      lock.current = false;
    }
  };

  return (
    <div className={`${card} p-4 sm:p-5 space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--cream-muted)]">Arm / Disarm</div>
        {guard.blocked && phase.k === "idle" && <div className="text-xs text-amber-200 text-right" data-testid="text-write-blocked">{guard.reason}</div>}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {actions.map((a) => {
          const I = ACTION_ICON[a.service];
          const current = p.state === a.expect;
          return (
            <button key={a.service} type="button" data-testid={`button-${a.service}-${p.entity_id}`}
              disabled={guard.blocked || busy || current || phase.k === "code" || phase.k === "confirm"}
              onClick={() => { setCode(""); setPhase({ k: "code", action: a }); }}
              className={`h-16 rounded-xl border flex items-center justify-center gap-2 text-base font-medium transition disabled:opacity-40 ${
                a.service === "alarm_disarm" ? "border-red-500/50 text-red-100 bg-red-500/10" : current ? "wall-btn-active" : "wall-btn"}`}>
              <I className="w-5 h-5" /> {a.label}{current ? " · now" : ""}
            </button>
          );
        })}
      </div>

      {(phase.k === "code" || phase.k === "confirm") && (
        <div className="rounded-xl border border-[rgba(232,193,120,0.3)] bg-[rgba(10,8,4,0.5)] p-4 space-y-3" data-testid="form-alarm-code">
          <div className="text-[var(--cream)]">
            <span className="font-semibold">{phase.action.label}</span> — {name}
            <div className="text-[11px] font-mono text-[var(--cream-muted)]">{p.entity_id}</div>
          </div>
          {phase.k === "code" ? (
            <form onSubmit={(e) => { e.preventDefault(); if (validCode(code, codeFormat)) setPhase({ k: "confirm", action: phase.action }); }} className="space-y-3">
              <label className="block text-xs uppercase tracking-wider text-[var(--cream-muted)]" htmlFor={`code-${p.entity_id}`}>Alarm code (required every time)</label>
              <div className="flex gap-2">
                <input id={`code-${p.entity_id}`} data-testid="input-alarm-code" autoFocus
                  type={show ? "text" : "password"} inputMode={codeFormat === "number" ? "numeric" : "text"}
                  autoComplete="off" autoCorrect="off" spellCheck={false} name="alarm-code-transient"
                  value={code} onChange={(e) => setCode(e.target.value.slice(0, 12))}
                  className="flex-1 h-14 px-4 rounded-xl bg-[rgba(0,0,0,0.45)] border border-[rgba(232,193,120,0.25)] text-2xl tracking-[0.5em] text-[var(--cream)] tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]" />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide code" : "Show code"} data-testid="button-toggle-code"
                  className="wall-btn w-14 h-14 rounded-xl border flex items-center justify-center">{show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={cancel} data-testid="button-cancel-code" className="wall-btn h-14 rounded-xl border">Cancel</button>
                <button type="submit" disabled={!validCode(code, codeFormat)} data-testid="button-continue-code" className="wall-btn-active h-14 rounded-xl border disabled:opacity-40">Continue</button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className={`p-3 rounded-lg border text-sm ${TONE.warn}`}>
                Send <b>{phase.action.label}</b> to <b>{name}</b> now? The panel will only be reported as {prettyState(phase.action.expect)} once Home Assistant confirms it.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={cancel} data-testid="button-cancel-confirm" className="wall-btn h-14 rounded-xl border">Cancel</button>
                <button type="button" onClick={() => void send(phase.action)} disabled={guard.blocked} data-testid="button-confirm-action"
                  className={`h-14 rounded-xl border font-semibold disabled:opacity-40 ${phase.action.service === "alarm_disarm" ? "border-red-500/60 bg-red-500/20 text-red-100" : "wall-btn-active"}`}>
                  Confirm {phase.action.label}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase.k === "sending" && <Status tone="neutral" icon={<Loader2 className="w-5 h-5 animate-spin" />} text={`Sending ${phase.action.label}…`} />}
      {phase.k === "waiting" && (
        <Status tone="neutral" icon={<Loader2 className="w-5 h-5 animate-spin" />}
          text={`Request accepted. Waiting for the panel to report ${prettyState(phase.action.expect)} — currently ${prettyState(p.state)} (${Math.round((now - phase.since) / 1000)}s).`} />
      )}
      {phase.k === "done" && <Status tone="ok" icon={<CheckCircle2 className="w-5 h-5" />} text={`Confirmed by live state: ${prettyState(phase.action.expect)}. Current state: ${prettyState(p.state)}.`} onClose={cancel} />}
      {phase.k === "timeout" && <Status tone="warn" icon={<AlertTriangle className="w-5 h-5" />} text={`No confirmation after ${CONFIRM_TIMEOUT_MS / 1000}s. Panel still reports ${prettyState(phase.last)}. Check the keypad before retrying.`} onClose={cancel} />}
      {phase.k === "error" && <Status tone="alert" icon={<AlertTriangle className="w-5 h-5" />} text={phase.message} onClose={cancel} />}
    </div>
  );
}

function Status({ tone, icon, text, onClose }: { tone: Tone; icon: React.ReactNode; text: string; onClose?: () => void }) {
  return (
    <div role="status" data-testid="status-alarm-action" className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${TONE[tone]}`}>
      {icon}<div className="flex-1">{text}</div>
      {onClose && <button type="button" onClick={onClose} aria-label="Dismiss" className="p-1"><X className="w-4 h-4" /></button>}
    </div>
  );
}

function IssuesList({ issues, acks, onAck, onUnack }: { issues: ActiveIssue[]; acks: AckMap; onAck: (ids: string[]) => void; onUnack: (id: string) => void }) {
  const [review, setReview] = useState(false);
  if (issues.length === 0) return null;
  const fresh = issues.filter((i) => !acks[i.id]);
  const acked = issues.filter((i) => acks[i.id]);
  return (
    <div className={`${card} p-4 sm:p-5 space-y-3`} data-testid="alarm-issues">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--cream-muted)]">Active issues · {issues.length}</div>
        {fresh.length > 1 && <button type="button" data-testid="button-ack-all" onClick={() => onAck(fresh.map((i) => i.id))} className="wall-btn h-11 px-4 rounded-xl border text-sm">Acknowledge all on this wall</button>}
      </div>
      <p className="text-[11px] text-[var(--cream-muted)]">Acknowledging only hides the alert on this wall. It does not clear the panel, the hardware, or any monitoring-company notification. Still-active items stay listed; a new or changed occurrence reappears.</p>
      {fresh.map((i) => (
        <div key={i.id} className={`flex items-center gap-3 p-3 rounded-xl border ${TONE[i.tone]}`} data-testid={`issue-${i.entityId}-${i.kind}`}>
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div className="flex-1 min-w-0"><b>{i.label}</b> — {i.detail}<div className="text-[11px] font-mono opacity-70 truncate">{i.entityId}</div></div>
          <button type="button" onClick={() => onAck([i.id])} className="wall-btn h-11 px-4 rounded-xl border text-sm shrink-0" data-testid={`button-ack-${i.entityId}-${i.kind}`}>Acknowledge</button>
        </div>
      ))}
      {acked.length > 0 && (
        <div>
          <button type="button" onClick={() => setReview((r) => !r)} data-testid="button-review-acks" className="flex items-center gap-2 text-sm text-[var(--cream-muted)] h-11">
            {review ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} {acked.length} acknowledged, still active
          </button>
          {review && acked.map((i) => (
            <div key={i.id} className="flex items-center gap-3 p-3 mt-2 rounded-xl border border-[rgba(232,193,120,0.15)] text-[var(--cream-muted)]">
              <div className="flex-1 min-w-0"><b className="text-[var(--cream)]">{i.label}</b> — {i.detail} <span className="text-[10px] uppercase tracking-wider ml-1">acknowledged {new Date(acks[i.id]).toLocaleString()}</span></div>
              <button type="button" onClick={() => onUnack(i.id)} className="wall-btn h-11 px-4 rounded-xl border text-sm" data-testid={`button-unack-${i.entityId}-${i.kind}`}>Restore</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const FILTERS: { key: ZoneFilter; label: string }[] = [
  { key: "all", label: "All" }, { key: "open", label: "Open" }, { key: "issues", label: "Issues" }, { key: "bypassed", label: "Bypassed" },
];

function ZoneList({ sys }: { sys: AlarmSystem }) {
  const [filter, setFilter] = useState<ZoneFilter>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const zones = filterZones(sys.zones, filter, q);
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="p-4 flex flex-col md:flex-row gap-3 md:items-center border-b border-[rgba(232,193,120,0.1)]">
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--cream-muted)] shrink-0">Zones · {sys.zones.length}</div>
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cream-muted)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search zone # or name" data-testid="input-zone-search"
            className="w-full h-12 pl-9 pr-3 rounded-xl bg-[rgba(0,0,0,0.35)] border border-[rgba(232,193,120,0.2)] text-[var(--cream)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]" />
        </div>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)} data-testid={`button-filter-${f.key}`}
              className={`h-12 px-4 rounded-xl border text-sm ${filter === f.key ? "wall-btn-active" : "wall-btn"}`}>{f.label}</button>
          ))}
        </div>
      </div>
      {zones.length === 0 ? (
        <div className="p-8 text-center text-sm text-[var(--cream-muted)]" data-testid="zones-empty">
          {sys.zones.length === 0 ? "No zones found for this partition." : "No zones match this filter."}
        </div>
      ) : (
        <div className="divide-y divide-[rgba(232,193,120,0.08)]">
          {zones.map((z) => {
            const id = z.entity.entity_id;
            const expanded = open === id;
            return (
              <div key={id} data-testid={`row-zone-${z.zone}`}>
                <button type="button" onClick={() => setOpen(expanded ? null : id)} className="w-full min-h-[60px] flex items-center gap-3 px-4 py-3 text-left hover:bg-[rgba(232,193,120,0.05)]">
                  <span className="w-12 text-xl font-light tabular-nums text-[var(--brass-bright)]">{z.zone}</span>
                  <span className="flex-1 min-w-0 truncate text-[var(--cream)]">{z.name}</span>
                  <span className="flex flex-wrap gap-1.5 justify-end">{zoneBadges(z).map((b) => <Badge key={b.kind} tone={b.tone} testId={`badge-${b.kind}-${z.zone}`}>{b.label}</Badge>)}</span>
                  {expanded ? <ChevronUp className="w-4 h-4 text-[var(--cream-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--cream-muted)]" />}
                </button>
                {expanded && (
                  <dl className="px-4 pb-4 pl-[76px] grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-[var(--cream-muted)]">
                    <dt>Entity</dt><dd className="font-mono text-[var(--cream)] break-all">{id}</dd>
                    <dt>State</dt><dd className="text-[var(--cream)]">{z.entity.state}</dd>
                    <dt>Last trip</dt><dd className="text-[var(--cream)]">{z.lastTrip ?? "not reported"}</dd>
                    <dt>Last change</dt><dd className="text-[var(--cream)]">{new Date(z.entity.last_changed).toLocaleString()}</dd>
                  </dl>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
