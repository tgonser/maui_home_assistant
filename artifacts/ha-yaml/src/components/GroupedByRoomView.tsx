import { useEffect, useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useRegistry } from "@/lib/rooms";
import { useRoomAliases } from "@/lib/roomAliases";
import type { HAState } from "@/lib/ha";

const friendly = (s: HAState) =>
  (s.attributes.friendly_name as string | undefined) ?? s.entity_id;

export function GroupedByRoomView({
  entities,
  renderTile,
}: {
  entities: HAState[];
  renderTile: (s: HAState) => ReactNode;
}) {
  const registry = useRegistry();
  const loadRegistry = useRegistry((s) => s.load);
  const aliases = useRoomAliases((s) => s.aliases);
  const loadAliases = useRoomAliases((s) => s.load);

  useEffect(() => {
    loadRegistry();
    loadAliases();
  }, [loadRegistry, loadAliases]);

  // Strip the longest shared word-prefix from area names, matching RoomsView
  const sharedPrefix = useMemo(() => {
    const areas = registry.areas;
    if (areas.length < 2) return "";
    const wordLists = areas.map((a) => a.name.split(/\s+/));
    const minLen = Math.min(...wordLists.map((w) => w.length));
    const common: string[] = [];
    for (let i = 0; i < minLen - 1; i++) {
      const w = wordLists[0][i];
      if (wordLists.every((wl) => wl[i].toLowerCase() === w.toLowerCase())) {
        common.push(w);
      } else break;
    }
    return common.join(" ");
  }, [registry.areas]);

  const displayName = (areaId: string, rawName: string) => {
    const alias = aliases[areaId]?.trim();
    if (alias) return alias;
    if (!sharedPrefix) return rawName;
    const stripped = rawName.slice(sharedPrefix.length).trim();
    return stripped || rawName;
  };

  const groups = useMemo(() => {
    type Group = { key: string; label: string; items: HAState[] };
    const byArea = new Map<string, HAState[]>();
    const unassigned: HAState[] = [];
    const helpers: HAState[] = [];

    const isHelper = (s: HAState) => {
      const name = (
        (s.attributes.friendly_name as string | undefined) ?? s.entity_id
      ).toLowerCase();
      const id = s.entity_id.toLowerCase();
      const obj = id.split(".")[1] ?? "";
      return (
        name.startsWith("helper ") ||
        name.startsWith("helper:") ||
        obj.startsWith("helper_") ||
        obj.startsWith("group_") ||
        id.startsWith("group.")
      );
    };

    for (const s of entities) {
      if (isHelper(s)) {
        helpers.push(s);
        continue;
      }
      const areaId = registry.entityArea.get(s.entity_id);
      if (!areaId) {
        unassigned.push(s);
        continue;
      }
      const list = byArea.get(areaId) ?? [];
      list.push(s);
      byArea.set(areaId, list);
    }

    const areaName = new Map(registry.areas.map((a) => [a.area_id, a.name]));
    const out: Group[] = [];
    for (const [areaId, items] of byArea) {
      const raw = areaName.get(areaId) ?? areaId;
      out.push({
        key: areaId,
        label: displayName(areaId, raw),
        items: items.sort((a, b) => friendly(a).localeCompare(friendly(b))),
      });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    if (unassigned.length > 0) {
      out.push({
        key: "__unassigned__",
        label: "Unassigned",
        items: unassigned.sort((a, b) =>
          friendly(a).localeCompare(friendly(b)),
        ),
      });
    }
    if (helpers.length > 0) {
      out.push({
        key: "__helpers__",
        label: "Helpers & Groups",
        items: helpers.sort((a, b) =>
          friendly(a).localeCompare(friendly(b)),
        ),
      });
    }
    return out;
    // displayName closes over aliases + sharedPrefix; both already in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, registry, aliases, sharedPrefix]);

  if (groups.length === 0) return null;

  return (
    <motion.div
      key="grouped"
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-8"
    >
      {groups.map((g) => (
        <section key={g.key}>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="wall-section-title text-xl">{g.label}</h3>
            <span className="wall-section-meta text-xs">
              {g.items.length} {g.items.length === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 auto-rows-[110px] gap-3">
            {g.items.map(renderTile)}
          </div>
        </section>
      ))}
    </motion.div>
  );
}
