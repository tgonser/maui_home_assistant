# Changelog

## 1.0.0

- Initial release
- HA ingress sidebar panel at `/`
- Direct kiosk/tablet access at `/wall` on port 8099
- Solar-aware energy dashboard with hourly cost accuracy
- Monthly grid cost chart via HA long-term statistics
- Cameras, climate, music, lighting, shades, locks, scenes, sensors
- Fully local — no Nabu Casa or Replit dependency
- `SUPERVISOR_TOKEN` used server-side; browser never sees HA token
- Auto-reconnect on connection loss
- Watchdog health check via `/api/healthz`
