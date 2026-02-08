🛡️ ZigAlarm
Alarmanlage für Home Assistant mit Zigbee2MQTT, WLED & Kameras

ZigAlarm verwandelt deine Zigbee2MQTT-Sensoren in eine vollwertige, moderne und einfach zu bedienende Alarmanlage für Home Assistant.

Prinzip:
👉 Installieren → Karte einfügen → Sensoren auswählen → fertig.

🇩🇪 Deutsch
✨ Funktionen
🧠 Alarm-Logik (Backend)

Erstellt ein echtes alarm_control_panel in Home Assistant.

Zustände:

disarmed

arming

armed_home (nur Außenhaut)

armed_away (Außenhaut + Bewegung)

pending

triggered

Zonen:

Perimeter – Türen & Fenster

Motion – Bewegungsmelder

Always (24/7) – Rauch, Wasser, Sabotage

Konfigurierbar:

Entry Delay

Exit Delay

Trigger-Zeit

Always-Sensoren lösen immer aus, auch im disarmed-Modus.

🟢 Ready-to-Arm

Erkennt automatisch offene Türen/Fenster

Berechnet:

ready_to_arm_home

ready_to_arm_away

Blockiert das Scharfschalten, wenn noch etwas offen ist

Zeigt offene Sensoren direkt in der Card an

🔊 Sirene (optional)

Unterstützt:

switch.*

siren.*

light.*

Verhalten:

Einschalten bei triggered

Ausschalten bei disarm

💡 WLED / Alarm-Lichter (empfohlen)

Beliebige light.* Entities auswählbar (z. B. WLED).

Konfigurierbar:

Farbe (Hex, z. B. #ff0000)

Helligkeit

Effekt (optional)

Bei Alarm:

Lichter werden gesetzt (z. B. rotes Blinken)

Bei disarm:

Vorheriger Lichtzustand wird automatisch wiederhergestellt

📷 Kameras (optional)

Auswahl von camera.* Entities in der Card

Optional: nur bei triggered anzeigen

Kamera-Popup bei Alarm möglich

Zusätzliches Event: zigalarm_camera_alert

Ideal für:

Push-Nachrichten

Snapshot-Automationen

Externe Benachrichtigungen

🔢 Keypad / Remote (optional)

Zigbee2MQTT Keypads oder Remotes werden über action-Entities eingebunden.

Konfigurierbar:

arm_home

arm_away

disarm

Optional:

Master-PIN für Unscharfschalten

📣 Events für Automationen

ZigAlarm feuert folgende Events im HA-Eventbus:

zigalarm_always_trigger

zigalarm_arm_blocked

zigalarm_disarm_denied

zigalarm_camera_alert

Damit lassen sich:

Push-Nachrichten

Logs

Snapshots

Erweiterte Automationen

umsetzen.

🧩 Installation (HACS)

HACS öffnen

Custom Repository hinzufügen:

https://github.com/low-streaming/zigalarm


Kategorie: Integration

ZigAlarm installieren

Home Assistant neu starten

Einstellungen → Geräte & Dienste → Integration hinzufügen → ZigAlarm

🧩 Lovelace Card Resource hinzufügen

Einstellungen → Dashboards → Ressourcen

URL:
/hacsfiles/zigalarm/zigalarm-card.js

Typ:
JavaScript Module

🧩 Karte hinzufügen
type: custom:zigalarm-card
alarm_entity: alarm_control_panel.zigalarm


Danach im Setup-Menü der Card:

Sensoren auswählen

Sirenen definieren

Lichter konfigurieren

Kameras hinzufügen

Speichern klicken

🔍 Hinweise zu Zigbee2MQTT Keypads

So findest du die richtigen Action-Strings:

Entwicklerwerkzeuge → Zustände

Das sensor.*_action beobachten

Am Keypad drücken

Angezeigten String in der Card eintragen

📂 Projektstruktur
custom_components/zigalarm/
    __init__.py
    alarm_control_panel.py
    config_flow.py
    const.py
    manifest.json
    services.yaml

www/zigalarm-card.js
www/zigalarm-card-editor.js

🇬🇧 English
🛡️ ZigAlarm – Alarm System for Home Assistant

ZigAlarm turns your Zigbee2MQTT sensors into a modern and powerful alarm system for Home Assistant.

Concept:
👉 Install → Add card → Select entities → Done.

Features

Real alarm_control_panel entity

Perimeter / Motion / Always zones

Entry & Exit delays

Optional siren support

WLED / light alarm effects

Camera popup on trigger

Optional Zigbee2MQTT keypad support

Event-based automation hooks

Installation (HACS)

Add this repository as Custom Repository:

https://github.com/low-streaming/zigalarm


Category: Integration

Install ZigAlarm

Restart Home Assistant

Add Integration

Add Card Resource
/hacsfiles/zigalarm/zigalarm-card.js


Type: JavaScript Module

Add Card
type: custom:zigalarm-card
alarm_entity: alarm_control_panel.zigalarm

Repository Structure
custom_components/zigalarm/ – backend
www/zigalarm-card.js – Lovelace card

📜 License

MIT License
© LOW – Streaming

Free to use with standard warranty disclaimer.

❤️ Support

If you like ZigAlarm:

⭐ Star the repository
🐛 Report bugs
💡 Suggest features
