import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { Moon, Sun, Upload, Download, Activity, Plug, LayoutGrid, ClipboardList } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConnectDialog } from "@/components/ConnectDialog";
import { SurveyDialog } from "@/components/SurveyDialog";
import { useHAStore, haTest } from "@/lib/ha";

export function TopBar() {
  const { resolvedTheme, setTheme } = useTheme();
  const { yamls, setYaml } = useStore();
  const { url, token, status, config, setStatus } = useHAStore();
  const [connectOpen, setConnectOpen] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);

  useEffect(() => {
    if (url && token && status === "disconnected") {
      setStatus("connecting");
      haTest().then((res) => {
        if (res.ok) setStatus("connected");
        else setStatus("error", res.error);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = () => {
    const combined = Object.entries(yamls)
      .map(([k, v]) => `# == ${k.toUpperCase()} ==\n${v}`)
      .join("\n\n");
    const blob = new Blob([combined], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ha-studio-config.yaml";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".yaml,.yml";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          const sections = content.split(
            /# == (ENTITIES|AREAS|AUTOMATIONS|SCRIPTS|DASHBOARD) ==/i,
          );
          if (sections.length > 1) {
            for (let i = 1; i < sections.length; i += 2) {
              const key = sections[i].toLowerCase() as keyof typeof yamls;
              const val = sections[i + 1].trim();
              if (key in yamls) setYaml(key, val);
            }
          } else {
            setYaml("entities", content);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const isLive = !!url && !!token;
  const dotClass =
    status === "connected"
      ? "bg-emerald-500"
      : status === "connecting"
        ? "bg-amber-400"
        : status === "error"
          ? "bg-red-500"
          : "bg-emerald-500";
  const pingClass =
    status === "connected"
      ? "bg-emerald-400"
      : status === "connecting"
        ? "bg-amber-300"
        : status === "error"
          ? "bg-red-400"
          : "bg-emerald-400";
  const statusLabel = isLive
    ? status === "connected"
      ? `Live: ${config?.location_name ?? "Home Assistant"}`
      : status === "connecting"
        ? "Connecting..."
        : status === "error"
          ? "HA: connection error"
          : "Live: Home Assistant"
    : "Connected: Local Simulator";

  return (
    <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <div className="bg-primary text-primary-foreground p-1.5 rounded-md">
          <Activity className="w-5 h-5" />
        </div>
        <h1 className="font-bold text-lg tracking-tight">HA YAML Studio</h1>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setConnectOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 hover:bg-muted transition-colors"
          data-testid="status-pill"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pingClass} opacity-75`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotClass}`}
            ></span>
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {statusLabel}
          </span>
        </button>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setConnectOpen(true)}
              >
                <Plug className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Connect to Home Assistant</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
                  window.location.href = `${base}/wall`;
                }}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open Wall view (tablet)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSurveyOpen(true)}
                disabled={!isLive || status !== "connected"}
              >
                <ClipboardList className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Run HA survey (read-only inventory)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleImport}>
                <Upload className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Import YAML</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleExport}>
                <Download className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export YAML</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle theme</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ConnectDialog open={connectOpen} onOpenChange={setConnectOpen} />
      <SurveyDialog open={surveyOpen} onClose={() => setSurveyOpen(false)} />
    </div>
  );
}
