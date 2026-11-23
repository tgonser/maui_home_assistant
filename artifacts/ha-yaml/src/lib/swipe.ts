// Decide whether a finished touch was a deliberate sideways swipe.
// Returns +1 (swipe left → next tab), -1 (swipe right → previous) or 0.
export function swipeDirection(dx: number, dy: number, ms: number): -1 | 0 | 1 {
  if (ms > 700) return 0;                  // slow drag, not a swipe
  if (Math.abs(dx) < 80) return 0;         // too short
  if (Math.abs(dx) < Math.abs(dy) * 2) return 0; // mostly vertical (scrolling)
  return dx < 0 ? 1 : -1;
}

/** Touches that start on these should never change tabs. */
export const NO_SWIPE_SELECTOR = 'input, select, textarea, .v2-modal, [data-noswipe]';
