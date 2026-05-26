---
name: Home Assistant duplicate entity id disambiguation
description: How HA disambiguates colliding friendly names, and how sibling-entity lookups must handle it.
---

When multiple HA integrations register entities under the same friendly name (very common for a TV — DLNA Digital Media Renderer, Samsung Smart TV media_player, Samsung Smart TV remote, Chromecast all naming themselves "65" OLED"), HA appends `_2`, `_3`, ... to the entity_id of each duplicate after the first. The order is roughly load order, so which integration gets the bare id vs `_3` is not stable — it shifts with integration restarts.

Consequence for code that pairs sibling entities (e.g. "find the `remote.*` for this `media_player.*`"):

- A naïve lookup like `remote.${suffix}` where `suffix = media_player.<x>` fails whenever the media_player has been bumped to a `_N` suffix while the remote entity (usually unique because only one integration creates it) sits at the base name.
- Fix: try the exact match first, then fall back to stripping a trailing `_\d+` from the suffix and trying again.

**Why:** Without the fallback, the kiosk happily detects the brand profile, sends commands at HA, gets 200 OK back from every call, and the user sees nothing happen because the targeted sibling entity doesn't exist or is the wrong integration's entity.

**How to apply:** In any sibling-entity lookup, use both `${prefix}.${suffix}` and `${prefix}.${suffix.replace(/_\d+$/, "")}`. Architect noted a residual risk: in collision scenarios the stripped fallback could mis-pair across rooms (e.g. `media_player.tv_2` falling back to `remote.tv` that belongs to a different room). Mitigate by also confirming both entities share an Area when ambiguity is possible.

**Diagnostic shortcut:** Have the user open HA → Developer Tools → States and filter by the entity slug (e.g. `65_oled`). The list of all entities sharing that base name, with their states and attributes, immediately reveals which one is the real Samsung media_player (look for `device_class: tv` and a `source_list` containing TV/HDMI inputs) vs which are DLNA/Chromecast duplicates.
