import type { HAState } from "./ha";

// Per-suite guest wake-up, backed by the maui_wake.yaml HA package.

export const WAKE_FEATURES: Record<string, { shades: boolean; voice: boolean; speaker?: string }> = {
  beach: { shades: true, voice: true, speaker: "Beach Guest Bed" },
  boardroom: { shades: false, voice: false },
  molokini: { shades: true, voice: true, speaker: "Molokini Guest Bed" },
  mauka: { shades: true, voice: false },
  master: { shades: true, voice: true, speaker: "Master Bed" },
};

export const wakeId = (suite: string, part: string, domain = "input_boolean") => `${domain}.wake_${suite}_${part}`;

export type WakeState = {
  available: boolean; enabled: boolean; time: string; repeat: "Once" | "Every day until I leave";
  until: string; lights: boolean; shades: boolean; voice: boolean; ringing: boolean; snoozeEnds: string | null;
  music: boolean; playlist: string; musicAvailable: boolean;
};

export function readWake(states: Map<string, HAState>, s: string): WakeState {
  const b = (p: string) => states.get(wakeId(s, p))?.state === "on";
  const t = states.get(wakeId(s, "time", "input_datetime"));
  const snooze = states.get(`timer.wake_${s}_snooze`);
  return {
    available: !!t,
    enabled: b("enabled"),
    time: (t?.state ?? "07:00:00").slice(0, 5),
    repeat: states.get(wakeId(s, "repeat", "input_select"))?.state === "Every day until I leave" ? "Every day until I leave" : "Once",
    until: states.get(wakeId(s, "until", "input_datetime"))?.state ?? "",
    lights: b("lights"), shades: b("shades"), voice: b("voice"), ringing: b("ringing"),
    music: b("music"), playlist: states.get(`input_text.wake_${s}_playlist`)?.state ?? "",
    musicAvailable: states.has(`input_text.wake_${s}_playlist`),
    snoozeEnds: snooze?.state === "active" ? String(snooze.attributes.finishes_at ?? "") || null : null,
  };
}

/** "7:05 AM" from "07:05". */
export function prettyTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Add minutes to "HH:MM", wrapping round midnight. */
export function shiftTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const t = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Guests are staying in a suite when its wake-up is on, ringing or
 *  snoozed, or set "every day" through a leave date that hasn't passed. */
export function suiteOccupied(states: Map<string, HAState>, suite: string, todayIso: string): boolean {
  const w = readWake(states, suite);
  if (!w.available) return false;
  return w.enabled || w.ringing || w.snoozeEnds != null || (w.repeat === "Every day until I leave" && w.until >= todayIso && w.enabled);
}

/** Quick picks on the wake-up screen. */
export const WAKE_PRESETS = ["06:00", "06:30", "07:00", "07:30", "08:00", "08:30"];

/** Whether a wake-up set for `hhmm` next rings today or tomorrow, given the
 *  current Maui time `nowHhmm` (both "HH:MM"). */
export function nextWakeDay(hhmm: string, nowHhmm: string): "today" | "tomorrow" {
  return hhmm > nowHhmm ? "today" : "tomorrow";
}
