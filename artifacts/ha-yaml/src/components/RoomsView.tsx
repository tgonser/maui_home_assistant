import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Lightbulb, Power, Loader2, Pencil, ChevronRight } from "lucide-react";
import {
  useRegistry,
  deriveRooms,
  turnRoomOn,
  turnRoomOff,
  setRoomBrightness,
  setLightBrightness,
  toggleLight,
  ROOM_ON_THRESHOLD_PCT,
  type Room,
  type RoomLight,
} from "@/lib/rooms";
import { useRoomAliases } from "@/lib/roomAliases";
import type { HAState } from "@/lib/ha";

const friendlyName = (s: HAState) =>
  (s.attributes.friendly_name as string | undefined) ?? s.entity_id;

export function RoomsView({
  states,
  refresh,
}: {
  states: HAState[];
  refresh: () => Promise<void> | void;
}) {
  const registry = useRegistry();
  const load = useRegistry((s) => s.load);
  const aliases = useRoomAliases((s) => s.aliases);
  const setAlias = useRoomAliases((s) => s.setAlias);
  const loadAliases = useRoomAliases((s) => s.load);

  useEffect(() => {
    load();
    loadAliases();
  }, [load, loadAliases]);

  const rooms = useMemo(
    () => deriveRooms(states, registry),
    [states, registry],
  );

  // Strip the longest shared word-prefix from every room name so e.g.
  // "Floor 1 Bedroom 1", "Floor 1 Bedroom 2" collapse to "Bedroom 1", "Bedroom 2"
  const sharedPrefix = useMemo(() => {
    if (rooms.length < 2) return "";
    const wordLists = rooms.map((r) => r.name.split(/\s+/));
    const minLen = Math.min(...wordLists.map((w) => w.length));
    const common: string[] = [];
    for (let i = 0; i < minLen - 1; i++) {
      const w = wordLists[0][i];
      if (wordLists.every((wl) => wl[i].toLowerCase() === w.toLowerCase())) {
        common.push(w);
      } else break;
    }
    return common.join(" ");
  }, [rooms]);

  const shortName = (name: string) => {
    if (!sharedPrefix) return name;
    const stripped = name.slice(sharedPrefix.length).trim();
    return stripped || name;
  };

  const displayNameFor = (room: Room) =>
    aliases[room.id]?.trim() || shortName(room.name);

  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const openRoom = openRoomId
    ? rooms.find((r) => r.id === openRoomId) ?? null
    : null;

  const handleRename = (room: Room) => {
    const current = aliases[room.id] ?? "";
    const next = window.prompt(
      `Rename "${room.name}" for this kiosk only.\nLeave blank to reset.`,
      current,
    );
    if (next === null) return;
    setAlias(room.id, next);
  };

  if (registry.loading && rooms.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--cream-muted)] gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading rooms…</span>
      </div>
    );
  }

  if (registry.error) {
    return (
      <div className="text-center py-20 text-[var(--coral)]">
        <p>Could not load rooms: {registry.error}</p>
        <Button
          variant="outline"
          className="wall-btn mt-4"
          onClick={() => load(true)}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="text-center py-20 text-[var(--cream-muted)]">
        <p>No rooms with lights found.</p>
      </div>
    );
  }

  return (
    <>
      {sharedPrefix && (
        <div className="text-xs uppercase tracking-wider text-[var(--cream-muted)] mb-3">
          {sharedPrefix}
        </div>
      )}
      <motion.div
        layout
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
      >
        {rooms.map((room) => (
          <RoomTile
            key={room.id}
            room={room}
            displayName={displayNameFor(room)}
            isAliased={!!aliases[room.id]}
            onRename={() => handleRename(room)}
            onOpen={() => setOpenRoomId(room.id)}
            onChanged={refresh}
          />
        ))}
      </motion.div>
      <RoomDetailSheet
        room={openRoom}
        displayName={openRoom ? displayNameFor(openRoom) : ""}
        onClose={() => setOpenRoomId(null)}
        refresh={refresh}
      />
    </>
  );
}

function RoomTile({
  room,
  displayName,
  isAliased,
  onRename,
  onOpen,
  onChanged,
}: {
  room: Room;
  displayName: string;
  isAliased: boolean;
  onRename: () => void;
  onOpen: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<"on" | "off" | null>(null);

  const handle = async (e: React.MouseEvent, which: "on" | "off") => {
    e.stopPropagation();
    setBusy(which);
    if (which === "on") await turnRoomOn(room);
    else await turnRoomOff(room);
    await onChanged();
    setBusy(null);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${displayName} lights`}
      className="wall-tile p-5 flex flex-col gap-4 min-h-[160px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cream)]/60"
    >
      <div className="flex items-start gap-3 relative z-[1]">
        <div className="wall-icon-wrap p-2.5 shrink-0">
          <Lightbulb className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="value text-xl font-semibold leading-tight break-words flex items-center gap-1"
            title={room.name}
          >
            <span className="min-w-0 break-words">{displayName}</span>
            <ChevronRight className="w-4 h-4 opacity-50 shrink-0" />
          </div>
          <div className="sub text-[11px] uppercase tabular-nums mt-1">
            {room.totalLights} {room.totalLights === 1 ? "light" : "lights"}
            {isAliased && (
              <span className="ml-2 opacity-60 normal-case">
                · {room.name}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
          className="wall-rename-btn shrink-0 p-1.5 rounded-md"
          title="Rename for this kiosk"
          aria-label={`Rename ${displayName}`}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-auto relative z-[1]">
        <Button
          variant="outline"
          className={`${room.on ? "wall-btn-active" : "wall-btn"} h-12`}
          onClick={(e) => handle(e, "on")}
          disabled={busy !== null}
        >
          {busy === "on" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Power className="w-4 h-4 mr-1.5" />
              On
            </>
          )}
        </Button>
        <Button
          variant="outline"
          className={`${!room.on ? "wall-btn-active" : "wall-btn"} h-12`}
          onClick={(e) => handle(e, "off")}
          disabled={busy !== null}
        >
          {busy === "off" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Off"
          )}
        </Button>
      </div>
    </motion.div>
  );
}

function RoomDetailSheet({
  room,
  displayName,
  onClose,
  refresh,
}: {
  room: Room | null;
  displayName: string;
  onClose: () => void;
  refresh: () => Promise<void> | void;
}) {
  const [masterPct, setMasterPct] = useState<number | null>(null);
  const [pendingMaster, setPendingMaster] = useState(false);
  const upstreamAvg = room?.avgPctOfOn ?? 0;

  // Reset local master slider whenever the open room changes
  useEffect(() => {
    setMasterPct(null);
  }, [room?.id]);

  // Clear local override once HA reports a value reasonably close to ours
  useEffect(() => {
    if (masterPct === null) return;
    if (Math.abs(upstreamAvg - masterPct) <= 8) setMasterPct(null);
  }, [upstreamAvg, masterPct]);

  if (!room) {
    return (
      <Sheet open={false} onOpenChange={(o) => !o && onClose()}>
        <SheetContent />
      </Sheet>
    );
  }

  const sortedLights = [...room.lights].sort((a, b) =>
    friendlyName(a.state).localeCompare(friendlyName(b.state)),
  );
  const effectiveMaster = masterPct ?? room.avgPctOfOn;

  const applyMaster = async (pct: number) => {
    setPendingMaster(true);
    setMasterPct(pct);
    try {
      await setRoomBrightness(room, pct);
      await refresh();
    } finally {
      setPendingMaster(false);
      // Keep the local value visible; the useEffect above (or a 5s safety
      // timeout) will clear it once HA catches up or if the call silently
      // failed.
      window.setTimeout(() => setMasterPct(null), 5000);
    }
  };

  return (
    <Sheet open={!!room} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="wall-sheet w-full sm:max-w-md overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-2xl">{displayName}</SheetTitle>
          <div className="text-xs uppercase tracking-wider text-[var(--cream-muted)]">
            {room.totalLights}{" "}
            {room.totalLights === 1 ? "light" : "lights"} · {room.onCount} on
          </div>
        </SheetHeader>

        <div className="mt-6 p-4 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">All lights in room</span>
            <span className="text-xs tabular-nums text-[var(--cream-muted)]">
              {effectiveMaster}%
            </span>
          </div>
          <Slider
            value={[effectiveMaster]}
            min={0}
            max={100}
            step={5}
            disabled={pendingMaster}
            onValueChange={(v) => setMasterPct(v[0])}
            onValueCommit={(v) => applyMaster(v[0])}
          />
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Button
              variant="outline"
              className="wall-btn h-10"
              onClick={() => applyMaster(ROOM_ON_THRESHOLD_PCT)}
              disabled={pendingMaster}
            >
              <Power className="w-4 h-4 mr-1.5" /> On
            </Button>
            <Button
              variant="outline"
              className="wall-btn h-10"
              onClick={() => applyMaster(0)}
              disabled={pendingMaster}
            >
              Off
            </Button>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          {sortedLights.length === 0 ? (
            <div className="text-center text-[var(--cream-muted)] py-8">
              No lights in this room.
            </div>
          ) : (
            sortedLights.map((light) => (
              <LightRow
                key={light.state.entity_id}
                light={light}
                refresh={refresh}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LightRow({
  light,
  refresh,
}: {
  light: RoomLight;
  refresh: () => Promise<void> | void;
}) {
  const [localPct, setLocalPct] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  // Clear local override only once HA's reported value is close to ours
  // (some dimmers take a moment to echo back the new brightness).
  useEffect(() => {
    if (localPct === null) return;
    const upstream = light.on ? light.pct : 0;
    if (Math.abs(upstream - localPct) <= 8) setLocalPct(null);
  }, [light.pct, light.on, localPct]);

  const pct = localPct ?? light.pct;
  const on = pct > 0;
  const name = friendlyName(light.state);

  const commit = async (newPct: number) => {
    setPending(true);
    setLocalPct(newPct);
    try {
      await setLightBrightness(light.state.entity_id, newPct);
      await refresh();
    } finally {
      setPending(false);
      // Safety: if HA never echoes back, drop the override after 5s so we
      // don't lie about the real state forever.
      window.setTimeout(() => setLocalPct(null), 5000);
    }
  };

  const toggle = async () => {
    setPending(true);
    await toggleLight(light.state.entity_id, !light.on);
    await refresh();
    setPending(false);
  };

  return (
    <div
      className={`p-3 rounded-lg border transition-colors ${
        on
          ? "bg-[var(--cream)]/10 border-[var(--cream)]/30"
          : "bg-white/5 border-white/10"
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          disabled={pending}
          className={`wall-icon-wrap p-2 shrink-0 transition-opacity ${
            on ? "opacity-100" : "opacity-40"
          }`}
          title={on ? "Turn off" : "Turn on"}
          aria-label={`${on ? "Turn off" : "Turn on"} ${name}`}
        >
          {pending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Lightbulb className="w-4 h-4" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate" title={name}>
            {name}
          </div>
          <div className="text-[10px] uppercase tabular-nums text-[var(--cream-muted)]">
            {on ? `${pct}%` : "Off"}
          </div>
        </div>
      </div>
      <Slider
        className="mt-3"
        value={[pct]}
        min={0}
        max={100}
        step={5}
        disabled={pending}
        onValueChange={(v) => setLocalPct(v[0])}
        onValueCommit={(v) => commit(v[0])}
      />
    </div>
  );
}
