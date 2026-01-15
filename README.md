# ZigAlarm – Alarmanlage für Home Assistant mit Zigbee2MQTT, WLED & Kameras

**ZigAlarm** verwandelt deine Zigbee2MQTT-Sensoren in eine vollwertige, einfach zu bedienende Alarmanlage für Home Assistant.

Prinzip:  
👉 *Installieren → Card einfügen → Sensoren im Menü auswählen → fertig.*

Unterstützt u. a.:

- Tür- und Fensterkontakte (Außenhaut)
- Bewegungsmelder (Innenraum)
- Rauch-, Wasser- und Sabotage-Sensoren (24/7)
- Optionale Sirene (`switch.*`, `siren.*`, `light.*`)
- **WLED / Licht-Effekte** bei Alarm (über Home-Assistant-Light-Entities)
- **Kameras** (camera.*) – z. B. nur bei Alarm anzeigen
- Optional: Keypad / Remote über Zigbee2MQTT `action`-Events

---

## ✨ Funktionen

### 🧠 Alarm-Logik (Backend)
- Eigenes `alarm_control_panel` in Home Assistant
- Modi:
  - `disarmed`
  - `arming`
  - `armed_home` (nur Außenhaut)
  - `armed_away` (Außenhaut + Bewegung)
  - `pending`
  - `triggered`
- Zonen:
  - **Perimeter** – Türen & Fenster
  - **Motion** – Bewegungsmelder
  - **Always (24/7)** – Rauch, Wasser, Sabotage
- Entry Delay, Exit Delay und Trigger-Zeit frei einstellbar
- **Always-Sensoren lösen immer aus – auch im `disarmed`-Modus**

### 🟢 Ready-to-Arm
- Erkennt automatisch offene Türen/Fenster
- Berechnet:
  - `ready_to_arm_home`
  - `ready_to_arm_away`
- Blockiert das Scharfschalten, wenn noch etwas offen ist
- Zeigt offene Sensoren direkt in der Card an

### 🔊 Sirene (optional)
- Wird bei `triggered` eingeschaltet
- Wird bei `disarm` wieder ausgeschaltet

### 💡 WLED / Alarm-Lichter (empfohlen)
- Auswahl beliebiger `light.*`-Entities (z. B. WLED)
- Konfigurierbar:
  - Farbe (Hex, z. B. `#ff0000`)
  - Helligkeit
  - Effekt (optional)
- Bei Alarm:
  - Lichter werden gesetzt (z. B. rotes Blinken)
- Bei `disarm`:
  - Vorheriger Lichtzustand wird automatisch wiederhergestellt

### 📷 Kameras (optional)
- Auswahl von `camera.*`-Entities in der Card
- Optional: nur bei `triggered` anzeigen
- Zusätzliches Event: `zigalarm_camera_alert` (z. B. für Push-Nachrichten oder Snapshots)

### 🔢 Keypad / Remote (optional)
- Aktivierbar über die Card
- Auswahl von `action`-Entities (z. B. `sensor.keypad_action`)
- Frei definierbare Action-Strings:
  - `arm_home`
  - `arm_away`
  - `disarm`
- Optionaler **Master-PIN** für das Unscharfschalten

### 📣 Events für Automationen
ZigAlarm feuert Events im Home-Assistant-Bus:

- `zigalarm_always_trigger`
- `zigalarm_arm_blocked`
- `zigalarm_disarm_denied`
- `zigalarm_camera_alert`

Damit lassen sich Push-Nachrichten, Logs oder weitere Aktionen umsetzen.

---

## 🧩 Installation (HACS)

1. Repository in HACS als **Custom Repository** hinzufügen  
2. Integration **ZigAlarm** installieren  
3. Home Assistant neu starten  
4. **Einstellungen → Geräte & Dienste → Integration hinzufügen → ZigAlarm**

### Card-Resource hinzufügen
**Einstellungen → Dashboards → Ressourcen**

- URL:  
  ```
  /hacsfiles/zigalarm/zigalarm-card.js
  ```
- Typ: *JavaScript Module*

### Card einfügen
```yaml
type: custom:zigalarm-card
alarm_entity: alarm_control_panel.zigalarm
```

Danach im Setup-Menü der Card die Sensoren auswählen und **Speichern** klicken.

---

## Hinweise zu Zigbee2MQTT-Keypads

Um die richtigen Action-Strings zu finden:

1. Home Assistant → Entwicklerwerkzeuge → Zustände  
2. Das `sensor.*_action` beobachten  
3. Am Keypad/Remote drücken  
4. Den angezeigten String in der Card eintragen

---

## Projektstruktur

- `custom_components/zigalarm/` – Backend-Integration  
- `www/zigalarm-card.js` – Custom Card (Frontend)

---

## Lizenz

MIT License – © LOW – Streaming  
Frei nutzbar mit Haftungsausschluss.

---

# ZigAlarm – Alarm System for Home Assistant with Zigbee2MQTT, WLED & Cameras

**ZigAlarm** turns your Zigbee2MQTT sensors into a simple but powerful alarm system for Home Assistant.

Concept:  
👉 *Install → add the card → select your entities → done.*

Works with:

- Door and window contacts (perimeter)
- Motion sensors (interior)
- Smoke, water and tamper sensors (24/7)
- Optional siren (`switch.*`, `siren.*`, `light.*`)
- **WLED / light effects** on alarm (via Home Assistant lights)
- **Cameras** (camera.*) – e.g. show only when triggered
- Optional keypad / remote using Zigbee2MQTT `action` events

---

## ✨ Features

### 🧠 Alarm Logic (Backend)
- Creates a real `alarm_control_panel` entity
- States:
  - `disarmed`
  - `arming`
  - `armed_home`
  - `armed_away`
  - `pending`
  - `triggered`
- Zones:
  - **Perimeter** – doors & windows
  - **Motion** – PIR sensors
  - **Always (24/7)** – smoke, water, tamper
- Configurable entry delay, exit delay and trigger time
- **Always sensors trigger even when disarmed**

### 🟢 Ready-to-Arm
- Detects open sensors automatically
- Calculates:
  - `ready_to_arm_home`
  - `ready_to_arm_away`
- Blocks arming if something is open
- Shows open sensors directly in the card

### 🔊 Siren (optional)
- Turns on when `triggered`
- Turns off when `disarmed`

### 💡 WLED / Alarm Lights (recommended)
- Select any `light.*` entities (e.g. WLED)
- Configure:
  - Color (hex)
  - Brightness
  - Effect (optional)
- On alarm:
  - Lights are set to alarm mode (e.g. red blinking)
- On disarm:
  - Previous light state is restored automatically

### 📷 Cameras (optional)
- Select `camera.*` entities in the card
- Optional: show only when `triggered`
- Additional event: `zigalarm_camera_alert` (for push notifications or snapshots)

### 🔢 Keypad / Remote (optional)
- Enable in the card
- Select one or more `action` entities
- Freely define action strings:
  - `arm_home`
  - `arm_away`
  - `disarm`
- Optional **master PIN** for disarming

### 📣 Events for Automations
ZigAlarm fires Home Assistant bus events:

- `zigalarm_always_trigger`
- `zigalarm_arm_blocked`
- `zigalarm_disarm_denied`
- `zigalarm_camera_alert`

These can be used for notifications, logging and advanced automations.

---

## 🧩 Installation (HACS)

1. Add this repository to HACS as a **Custom Repository**  
2. Install **ZigAlarm**  
3. Restart Home Assistant  
4. **Settings → Devices & Services → Add Integration → ZigAlarm**

### Add the Card Resource
**Settings → Dashboards → Resources**

- URL:
  ```
  /hacsfiles/zigalarm/zigalarm-card.js
  ```
- Type: *JavaScript Module*

### Add the Card
```yaml
type: custom:zigalarm-card
alarm_entity: alarm_control_panel.zigalarm
```

Open the card’s setup menu, select your entities and click **Save**.

---

## Notes for Zigbee2MQTT Keypads

To find the correct action strings:

1. Home Assistant → Developer Tools → States  
2. Watch the `sensor.*_action` entity  
3. Press buttons on the keypad/remote  
4. Copy the shown string into the card fields

---

## Repository Structure

- `custom_components/zigalarm/` – backend integration  
- `www/zigalarm-card.js` – custom Lovelace card

---

## License

MIT License – © LOW – Streaming  
Free to use with standard warranty disclaimer.
