---
name: HA UI automation paste — no id line
description: Pasting automation YAML into the HA UI editor fails if the file has a manual `id:` line.
---

Rule: YAML files meant to be pasted into Home Assistant's automation editor (Settings > Automations > Edit in YAML) must NOT contain a top-level `id:` line.

**Why:** With a manual `id:`, HA refuses to save a new automation with the error "Only automations in automations.yaml are editable." HA assigns its own id on save. Confirmed with the user July 2026 (manual-hold automation).

**How to apply:** When authoring copy-paste automation YAML in `ha-config/`, omit `id:` and add a comment noting why. Existing UI automations keep their UI-generated numeric ids when their YAML is replaced in place.
