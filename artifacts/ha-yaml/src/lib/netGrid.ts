/**
 * Builds the "Net Grid Power — Today" series from two Tesla grid-power histories.
 *
 * HA records a state only when it changes, and the two systems update at different
 * moments. Each system's last known value is therefore carried forward onto a fixed
 * 5-minute grid before they are added together; a slot is plotted only once BOTH
 * systems have reported. `exp` and `imp` are continuous (0 when the other applies),
 * so the areas never break when the net crosses zero.
 *
 * Tesla grid power: positive = importing, negative = exporting. Net here is positive
 * when the house as a whole is exporting.
 */
export type PowerPoint = { t: number; v: number };
export type NetGridPoint = { t: number; net: number; exp: number; imp: number };

export const NET_GRID_STEP_MS = 5 * 60 * 1000;

export function buildNetGridSeries(
  sys1: PowerPoint[],
  sys2: PowerPoint[],
  startMs: number,
  endMs: number,
  stepMs = NET_GRID_STEP_MS,
): NetGridPoint[] {
  if (!(endMs > startMs) || stepMs <= 0) return [];
  const a = [...sys1].filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v)).sort((x, y) => x.t - y.t);
  const b = [...sys2].filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v)).sort((x, y) => x.t - y.t);
  const out: NetGridPoint[] = [];
  let i = 0;
  let j = 0;
  let v1: number | null = null;
  let v2: number | null = null;
  const first = Math.ceil(startMs / stepMs) * stepMs;
  for (let t = first; t <= endMs; t += stepMs) {
    while (i < a.length && a[i].t <= t) v1 = a[i++].v;
    while (j < b.length && b[j].t <= t) v2 = b[j++].v;
    if (v1 === null || v2 === null) continue;
    const net = Math.round(-(v1 + v2) * 1000) / 1000;
    out.push({ t, net, exp: Math.max(net, 0), imp: Math.min(net, 0) });
  }
  return out;
}
