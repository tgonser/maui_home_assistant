import { create } from "zustand";
import { getApiBase } from "./apiBase";

const API = getApiBase();

type RoomAliasStore = {
  aliases: Record<string, string>;
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  setAlias: (areaId: string, name: string) => Promise<void>;
  clearAlias: (areaId: string) => Promise<void>;
};

export const useRoomAliases = create<RoomAliasStore>((set, get) => ({
  aliases: {},
  loaded: false,
  error: null,

  load: async () => {
    try {
      const res = await fetch(`${API}/room-aliases`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Record<string, string>;
      set({ aliases: data, loaded: true, error: null });
    } catch (err) {
      set({
        loaded: true,
        error: err instanceof Error ? err.message : "Failed to load aliases",
      });
    }
  },

  setAlias: async (areaId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return get().clearAlias(areaId);

    const prev = get().aliases;
    set({ aliases: { ...prev, [areaId]: trimmed }, error: null });
    try {
      const res = await fetch(
        `${API}/room-aliases/${encodeURIComponent(areaId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      // Revert on failure
      set({
        aliases: prev,
        error: err instanceof Error ? err.message : "Save failed",
      });
    }
  },

  clearAlias: async (areaId) => {
    const prev = get().aliases;
    const next = { ...prev };
    delete next[areaId];
    set({ aliases: next, error: null });
    try {
      const res = await fetch(
        `${API}/room-aliases/${encodeURIComponent(areaId)}`,
        { method: "DELETE" },
      );
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      set({
        aliases: prev,
        error: err instanceof Error ? err.message : "Delete failed",
      });
    }
  },
}));
