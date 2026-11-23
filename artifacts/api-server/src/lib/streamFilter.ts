// The SPAN panels report ~390 circuit sensors every few seconds and the
// Tempest reports wind every few seconds. Pushing all of that to a tablet
// would be ~80 updates a second for numbers the wall never shows, so the
// stream drops them and keeps only the panel totals.
const SPAN_KEEP = /_(current_power|site_power|grid_power|battery_power|solar_pv_power)$/;

export function shouldStreamEntity(entityId: string): boolean {
  if (entityId.startsWith("binary_sensor.span_panel")) return false;
  if (entityId.startsWith("sensor.span_panel")) return SPAN_KEEP.test(entityId);
  if (entityId.startsWith("sensor.makena_4_wind_")) return false;
  return true;
}
