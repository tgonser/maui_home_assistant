---
name: Wall alarm safety
description: Alarm-code handling and the distinction between local acknowledgment and physical alarm control.
---

Alarm actions use the physical alarm-system code, not the homeowner PIN used
for storm preparation. Require secure ingress/HTTPS for code entry and actions;
never persist codes or expose them through service errors.

**Why:** A shared wall display must not retain a reusable disarm credential,
and the two credentials serve different authorities.

Issue dismissal means local acknowledgment, not physical trouble reset,
zone bypass, siren silencing, or cancellation of a monitoring-company alert.
Keep unresolved conditions visible, and do not add panic/bypass/raw-keypad
actions as an incidental part of alarm UI work.

**Why:** A dismiss button must not silently reduce protection or make an
unresolved physical fault look healthy.

**How to apply:** Use explicit confirmed arm/disarm actions, verify resulting
HA states, retain active issue indicators, and test only with simulated alarm
responses unless the user explicitly authorizes a real physical test.
