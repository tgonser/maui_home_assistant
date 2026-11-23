import type { HAState } from "./ha";

/** Apply one pushed change to a state map. Exported for tests. */
export function applyChange(
  map: Map<string, HAState>,
  entityId: string,
  next: HAState | null,
): Map<string, HAState> {
  const out = new Map(map);
  if (next) out.set(entityId, next);
  else out.delete(entityId);
  return out;
}

/** Split a growing text buffer into complete JSON lines. Exported for tests. */
export function takeLines(buffer: string): { lines: unknown[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  const lines: unknown[] = [];
  for (const p of parts) {
    if (!p.trim()) continue;
    try {
      lines.push(JSON.parse(p));
    } catch {
      /* skip a malformed line */
    }
  }
  return { lines, rest };
}

