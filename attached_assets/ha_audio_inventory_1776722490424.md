# Audio / Media Inventory

Total media players: **28**

## By integration
- **unifiprotect** — 6
- **bluesound** — 6
- **cast** — 5
- **dlna_dmr** — 3
- **sonos** — 3
- **androidtv_remote** — 1
- **samsungtv** — 1
- **apple_tv** — 1
- **homekit_controller** — 1
- **androidtv** — 1

## All media players
| entity_id | friendly_name | area | integration | state | source | volume |
| --- | --- | --- | --- | --- | --- | --- |
| `media_player.south_pool_g6_ptz_speaker` | South Pool G6 PTZ Speaker | South Yard | unifiprotect | idle |  | 100% |
| `media_player.bbq_g6_ptz_speaker` | BBQ G6 PTZ Speaker | _unassigned_ | unifiprotect | idle |  | 100% |
| `media_player.g6_instant_speaker` | G6 Instant Speaker | _unassigned_ | unifiprotect | idle |  | 100% |
| `media_player.entry_g6_ptz_speaker` | Entry G6 PTZ Speaker | _unassigned_ | unifiprotect | idle |  | 100% |
| `media_player.mud_room_door_hub_entry_speaker` | Mud room door hub - Entry Speaker | _unassigned_ | unifiprotect | idle |  | 100% |
| `media_player.master_lanai_g6_ptz_speaker` | Master Lanai G6 PTZ Speaker | _unassigned_ | unifiprotect | idle |  | 100% |
| `media_player.master_bed_tv_2` | master bed tv | Floor 2 Master Suite Master Bed | androidtv_remote | unavailable |  | — |
| `media_player.65_the_frame_2` | 65" The Frame | Sitting Room | samsungtv | off |  | — |
| `media_player.jbl_bar_1300_a78f` | JBL BAR 1300_A78F | Floor 1 Bar | cast | off |  | — |
| `media_player.master_bed_tv` | master bed tv | _unassigned_ | cast | unavailable |  | — |
| `media_player.great_room` | Great Room | Floor 1 Great Room Atrium | bluesound | playing | Hub | 32% |
| `media_player.great_room_lanai` | Great Room Lanai | Floor 1 Great room lanai | bluesound | idle | HDMI ARC | 40% |
| `media_player.master_sitting_room` | Master Sitting Room | Floor 2 Master Suite Sitting Room | bluesound | playing | Spotify | 14% |
| `media_player.master_bed` | Master Bed | Floor 2 Master Suite Master Bed | bluesound | idle |  | 13% |
| `media_player.bbq_lanai` | BBQ Lanai | BBQ outdoor kitchen | bluesound | idle |  | 27% |
| `media_player.great_room_tv_bsr` | Great Room TV Bsr | Floor 1 Great Room Atrium | bluesound | idle |  | 28% |
| `media_player.65_oled` | 65" OLED | TV Bar | dlna_dmr | unavailable |  | — |
| `media_player.65_the_frame` | 65" The Frame | _unassigned_ | dlna_dmr | unavailable |  | — |
| `media_player.jbl_bar_1300_a78f_2` | audiocast JBL BAR 1300_A78F | _unassigned_ | dlna_dmr | playing |  | 48% |
| `media_player.lr_apple_tv` | LR Apple TV | LR | apple_tv | off |  | — |
| `media_player.house` | media_player.house | House | sonos | unavailable |  | — |
| `media_player.pool` | media_player.pool | Pool | sonos | unavailable |  | — |
| `media_player.tv_bar` | media_player.tv_bar | TV Bar | sonos | unavailable |  | — |
| `media_player.lg_webos_tv_2bc9` | LG webOS TV 2BC9 | Living Room | homekit_controller | unavailable |  | — |
| `media_player.65_oled_2` | media_player.65_oled_2 | Floor 1 Bar | cast | unavailable |  | — |
| `media_player.molokini_room_tv` | media_player.molokini_room_tv | _unassigned_ | cast | unavailable |  | — |
| `media_player.65_the_frame_3` | media_player.65_the_frame_3 | _unassigned_ | cast | unavailable |  | — |
| `media_player.fire_tv_192_168_1_131` | Atrium TV | Living Room | androidtv | idle |  | — |

## Bluesound / BluOS (6)
### `media_player.great_room`
- friendly_name: Great Room
- area: Floor 1 Great Room Atrium
- state: playing
- source_list: Analog Input, Bluetooth, HDMI ARC, Optical Input, Spotify, USB C
- supported_features: 720445
### `media_player.great_room_lanai`
- friendly_name: Great Room Lanai
- area: Floor 1 Great room lanai
- state: idle
- source_list: Bluetooth, HDMI ARC
- supported_features: 720445
### `media_player.master_sitting_room`
- friendly_name: Master Sitting Room
- area: Floor 2 Master Suite Sitting Room
- state: playing
- source_list: Morning bedroom, Bluetooth, HDMI ARC, Spotify
- supported_features: 720447
- group_members: media_player.master_sitting_room, media_player.master_bed
### `media_player.master_bed`
- friendly_name: Master Bed
- area: Floor 2 Master Suite Master Bed
- state: idle
- supported_features: 525324
- group_members: media_player.master_sitting_room, media_player.master_bed
### `media_player.bbq_lanai`
- friendly_name: BBQ Lanai
- area: BBQ outdoor kitchen
- state: idle
- source_list: Bluetooth, HDMI ARC, Spotify
- supported_features: 720445
### `media_player.great_room_tv_bsr`
- friendly_name: Great Room TV Bsr
- area: Floor 1 Great Room Atrium
- state: idle
- source_list: Bluetooth, HDMI ARC
- supported_features: 720445

## Sonos (3)
### `media_player.house`
- friendly_name: media_player.house
- area: House
- state: unavailable
- supported_features: 4127295
### `media_player.pool`
- friendly_name: media_player.pool
- area: Pool
- state: unavailable
- supported_features: 4127295
### `media_player.tv_bar`
- friendly_name: media_player.tv_bar
- area: TV Bar
- state: unavailable
- source_list: TV
- supported_features: 4127295

## TVs / streamers (8)
### `media_player.master_bed_tv_2`
- friendly_name: master bed tv
- area: Floor 2 Master Suite Master Bed
- state: unavailable
- supported_features: 153529
### `media_player.master_bed_tv`
- friendly_name: master bed tv
- area: _unassigned_
- state: unavailable
- supported_features: 152461
### `media_player.great_room_tv_bsr`
- friendly_name: Great Room TV Bsr
- area: Floor 1 Great Room Atrium
- state: idle
- source_list: Bluetooth, HDMI ARC
- supported_features: 720445
### `media_player.lr_apple_tv`
- friendly_name: LR Apple TV
- area: LR
- state: off
- supported_features: 448439
### `media_player.tv_bar`
- friendly_name: media_player.tv_bar
- area: TV Bar
- state: unavailable
- source_list: TV
- supported_features: 4127295
### `media_player.lg_webos_tv_2bc9`
- friendly_name: LG webOS TV 2BC9
- area: Living Room
- state: unavailable
- source_list: AirPlay, Live TV, HDMI 1, Sonos, Apple, AV, HDMI 4, LOGICAL HDMI 1, LOGICAL HDMI 2, LOGICAL HDMI 3, LOGICAL HDMI 4, LOGICAL HDMI 5, LOGICAL HDMI 6, LOGICAL HDMI 7, LOGICAL HDMI 8, LOGICAL HDMI 9, LOGICAL HDMI 10, LOGICAL HDMI 11
- supported_features: 18817
### `media_player.molokini_room_tv`
- friendly_name: media_player.molokini_room_tv
- area: _unassigned_
- state: unavailable
- supported_features: 152461
### `media_player.fire_tv_192_168_1_131`
- friendly_name: Atrium TV
- area: Living Room
- state: idle
- supported_features: 22961

## Audio scene candidates
### Audio zones (rooms with media players)
- **South Yard** — `media_player.south_pool_g6_ptz_speaker`
- **_unassigned_** — `media_player.bbq_g6_ptz_speaker`, `media_player.g6_instant_speaker`, `media_player.entry_g6_ptz_speaker`, `media_player.mud_room_door_hub_entry_speaker`, `media_player.master_lanai_g6_ptz_speaker`, `media_player.master_bed_tv`, `media_player.65_the_frame`, `media_player.jbl_bar_1300_a78f_2`, `media_player.molokini_room_tv`, `media_player.65_the_frame_3`
- **Floor 2 Master Suite Master Bed** — `media_player.master_bed_tv_2`, `media_player.master_bed`
- **Sitting Room** — `media_player.65_the_frame_2`
- **Floor 1 Bar** — `media_player.jbl_bar_1300_a78f`, `media_player.65_oled_2`
- **Floor 1 Great Room Atrium** — `media_player.great_room`, `media_player.great_room_tv_bsr`
- **Floor 1 Great room lanai** — `media_player.great_room_lanai`
- **Floor 2 Master Suite Sitting Room** — `media_player.master_sitting_room`
- **BBQ outdoor kitchen** — `media_player.bbq_lanai`
- **TV Bar** — `media_player.65_oled`, `media_player.tv_bar`
- **LR** — `media_player.lr_apple_tv`
- **House** — `media_player.house`
- **Pool** — `media_player.pool`
- **Living Room** — `media_player.lg_webos_tv_2bc9`, `media_player.fire_tv_192_168_1_131`