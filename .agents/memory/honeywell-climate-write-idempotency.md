---
name: Honeywell climate write idempotency
description: Preventing repeated Resideo/Honeywell cloud commands and thermostat acknowledgement alerts.
---

Treat every cloud-backed climate service call as consequential and make it idempotent. In Home Assistant, a climate entity's HVAC mode is its state (`states(entity_id)`), not an `hvac_mode` attribute. Compare mode and temperature independently and send only the specific command whose desired value differs. Do not change thermostat fan mode automatically.

**Why:** Reading `state_attr(entity_id, 'hvac_mode')` always appeared different and caused the scheduled automation to resubmit mode and temperature to every thermostat every 15 minutes. Resideo reported these as unacknowledged thermostat changes, and automatic fan commands could leave blowers running unnecessarily.

**How to apply:** For all Maui climate automations, guard `climate.set_hvac_mode`, `climate.set_temperature`, and any other cloud write separately against current state. Keep fan behavior on the thermostat's own schedule/manual control.