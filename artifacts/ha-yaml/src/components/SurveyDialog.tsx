import { useState } from "react";
import { X, Download, Loader2, ClipboardCopy, Check } from "lucide-react";
import { runSurvey, buildAllReports } from "@/lib/survey";

export function SurveyDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [step, setStep] = useState("");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, string> | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (!open) return null;

  const start = async () => {
    setStatus("running");
    setError(null);
    setReports(null);
    setActiveFile(null);
    const res = await runSurvey((s, p) => {
      setStep(s);
      setPct(p);
    });
    if (!res.ok || !res.data) {
      setStatus("error");
      setError(res.error ?? "Unknown error");
      return;
    }
    const built = buildAllReports(res.data);
    setReports(built);
    setActiveFile(Object.keys(built)[0] ?? null);
    setStatus("done");
    setPct(100);
  };

  const downloadOne = (name: string, content: string) => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    if (!reports) return;
    for (const [name, content] of Object.entries(reports)) {
      downloadOne(name, content);
    }
  };

  const copy = async (name: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(name);
    setTimeout(() => setCopied((c) => (c === name ? null : c)), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl h-[90vh] flex flex-col rounded-2xl bg-stone-900 border border-stone-700 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 bg-stone-900 border-b border-stone-800">
          <div>
            <h2 className="text-lg font-semibold text-amber-100">HA Survey</h2>
            <p className="text-xs text-stone-400">
              Read-only inventory of your Home Assistant. Generates 6 markdown
              files for design / automation work.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-stone-800 text-stone-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {status === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
            <p className="text-stone-300 max-w-lg">
              This will read your HA states, area/device/entity registries,
              automations, scripts, scenes, and dashboards. No writes. Takes
              5–30 seconds depending on instance size.
            </p>
            <button
              onClick={start}
              className="px-6 py-3 rounded-lg bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium"
            >
              Run survey
            </button>
          </div>
        )}

        {status === "running" && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
            <div className="text-stone-200">{step}</div>
            <div className="w-80 h-2 bg-stone-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 text-center">
            <div className="text-rose-300 font-medium">Survey failed</div>
            <pre className="text-xs text-rose-200 bg-rose-950/40 rounded p-3 max-w-2xl whitespace-pre-wrap">
              {error}
            </pre>
            <button
              onClick={start}
              className="px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-amber-50"
            >
              Try again
            </button>
          </div>
        )}

        {status === "done" && reports && activeFile && (
          <div className="flex-1 flex min-h-0">
            <div className="w-64 border-r border-stone-800 bg-stone-950/50 overflow-auto">
              <div className="p-3">
                <button
                  onClick={downloadAll}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium mb-3"
                >
                  <Download className="w-4 h-4" />
                  Download all
                </button>
                {Object.keys(reports).map((name) => (
                  <button
                    key={name}
                    onClick={() => setActiveFile(name)}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs font-mono mb-1 ${
                      activeFile === name
                        ? "bg-amber-900/40 text-amber-100"
                        : "text-stone-400 hover:bg-stone-800"
                    }`}
                  >
                    {name}
                    <div className="text-[10px] opacity-60">
                      {(reports[name].length / 1024).toFixed(1)} KB
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between px-4 py-2 border-b border-stone-800 bg-stone-900">
                <div className="text-xs text-stone-400 font-mono">
                  {activeFile}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copy(activeFile, reports[activeFile])}
                    className="px-3 py-1.5 rounded-md text-xs bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center gap-1.5"
                  >
                    {copied === activeFile ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <ClipboardCopy className="w-3 h-3" /> Copy
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => downloadOne(activeFile, reports[activeFile])}
                    className="px-3 py-1.5 rounded-md text-xs bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center gap-1.5"
                  >
                    <Download className="w-3 h-3" /> Download
                  </button>
                </div>
              </div>
              <pre className="flex-1 overflow-auto p-4 text-xs text-stone-200 font-mono whitespace-pre-wrap leading-relaxed">
                {reports[activeFile]}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
