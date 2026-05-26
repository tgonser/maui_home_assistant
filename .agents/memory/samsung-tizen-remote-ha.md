---
name: Samsung Tizen TV remote control in Home Assistant
description: Which HA service paths actually drive 2022+ Samsung Tizen Smart TVs vs which silently fail.
---

On 2022+ Samsung Tizen TVs (S90 OLED, recent Frame, etc.), the HA core `samsungtv` integration accepts some service calls and silently drops others. The dropped ones still return HTTP 200 from the HA REST API — there is no error to log against, the TV just doesn't react. Diagnose by sending the command from HA Developer Tools → Actions and watching the TV directly, since downstream success/failure is not observable from the API response.

**Works on the `media_player.*` entity:**
- `media_player.volume_up` / `volume_down` / `volume_mute`
- `media_player.turn_on` / `turn_off`
- `media_player.select_source` (only for sources actually in `source_list`, typically just `TV`, `HDMI`)

**Does NOT work (silent no-op):**
- `media_player.play_media` with `media_content_type: send_key` and `media_content_id: KEY_*` — this was the documented path on older firmware and is what most older HA tutorials show; on newer Tizen it is silently dropped.
- `media_player.play_media` with `media_content_type: app` and a numeric Tizen app id — silently dropped.
- `remote.send_command` with an app name string like `"Netflix"` — silently dropped.

**Works on the sibling `remote.*` entity:**
- `remote.send_command` with `command: KEY_*` — full Tizen key vocabulary (KEY_UP/DOWN/LEFT/RIGHT/ENTER/RETURN/HOME/PLAY/PAUSE/VOLUP/VOLDOWN/etc.). This is the correct path for D-pad, Back, Home, Play/Pause on these TVs.

**Why:** The Samsung core integration on 2022+ firmware moved key handling onto the dedicated `remote` entity (sibling to the media_player) and removed the legacy `send_key` escape hatch on `play_media`. The integration does not surface an error when an unsupported `media_content_type` is sent — it just doesn't forward to the TV.

**How to apply:** When building a remote/kiosk for a Samsung media_player, always send keys through `remote.send_command` on the sibling `remote.*` entity, never through `media_player.play_media`. Keep volume + power on the media_player since those services are still supported there.

**App deep-linking on 2022+ Tizen:** Neither `media_player.play_media { app }` nor `remote.send_command "<AppName>"` works. The only reliable path is installing the SmartThings HA integration, which exposes a `scene.*` per app that can be activated. Until that's set up, don't expose app shortcut buttons that pretend to work.
