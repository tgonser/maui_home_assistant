---
name: HA kiosk recorder statistics
description: Reliability rules for loading long-range hourly Home Assistant statistics in a continuously running kiosk.
---

Frequently refresh only the active Hawaii calendar month. Load older hourly
statistics separately in month-bounded, sequential chunks. Deduplicate exact
boundary copies, but retain conflicting overlaps so validation can mark them
partial. Replace active-month snapshots rather than accumulating changing
copies of the incomplete hour, while preserving a completed month across
rollover.

**Why:** Repeated multi-year recorder requests through HA ingress can exceed
proxy limits even when live power calls remain healthy. A kiosk can also sleep
or throttle timers, so freshness inferred only from the last request attempt
can leave a pre-midnight value looking authoritative.

**How to apply:** Drive stale/partial state from advancing wall-clock time and
Hawaii day rollover, not only explicit request errors. Keep the last successful
snapshot only when its age is visible and current totals are downgraded to
partial.