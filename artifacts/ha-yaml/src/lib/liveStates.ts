import { useEffect, useRef, useState } from "react";
import { getApiBase, haStates, haTest, useHAStore, type HAState } from "./ha";
import { applyChange, takeLines } from "./liveStatesCore";

// Live Home Assistant state for the wall.
//
// Loads every state once, then applies pushed changes from /api/ha/stream as
// they happen (a light switched at the keypad shows on the tablet within a
// second). If the stream drops it reconnects with a fresh full load; after
// three failures in a row it falls back to the old 6-second polling so the
// wall never goes blank. A full reload every 5 minutes guards against drift.

export type LiveMode = "connecting" | "live" | "polling" | "error";

const FULL_RELOAD_MS = 5 * 60_000;
const POLL_MS = 6_000;
const RETRY_MS = 3_000;
const MAX_STREAM_FAILS = 3;
const STALE_MS = 60_000; // no line (not even a heartbeat) for this long = dead

export function useLiveStates() {
  const url = useHAStore((s) => s.url);
  const token = useHAStore((s) => s.token);
  const [states, setStates] = useState<Map<string, HAState>>(new Map());
  const [mode, setMode] = useState<LiveMode>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [lastMs, setLastMs] = useState(0);
  const pending = useRef<Map<string, HAState | null>>(new Map());

  useEffect(() => {
    if (!url || !token) return;
    let cancelled = false;
    let fails = 0;
    let abort: AbortController | null = null;
    let pollId = 0;
    let reloadId = 0;
    let flushId = 0;
    let retryId = 0;
    const { setStatus } = useHAStore.getState();
    setStatus("connecting");

    const fullLoad = async () => {
      const r = await haStates();
      if (cancelled) return false;
      if (r.ok) {
        setStates(new Map(r.data.map((s) => [s.entity_id, s])));
        setLastMs(Date.now());
        setError(null);
        setStatus("connected");
        if (!useHAStore.getState().config) haTest().catch(() => undefined);
        return true;
      }
      setError(r.error);
      setStatus("error", r.error);
      setMode("error");
      return false;
    };

    // Batch pushed changes into one render every 250 ms.
    const flush = () => {
      flushId = 0;
      if (pending.current.size === 0) return;
      const batch = pending.current;
      pending.current = new Map();
      setStates((prev) => {
        let next = prev;
        for (const [id, s] of batch) next = applyChange(next, id, s);
        return next;
      });
      setLastMs(Date.now());
    };

    const startPolling = () => {
      setMode("polling");
      window.clearInterval(pollId);
      pollId = window.setInterval(() => void fullLoad(), POLL_MS);
    };

    const stream = async () => {
      if (cancelled) return;
      abort = new AbortController();
      let lastLine = Date.now();
      const watchdog = window.setInterval(() => {
        if (Date.now() - lastLine > STALE_MS) abort?.abort();
      }, 10_000);
      try {
        const res = await fetch(`${getApiBase()}/api/ha/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, token }),
          signal: abort.signal,
        });
        if (!res.ok || !res.body) throw new Error(`stream HTTP ${res.status}`);
        if (!(await fullLoad())) throw new Error("state load failed");
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done || cancelled) break;
          lastLine = Date.now();
          buf += dec.decode(value, { stream: true });
          const { lines, rest } = takeLines(buf);
          buf = rest;
          for (const l of lines as Array<Record<string, unknown>>) {
            if (l.ready) {
              fails = 0;
              setMode("live");
            } else if (typeof l.e === "string") {
              pending.current.set(l.e, (l.s as HAState | null) ?? null);
              if (!flushId) flushId = window.setTimeout(flush, 250);
            }
          }
        }
      } catch {
        /* fall through to retry */
      } finally {
        window.clearInterval(watchdog);
      }
      if (cancelled) return;
      fails += 1;
      if (fails >= MAX_STREAM_FAILS) {
        startPolling();
        return;
      }
      setMode("connecting");
      retryId = window.setTimeout(() => void stream(), RETRY_MS);
    };

    void stream();
    reloadId = window.setInterval(() => void fullLoad(), FULL_RELOAD_MS);

    return () => {
      cancelled = true;
      abort?.abort();
      window.clearInterval(pollId);
      window.clearInterval(reloadId);
      window.clearTimeout(flushId);
      window.clearTimeout(retryId);
    };
  }, [url, token]);

  return { states, mode, error, lastMs };
}
