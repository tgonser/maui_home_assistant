# Energy Inventory

## Solar production (18)
| entity_id | friendly_name | state | unit | area |
| --- | --- | --- | --- | --- |
| `sensor.solar_15min_avg` | Solar 15min Avg | unknown | kW | — |
| `sensor.maui_solar_smoothed` | Maui Solar Smoothed | 0.0 | kW | — |
| `sensor.total_solar` | Total Solar | 0.0 | kW | — |
| `sensor.maui_solar_tier` | Maui Solar Tier | Poor |  | — |
| `sensor.mercer_island_solar_radiation` | Mercer Island Solar radiation | 17 | W/m² | — |
| `sensor.sun_valley_solar_radiation` | Sun Valley Solar radiation | 60 | W/m² | — |
| `sensor.makena_4_solar_radiation` | Makena 4 Solar radiation | 0 | W/m² | — |
| `sensor.4680_system_2_solar_power` | 4680 System 2 Solar power | 0.0 | kW | Garage |
| `sensor.gonser_4680_system_1_solar_power` | Gonser 4680 system 1 Solar power | 0.0 | kW | Garage |
| `sensor.4680_system_2_solar_generated` | 4680 System 2 Solar generated | 0.263 | kWh | Garage |
| `sensor.gonser_4680_system_1_solar_generated` | Gonser 4680 system 1 Solar generated | 0.261 | kWh | Garage |
| `sensor.envoy_202445013483_current_power_production` | Main Envoy Current power production | 0.0 | kW | — |
| `sensor.envoy_202445013483_energy_production_today` | Main Envoy Energy production today | 27944.08 | kWh | — |
| `sensor.envoy_202445013483_energy_production_last_seven_days` | Main Envoy Energy production last seven days | 27944.08 | kWh | — |
| `sensor.envoy_202445013483_lifetime_energy_production` | Main Envoy Lifetime energy production | 27.94408 | MWh | — |
| `sensor.envoy_202445013483_production_ct_energy_delivered` | Main Envoy Production CT energy delivered | 27.94408 | MWh | — |
| `sensor.envoy_202445013483_production_ct_energy_received` | Main Envoy Production CT energy received | 0.007687 | MWh | — |
| `sensor.envoy_202445013483_production_ct_power` | Main Envoy Production CT power | 0.0 | kW | — |

## Battery / Powerwall (17)
| entity_id | friendly_name | state | unit | area |
| --- | --- | --- | --- | --- |
| `sensor.temp_battery_state` | Tom_iPhone17 Temp Battery State | Not Charging |  | — |
| `sensor.temp_battery_level` | Tom_iPhone17 Temp Battery Level | 95 | % | — |
| `sensor.toms_ipad_battery_level` | Toms iPad Battery Level | 55 | % | — |
| `sensor.toms_ipad_battery_state` | Toms iPad Battery State | Not Charging |  | — |
| `sensor.total_battery_power` | Total Battery Power | 0.6 | kW | — |
| `sensor.battery_percent` | Battery Percent | 38.2 | % | — |
| `sensor.4680_system_2_battery_power` | 4680 System 2 Battery power | 0.0 | kW | Garage |
| `sensor.gonser_4680_system_1_battery_power` | Gonser 4680 system 1 Battery power | 0.602 | kW | Garage |
| `sensor.4680_system_2_battery_charged` | 4680 System 2 Battery charged | unknown | kWh | Garage |
| `sensor.4680_system_2_battery_discharged` | 4680 System 2 Battery discharged | 6.512 | kWh | Garage |
| `sensor.gonser_4680_system_1_battery_charged` | Gonser 4680 system 1 Battery charged | unknown | kWh | Garage |
| `sensor.gonser_4680_system_1_battery_discharged` | Gonser 4680 system 1 Battery discharged | 6.431 | kWh | Garage |
| `sensor.living_room_motion_battery` | UP sense - stairs Battery | 98 | % | Floor 2 Stairs |
| `sensor.pool_double_sliders_battery` | UP sense - Equipment closet Battery | 99 | % | Floor 1 Equipment/Utility |
| `sensor.usl_motion_battery` | USL-Motion_Bar Battery | 93 | % | Floor 1 Bar |
| `sensor.usl_motion_battery_2` | USL-Motion_Sitting Battery | 93 | % | Floor 2 Master Suite Sitting Room |
| `sensor.usl_motion_battery_3` | USL-Motion_BBQ Battery | 92 | % | BBQ outdoor kitchen |

## Grid import/export (7)
| entity_id | friendly_name | state | unit | area |
| --- | --- | --- | --- | --- |
| `sensor.4680_system_2_grid_power` | 4680 System 2 Grid power | 0.559 | kW | Garage |
| `sensor.gonser_4680_system_1_grid_power` | Gonser 4680 system 1 Grid power | 0.0 | kW | Garage |
| `sensor.4680_system_2_grid_imported` | 4680 System 2 Grid imported | 0.243 | kWh | Garage |
| `sensor.4680_system_2_grid_exported` | 4680 System 2 Grid exported | 0.016 | kWh | Garage |
| `sensor.gonser_4680_system_1_grid_imported` | Gonser 4680 system 1 Grid imported | 0.0285 | kWh | Garage |
| `sensor.gonser_4680_system_1_grid_exported` | Gonser 4680 system 1 Grid exported | 0.025 | kWh | Garage |
| `sensor.gonzonet` | GonzoNet Clients | 0 |  | — |

## Home / load consumption (7)
| entity_id | friendly_name | state | unit | area |
| --- | --- | --- | --- | --- |
| `sensor.total_home_load` | Total Home Load | 1.16 | kW | — |
| `sensor.4680_system_2_load_power` | 4680 System 2 Load power | 0.559 | kW | Garage |
| `sensor.gonser_4680_system_1_load_power` | Gonser 4680 system 1 Load power | 0.602 | kW | Garage |
| `sensor.4680_system_2_home_usage` | 4680 System 2 Home usage | 7.002 | kWh | Garage |
| `sensor.gonser_4680_system_1_home_usage` | Gonser 4680 system 1 Home usage | 6.6955 | kWh | Garage |
| `sensor.usp_pdu_pro_ac_power_consumption` | USP PDU Pro AC power consumption | 268.681 | W | — |
| `sensor.usp_pdu_pro_ac_power_consumption_2` | USP PDU Pro AC power consumption | 95.631 | W | — |

## Daily energy totals (kWh sensors) (14)
| entity_id | friendly_name | state | unit | area |
| --- | --- | --- | --- | --- |
| `sensor.4680_system_2_grid_imported` | 4680 System 2 Grid imported | 0.243 | kWh | Garage |
| `sensor.4680_system_2_home_usage` | 4680 System 2 Home usage | 7.002 | kWh | Garage |
| `sensor.4680_system_2_battery_charged` | 4680 System 2 Battery charged | unknown | kWh | Garage |
| `sensor.4680_system_2_battery_discharged` | 4680 System 2 Battery discharged | 6.512 | kWh | Garage |
| `sensor.4680_system_2_solar_generated` | 4680 System 2 Solar generated | 0.263 | kWh | Garage |
| `sensor.4680_system_2_grid_exported` | 4680 System 2 Grid exported | 0.016 | kWh | Garage |
| `sensor.gonser_4680_system_1_grid_imported` | Gonser 4680 system 1 Grid imported | 0.0285 | kWh | Garage |
| `sensor.gonser_4680_system_1_home_usage` | Gonser 4680 system 1 Home usage | 6.6955 | kWh | Garage |
| `sensor.gonser_4680_system_1_battery_charged` | Gonser 4680 system 1 Battery charged | unknown | kWh | Garage |
| `sensor.gonser_4680_system_1_battery_discharged` | Gonser 4680 system 1 Battery discharged | 6.431 | kWh | Garage |
| `sensor.gonser_4680_system_1_solar_generated` | Gonser 4680 system 1 Solar generated | 0.261 | kWh | Garage |
| `sensor.gonser_4680_system_1_grid_exported` | Gonser 4680 system 1 Grid exported | 0.025 | kWh | Garage |
| `sensor.envoy_202445013483_energy_production_today` | Main Envoy Energy production today | 27944.08 | kWh | — |
| `sensor.envoy_202445013483_energy_production_last_seven_days` | Main Envoy Energy production last seven days | 27944.08 | kWh | — |

## Suggested "Energy at a glance" entities
- **using now**: `sensor.total_home_load`
- **creating now**: `sensor.maui_solar_smoothed`
- **battery now**: `sensor.temp_battery_level`
- **grid used today**: `sensor.4680_system_2_grid_imported`