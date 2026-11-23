import type { HAState } from "./ha";

// UniFi Protect cameras: one entry per physical camera (the high-resolution
// channel, or medium if that is all there is), with a readable name and the
// matching motion sensor.

const CHANNEL = /_(high|medium|low)_resolution_channel$/;

export type CameraInfo = { id: string; name: string; motionId: string; available: boolean };

export function cameraName(friendly: string): string {
  const base = friendly.replace(/\s*(High|Medium|Low) resolution channel$/i, "").replace(/\s*-\s*Entry$/i, "").trim();
  const noModel = base.replace(/\bG[0-9]\s*(PTZ|Turret|Instant|Pro|Bullet|Dome)?\b/gi, "").replace(/\s{2,}/g, " ").trim();
  return noModel || base || friendly;
}

export function listCameras(states: Map<string, HAState>): CameraInfo[] {
  const byBase = new Map<string, HAState[]>();
  for (const st of states.values()) {
    if (!st.entity_id.startsWith("camera.") || !CHANNEL.test(st.entity_id)) continue;
    const base = st.entity_id.replace(CHANNEL, "");
    byBase.set(base, [...(byBase.get(base) ?? []), st]);
  }
  const rank = (id: string) => (id.includes("_high_") ? 0 : id.includes("_medium_") ? 1 : 2);
  const out: CameraInfo[] = [];
  for (const [base, chans] of byBase) {
    const live = chans.filter((c) => c.state !== "unavailable").sort((a, b) => rank(a.entity_id) - rank(b.entity_id));
    const pick = live[0] ?? chans.sort((a, b) => rank(a.entity_id) - rank(b.entity_id))[0];
    out.push({
      id: pick.entity_id,
      name: cameraName(String(pick.attributes.friendly_name ?? pick.entity_id)),
      motionId: `binary_sensor.${base.slice(7)}_motion`,
      available: live.length > 0,
    });
  }
  // Two cameras can clean up to the same name ("Entry"): give those back
  // their model so they can be told apart.
  const counts = new Map<string, number>();
  out.forEach((c) => counts.set(c.name, (counts.get(c.name) ?? 0) + 1));
  for (const c of out) {
    if ((counts.get(c.name) ?? 0) > 1) {
      const full = String(states.get(c.id)?.attributes.friendly_name ?? c.name).replace(/\s*(High|Medium|Low) resolution channel$/i, "").trim();
      c.name = full;
    }
  }
  return out.sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name));
}
