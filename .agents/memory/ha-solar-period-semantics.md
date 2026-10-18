---
name: HA solar period sensor semantics
description: Preserve installation identity and distinguish upstream period errors from integration root-cause claims.
---

Do not trust an Envoy entity's “today” or “last seven days” name as proof of its
period semantics, and do not treat equal daily/weekly numbers alone as invalid.
Keep the production source tied to the installation already selected for Solar
Live unless independent evidence supports changing it.

**Why:** A fresh user survey showed both native period values equal to the same
Envoy's lifetime value after MWh-to-kWh conversion, despite an older survey
showing distinct period readings. This established incorrect upstream period
data, but did not establish whether Envoy firmware/API, HA integration logic,
or entity configuration caused it. Replacing the source with a different
inverter would change what is being measured rather than fix that problem.

**How to apply:** Compare native periods against lifetime energy with explicit
units; verify recorder metadata and period coverage before deriving totals.
Keep legitimate equal totals valid. State the limit of the evidence when
discussing integration defects, and require raw device-versus-HA comparison
before attributing the root cause.