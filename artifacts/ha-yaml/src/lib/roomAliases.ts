import { create } from "zustand";
import { persist } from "zustand/middleware";

type RoomAliasStore = {
  aliases: Record<string, string>;
  setAlias: (areaId: string, name: string) => void;
  clearAlias: (areaId: string) => void;
};

export const useRoomAliases = create<RoomAliasStore>()(
  persist(
    (set) => ({
      aliases: {},
      setAlias: (areaId, name) =>
        set((s) => {
          const trimmed = name.trim();
          const next = { ...s.aliases };
          if (trimmed) next[areaId] = trimmed;
          else delete next[areaId];
          return { aliases: next };
        }),
      clearAlias: (areaId) =>
        set((s) => {
          const next = { ...s.aliases };
          delete next[areaId];
          return { aliases: next };
        }),
    }),
    { name: "wall-room-aliases-v1" },
  ),
);
