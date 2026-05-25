import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Lightbulb, Power, Loader2, Pencil } from "lucide-react";
import {
  useRegistry,
  deriveRooms,
  turnRoomOn,
  turnRoomOff,
  type Room,
} from "@/lib/rooms";
import { useRoomAliases } from "@/lib/roomAliases";
import type { HAState } from "@/lib/ha";

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

  useEffect(() => {
    load();
  }, [load]);

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
            onChanged={refresh}
          />
        ))}
      </motion.div>
    </>
  );
}

function RoomTile({
  room,
  displayName,
  isAliased,
  onRename,
  onChanged,
}: {
  room: Room;
  displayName: string;
  isAliased: boolean;
  onRename: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<"on" | "off" | null>(null);

  const handle = async (which: "on" | "off") => {
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
      className="wall-tile p-5 flex flex-col gap-4 min-h-[160px]"
    >
      <div className="flex items-start gap-3 relative z-[1]">
        <div className="wall-icon-wrap p-2.5 shrink-0">
          <Lightbulb className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="value text-xl font-semibold leading-tight break-words"
            title={room.name}
          >
            {displayName}
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
          onClick={onRename}
          className="wall-rename-btn shrink-0 p-1.5 rounded-md"
          title="Rename for this kiosk"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-auto relative z-[1]">
        <Button
          variant="outline"
          className={`${room.on ? "wall-btn-active" : "wall-btn"} h-12`}
          onClick={() => handle("on")}
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
          onClick={() => handle("off")}
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
