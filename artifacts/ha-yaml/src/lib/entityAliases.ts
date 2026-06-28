import { create } from "zustand";
import { getApiBase } from "./apiBase";

const API = getApiBase();

type EntityAliasStore = {
  aliases: Record<string, string>;
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  setAlias: (entityId: string, alias: string) => Promise<void>;
  clearAlias: (entityId: string) => Promise<void>;
};

export const useEntityAliases = create<EntityAliasStore>((set, get) => ({
  aliases: {},
  loaded: false,
  error: null,

  load: async () => {
    try {
      const res = await fetch(`${API}/entity-aliases`);
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

  setAlias: async (entityId, alias) => {
    const trimmed = alias.trim();
    if (!trimmed) return get().clearAlias(entityId);

    const prev = get().aliases;
    set({ aliases: { ...prev, [entityId]: trimmed }, error: null });
    try {
      const res = await fetch(
        `${API}/entity-aliases/${encodeURIComponent(entityId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alias: trimmed }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      set({
        aliases: prev,
        error: err instanceof Error ? err.message : "Save failed",
      });
    }
  },

  clearAlias: async (entityId) => {
    const prev = get().aliases;
    const next = { ...prev };
    delete next[entityId];
    set({ aliases: next, error: null });
    try {
      const res = await fetch(
        `${API}/entity-aliases/${encodeURIComponent(entityId)}`,
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
