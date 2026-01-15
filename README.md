# ZigAlarm – Home Assistant Alarm Panel for Zigbee2MQTT (with WLED)

ZigAlarm turns your Zigbee2MQTT sensors into a simple but solid Home Assistant alarm system:

**Install → add card → pick entities in the menu → done.**

Works great with:
- Door / window contacts (perimeter)
- PIR motion sensors (motion)
- Smoke / water / tamper sensors (always / 24/7)
- Optional siren (`switch.*`, `siren.*`, `light.*`)
- **WLED** (Variant A): pick your `light.*` entities and ZigAlarm will flash them on alarm

---

## Features

### Alarm logic (backend)
- Creates a real `alarm_control_panel` entity
- Modes:
  - `disarmed`, `arming`, `armed_home`, `armed_away`, `pending`, `triggered`
- Zones:
  - **Perimeter** (doors/windows)
  - **Motion** (PIR)
  - **Always (24/7)** (smoke/water/tamper) – triggers even when disarmed
- Entry/Exit delay + trigger time configurable

### Ready-to-arm
- Calculates open sensors automatically
- Blocks arming if something is open
- Exposes attributes:
  - `open_sensors`
  - `ready_to_arm_home`
  - `ready_to_arm_away`

### Siren (optional)
- Turns on at `triggered`
- Turns off on `disarm` (and after `trigger_time`)

### WLED / Alarm lights (Variant A – recommended)
- Select one or more `light.*` entities (WLED or any HA lights)
- Configure:
  - color (hex)
  - brightness (1..255)
  - effect (optional)
- On alarm: sets lights to your alarm look
- On disarm: **restores previous light states** (recommended)

### Keypad/Remote (optional)
- Enable keypad in the card
- Select one or more action entities (often `sensor.*_action` from Zigbee2MQTT)
- Configure action strings (defaults):
  - `arm_home`, `arm_away`, `disarm`
- Optional master PIN for disarm (if the keypad sends a code attribute)

### Events (for automations)
ZigAlarm fires events on the HA bus:
- `zigalarm_always_trigger` (always/24-7 sensor triggered)
- `zigalarm_arm_blocked` (arming blocked, includes open sensors list)
- `zigalarm_disarm_denied`
- `zigalarm_camera_alert` (wrong PIN / disarm denied)

---

## Installation (HACS)

1. Add this repository to HACS (as a custom repository)
2. Install **ZigAlarm**
3. Restart Home Assistant
4. Add integration: **Settings → Devices & services → Add integration → ZigAlarm**

### Add the card resource
**Settings → Dashboards → Resources**
- URL: `/hacsfiles/zigalarm/zigalarm-card.js`
- Type: JavaScript Module

### Add the card to your dashboard
```yaml
type: custom:zigalarm-card
alarm_entity: alarm_control_panel.zigalarm
```

Now open the card’s **Setup** section, pick your entities and click **Speichern**.

---

## Notes for Zigbee2MQTT Keypads
To find the correct action strings:
- Home Assistant → Developer Tools → States
- Watch the `sensor.*_action` while pressing keypad buttons
- Copy the resulting string into the card fields

---

## Repository structure

- `custom_components/zigalarm/` → backend integration
- `www/zigalarm-card.js` → custom Lovelace card

---

## License
MIT (recommended) – add a LICENSE file if you publish this.
