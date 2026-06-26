import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHAStore, haStates, type HAState } from "@/lib/ha";
import { friendlyName as friendly_ } from "@/lib/display";
import {
  Lightbulb,
  ToggleRight,
  Thermometer,
  Activity,
  Plug,
  Wifi,
  Tv,
  Lock,
  Blinds,
  CircleDot,
  RefreshCw,
  Loader2,
} from "lucide-react";

const DOMAIN_ICONS: Record<string, typeof Lightbulb> = {
  light: Lightbulb,
  switch: ToggleRight,
  climate: Thermometer,
  sensor: Activity,
  binary_sensor: CircleDot,
  media_player: Tv,
  cover: Blinds,
  lock: Lock,
  device_tracker: Wifi,
  person: Wifi,
};

const ON_STATES = new Set([
  "on",
  "open",
  "unlocked",
  "home",
  "playing",
  "active",
  "heat",
  "cool",
  "auto",
]);

function domainOf(entityId: string) {
  return entityId.split(".")[0] ?? "other";
}

const friendly = friendly_;

function unit(s: HAState) {
  return (s.attributes.unit_of_measurement as string | undefined) ?? "";
}

export function LiveTab({ onOpenConnect }: { onOpenConnect: () => void }) {
  const { url, token, status, config } = useHAStore();
  const [states, setStates] = useState<HAState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const refresh = async () => {
    if (!url || !token) return;
    setLoading(true);
    setError(null);
    const res = await haStates();
    setLoading(false);
    if (res.ok) {
      setStates(res.data);
      setLastFetched(new Date());
    } else {
      setError(res.error);
    }
  };

  useEffect(() => {
    if (!url || !token) return;
    refresh();
    const id = window.setInterval(refresh, 8000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, token]);

  const grouped = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const filtered = f
      ? states.filter(
          (s) =>
            s.entity_id.toLowerCase().includes(f) ||
            friendly(s).toLowerCase().includes(f),
        )
      : states;
    const map = new Map<string, HAState[]>();
    for (const s of filtered) {
      const d = domainOf(s.entity_id);
      const arr = map.get(d) ?? [];
      arr.push(s);
      map.set(d, arr);
    }
    return [...map.entries()]
      .map(([domain, items]) => ({
        domain,
        items: items.sort((a, b) => friendly(a).localeCompare(friendly(b))),
      }))
      .sort((a, b) => a.domain.localeCompare(b.domain));
  }, [states, filter]);

  if (!url || !token) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Plug className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-semibold">Bring in your real home</h3>
          <p className="text-sm text-muted-foreground">
            Connect to your Home Assistant instance to see your actual
            entities, areas, and live states alongside the simulated config.
          </p>
          <Button onClick={onOpenConnect} size="lg">
            <Plug className="w-4 h-4 mr-2" />
            Connect to Home Assistant
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">
              {config?.location_name ?? "Home Assistant"}
            </h2>
            {config?.version && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                core {config.version}
              </Badge>
            )}
            {status === "error" && (
              <Badge variant="destructive">Connection error</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {states.length} entities
            {lastFetched &&
              ` · refreshed ${lastFetched.toLocaleTimeString([], { hour12: false })}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter entities..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 w-56"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={refresh}
            disabled={loading}
            className="h-9 w-9"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2">
          {error}
        </div>
      )}

      {states.length === 0 && loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Fetching your home...</span>
        </div>
      )}

      {grouped.map(({ domain, items }) => {
        const Icon = DOMAIN_ICONS[domain] ?? CircleDot;
        return (
          <div key={domain} className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Icon className="w-4 h-4 text-primary" />
              <span className="font-semibold">{domain}</span>
              <span className="text-muted-foreground">({items.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {items.map((s, i) => {
                const on = ON_STATES.has(s.state.toLowerCase());
                return (
                  <motion.div
                    key={s.entity_id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.01, 0.2) }}
                  >
                    <Card
                      className={`p-3 transition-colors ${
                        on
                          ? "bg-primary/5 border-primary/30"
                          : "bg-card"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-md shrink-0 ${
                            on
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {friendly(s)}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate font-mono">
                            {s.entity_id}
                          </div>
                          <div className="mt-1 text-sm tabular-nums">
                            {s.state}
                            {unit(s) && (
                              <span className="text-muted-foreground ml-1">
                                {unit(s)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
