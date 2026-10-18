# Wall Alarm panel

The wall's **Alarm** section uses the alarm panel and zone entities already
provided by Home Assistant's EyezOn/Envisalink integration. It does not connect
directly to EyezOn or require a new HA package.

## Deployment

This feature is in the project source for Wall Kiosk **1.0.74**. A development
preview is not an installed add-on update. The reviewed source must reach
GitHub, the add-on image build must succeed, and that version must be installed
in HA before an installed wall kiosk has the feature. Review outgoing commits
for household uploads before publishing source.

## Using it

- Open the kiosk through secure Home Assistant ingress (**Open Web UI**) or
  HTTPS. A direct HTTP/LAN kiosk may display status but cannot send alarm commands.
- Open **Alarm**. Choose the appropriate partition if there is more than one.
- Review keypad text, readiness, power/battery status, and open or bypassed zones.
  Zone labels are HA's names; rename entities in HA to provide room names.
- Choose a supported arm mode or Disarm, enter the **alarm-system code**, and
  confirm. This is not the kiosk's homeowner/storm-prep PIN.
- Wait for the live panel state to confirm the result. A successful service
  response alone is not proof that the alarm armed or disarmed.
- If a request times out, inspect the panel before retrying. The backend allows
  at most five alarm commands per minute per client/panel.

Codes are transient, masked in the UI, and not stored in browser storage or
server logs. Service errors are sanitized instead of echoing submitted codes.
No panic, raw keypad, force-arm, or zone-bypass commands are exposed.

## Acknowledging issues

Dismiss/acknowledge means **seen on this wall**. Active issues remain visible
with an acknowledged label. It does not clear a physical fault, silence the
alarm, cancel a monitoring dispatch, clear alarm memory, or bypass a zone.
Use the physical panel/integration's documented procedure to resolve panel
trouble; use the explicit Disarm action when disarming is intended.

An unavailable zone is not treated as closed. AC power on is healthy, whereas
panel-battery/problem on is a warning. A bypassed zone is explicitly marked
because it is not protecting the opening.

## Verification boundary

Development verification uses simulated HA responses, never a live arm,
disarm, panic, or bypass command. Successful deployment and live status
visibility do not prove an end-to-end physical alarm cycle.
