import { useState } from "react";
import { haCall, type HAState } from "@/lib/ha";
import { buildDiagnostics, diagnosticGroups, type DiagnosticGroup } from "@/lib/diagnostics";

const labels: Record<DiagnosticGroup, string> = {
  battery: "Battery controls and readings",
  climate: "Thermostats",
  solar: "Solar and energy",
  stormPrep: "Storm Prep configuration and status",
};

export function DiagnosticsExport() {
  const [groups, setGroups] = useState<DiagnosticGroup[]>([...diagnosticGroups]);
  const [snapshot, setSnapshot] = useState<ReturnType<typeof buildDiagnostics> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const text = snapshot ? JSON.stringify(snapshot, null, 2) : "";

  async function prepare() {
    setBusy(true);
    setError("");
    setSnapshot(null);
    setReviewed(false);
    setDownloaded(false);
    try {
      const result = await haCall<HAState[]>("/api/states");
      if (!result.ok) throw new Error("Could not read Home Assistant states. Check the connection and try again.");
      if (!Array.isArray(result.data) || !result.data.every(s =>
        s && typeof s.entity_id === "string" && typeof s.state === "string" &&
        s.attributes && typeof s.attributes === "object" && !Array.isArray(s.attributes))) {
        throw new Error("Home Assistant returned an unexpected states response.");
      }
      const next = buildDiagnostics(result.data, groups);
      if (!next.entity_count) throw new Error("No matching entities found for the selected categories.");
      setSnapshot(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to prepare diagnostics.");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!snapshot || !reviewed) return;
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `wall-diagnostics-${snapshot.captured_at.replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setDownloaded(true);
  }

  return (
    <section className="space-y-3 border-b border-stone-800 pb-5" aria-labelledby="diagnostics-title">
      <h3 id="diagnostics-title" className="text-sm font-medium uppercase tracking-wider text-stone-300">Export diagnostics</h3>
      <p className="text-sm text-stone-400">Prepare a fresh, read-only snapshot for troubleshooting. Nothing changes in Home Assistant. The file stays on your device until you choose to share it.</p>
      <p className="text-xs text-amber-200">Entity names, readings and settings may reveal household details. Credentials, approval tokens and location attributes are excluded. Review the exact file below before sharing.</p>
      <fieldset disabled={busy} className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Include in diagnostics</legend>
        {diagnosticGroups.map(group => (
          <label key={group} className="flex items-center gap-2 text-sm text-stone-300">
            <input type="checkbox" checked={groups.includes(group)} onChange={e => {
              setGroups(current => e.target.checked ? [...current, group] : current.filter(g => g !== group));
              setSnapshot(null);
              setReviewed(false);
              setDownloaded(false);
            }} />
            {labels[group]}
          </label>
        ))}
      </fieldset>
      <button type="button" onClick={prepare} disabled={busy || !groups.length} className="wall-btn px-4 py-2 rounded-lg text-sm disabled:opacity-40">
        {busy ? "Reading states…" : "Prepare preview"}
      </button>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {snapshot && (
        <div className="space-y-3">
          <p className="text-sm text-stone-300">{snapshot.entity_count} entities · Captured {new Date(snapshot.captured_at).toLocaleString()}</p>
          <textarea aria-label="Exact diagnostic file preview" readOnly value={text} spellCheck={false} className="w-full h-64 rounded-lg bg-black/30 border border-stone-700 p-3 font-mono text-xs text-stone-300" />
          <p className="text-xs text-stone-400">{snapshot.limitations}</p>
          <label className="flex items-center gap-2 text-sm text-stone-300">
            <input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />
            I have reviewed this snapshot and am ready to download it.
          </label>
          <button type="button" onClick={download} disabled={!reviewed} className="wall-btn px-4 py-2 rounded-lg text-sm disabled:opacity-40">Download diagnostics</button>
          {downloaded && <p role="status" className="text-sm text-stone-300">Download requested. On iPhone, save the file to Files if prompted, then attach the JSON file in this chat. Nothing is uploaded automatically.</p>}
        </div>
      )}
    </section>
  );
}
