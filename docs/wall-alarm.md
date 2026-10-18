# Wall Alarm panel

The wall's **Alarm** section uses the alarm panel and zone entities already
provided by Home Assistant's EyezOn/Envisalink integration. It does not connect
directly to EyezOn or require a new HA package.

## Deployment

The Alarm panel began in **1.0.74**; optional PIN-free controls require **1.0.75**. A development
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

Manually entered codes are transient and masked in the UI. Codes are never
stored in browser storage or server logs. Service errors are sanitized instead of echoing submitted codes.
No panic, raw keypad, force-arm, or zone-bypass commands are exposed.

## Optional PIN-free controls (1.0.75)

In HA → Settings → Add-ons → Wall Kiosk → Configuration, set:

- `alarm_pin_free`: on
- `alarm_panel_entity_id`: the exact alarm panel entity
- `alarm_code`: a dedicated normal alarm user code (password field)

Save and restart the Wall Kiosk add-on, then refresh its secure ingress page.
The wall will display a PIN-free warning. Arm/Disarm goes directly to confirmation,
without code entry. Anyone who can access the secure wall can disarm.

The saved code is stored in HA's add-on options, not an encrypted vault; protect
administrator access and backups. It is never returned to the browser. It is
injected only into requests for that exact entity using the local Supervisor
connection, never a browser-supplied HA URL. Direct HTTP remains read-only.
Development Studio connections still require manual code entry.

Turn `alarm_pin_free` off, save and restart the add-on to restore manual entry.
Clear `alarm_code` too if you no longer want it stored. An empty/invalid setup
fails closed to manual entry. No HA YAML package update is needed.

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
