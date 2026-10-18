---
name: Wall alarm safety
description: Alarm-code handling and the distinction between local acknowledgment and physical alarm control.
---

Alarm actions use the physical alarm-system code, not the homeowner PIN used
for storm preparation. Require secure ingress/HTTPS for code entry and actions;
never expose codes through service errors or browser storage.

The user requested "pin free to begin", explicitly choosing PIN-free wall controls.
Support opt-in server-side code storage bound to a single panel and the local
Supervisor connection. Retain action confirmation and a visible warning that
anyone with secure-wall access can disarm. Do not silently reintroduce a PIN gate.

**Why:** The user chose PIN-free controls after the access risk was explained.

The user confirmed the underlying alarm is Honeywell and they can create a
user code through their mobile app.

**Why:** User-provided setup information; do not require physical-keypad
programming when guiding them to create a dedicated HA alarm user.

**Why:** The shared browser must not retain a reusable disarm credential,
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
