---
name: HA kiosk privileged-action boundaries
description: Security rules for consequential Home Assistant actions exposed through a direct-LAN kiosk proxy.
---

A direct-LAN Home Assistant proxy must not authorize a consequential workflow by matching only the final service name or a target-name heuristic. Bind approvals to every reviewed parameter, protect helper/state mutation, indirect scripts/scenes/automations/events, exact saved targets, and composite HA target selectors, and never accept the credential or privileged action over plain HTTP.

**Why:** Home Assistant can reach the same consequential write through helpers plus reconciliation, indirect execution primitives, or additive `device_id`/`area_id` selectors. A live parameter omitted from the request snapshot can also change the meaning of a valid approval. On HTTP, a network observer can replay both the PIN and an otherwise valid session.

**How to apply:** For future privileged kiosk actions, snapshot entity/value/domain/duration before exposing approval, invalidate on any reviewed-input change, re-check snapshots at apply time, and enforce the same fail-closed transport and authorization gate for REST and WebSocket routes. Disable the action on HTTP and issue only Secure cookies.