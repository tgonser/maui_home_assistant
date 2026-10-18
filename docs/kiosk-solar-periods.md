# Kiosk solar period totals

## Evidence and source

The user-provided HA survey generated **2026-09-30 21:07:31 UTC** identifies
Envoy **202445013483** as **Main Envoy**, the existing source of Solar Live.
It reports:

| Metric | State | Unit |
| --- | ---: | --- |
| Current power production | 18.945 | kW |
| Energy production today | 25948.87 | kWh |
| Energy production last seven days | 25948.87 | kWh |
| Lifetime energy production | 25.94887 | MWh |
| Production CT energy delivered | 25.948866 | MWh |

Thus both native period readings match lifetime production exactly after unit
conversion. An older inventory had distinct period readings from that same
Envoy. The reported screenshot's 25946.9 kWh is also treated as a lifetime-like
native reading, **not** as a period increment. Equality between day/week alone
is not a validity test: genuine equal totals remain valid.

This establishes faulty native period data, not the underlying cause. It does
not establish a defect in HA's integration versus Envoy firmware/API or entity
configuration. No other inverter or Tesla production source is substituted or
added. Grid and battery logic are not changed.

## Calculation and availability

- Both totals use only Main Envoy's **lifetime** recorder statistics.
- Today starts at Hawaii midnight (UTC−10, no daylight saving).
- Seven days starts six Hawaii calendar days before today's midnight.
- The endpoint is the most recent completed hour. The UI shows this cutoff;
  it does not imply live-to-the-minute energy. The first hour after midnight
  has no completed daily record, so Today waits rather than inventing zero.
- One bounded recorder batch requests metadata and hourly `sum`/`state` values,
  including one preceding baseline hour. HA is explicitly asked for **kWh**,
  independent of the sensor's current **MWh** display unit.
- Per-hour differences require contiguous baseline/end records, finite
  cumulative values, compatible units, and consistent sum/state increments.
  Gaps, conflicting duplicates, resets, or inconsistent increments invalidate
  the affected period rather than producing a plausible partial total.
- Source metadata must support cumulative energy statistics; the current
  lifetime sensor must also be an available cumulative energy sensor.
- Cache refresh is five minutes, not the six-second states poll. Requests are
  deduplicated by the query cache; failures don't immediately retry. Cache scope
  changes with connection identity and Hawaii date.
- An advancing clock invalidates aged snapshots and day rollovers. Recorder
  errors and stale source reports hide totals with explicit messages.
- HA `last_reported` is used for a 15-minute source-report limit when available.
  Older responses fall back to a 26-hour `last_updated` limit because unchanged
  overnight energy legitimately does not update that timestamp. This fallback
  cannot detect a shorter source reporting outage on those older responses.

## Verification limits

The fresh survey verifies current states, units, source identity, and the native
period/lifetime collision. It does **not** include recorder history, raw Envoy
API responses, or statistics metadata. Runtime checks validate available
recorder data before rendering any numerical total. Controlled fixtures cover
the calculation and UI; a corrected production value cannot be independently
confirmed from the survey alone. No recorder history is reconstructed or
modified, and no production deployment is performed as part of this fix.

## Checks performed

- Frontend test suite: 59 passing tests, including 22 solar-specific tests.
- API test suite: 7 passing tests; full workspace TypeScript check passed.
- Production frontend build passed with `PORT=19970 BASE_PATH=/ NODE_ENV=production`
  (these are build-process settings, not changes to deployment configuration).
  Existing source-map and bundle-size warnings remain.
- The isolated browser fixture verified 22.0 kWh today versus 310.0 kWh over
  seven days, the hourly/Hawaii captions, unchanged Solar Live and Battery Avg,
  and independent handling of an older missing hour (today remains valid while
  seven-day becomes incomplete). No runtime crash was observed.
- Browser variants for equality, source unavailability, recorder error, and
  midnight rollover could not be reliably completed because test route handlers
  conflicted. The corresponding pure calculator/loader scenarios passed unit
  tests; those browser variants are not claimed as verified. Five-minute traffic
  included both existing grid and new solar requests, so the browser's aggregate
  batch count alone does not establish the solar-specific refresh count.