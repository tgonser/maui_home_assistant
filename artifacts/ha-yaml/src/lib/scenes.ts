import type { HAState } from "./ha";

// "Save as scene": snapshot lights (and, for whole-house scenes, shades) into
// a persistent Home Assistant scene. Wall-made scenes get ids starting
// "wall_" so they are easy to tell apart and safe to overwrite.

export const PLANNED_SCENES = ["Good morning", "Sunset", "Good night", "Dinner", "Master reading", "Master night"];

export function sceneSlug(name: string): string {
  const s = name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `wall_${s || "scene"}`;
}

type SceneEntity = Record<string, unknown> & { state: string };

/** Build the scene config HA's config API expects. Lights keep brightness
 *  when on; shades keep their position. */
export function buildSceneConfig(name: string, states: HAState[]): { id: string; name: string; entities: Record<string, SceneEntity>; icon: string } {
  const entities: Record<string, SceneEntity> = {};
  for (const st of states) {
    if (st.state === "unavailable" || st.state === "unknown") continue;
    if (st.entity_id.startsWith("light.")) {
      const e: SceneEntity = { state: st.state };
      const b = Number(st.attributes.brightness);
      if (st.state === "on" && Number.isFinite(b)) e.brightness = b;
      entities[st.entity_id] = e;
    } else if (st.entity_id.startsWith("cover.")) {
      const pos = Number(st.attributes.current_position);
      entities[st.entity_id] = Number.isFinite(pos) ? { state: st.state, current_position: pos } : { state: st.state };
    }
  }
  return { id: sceneSlug(name), name, entities, icon: "mdi:palette" };
}
