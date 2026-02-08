# 🛡️ ZigAlarm

### Alarmanlage für Home Assistant mit Zigbee2MQTT, WLED & Kameras

ZigAlarm verwandelt deine Zigbee2MQTT-Sensoren in eine moderne
Alarmanlage für Home Assistant.

👉 Installieren → Karte einfügen → Sensoren auswählen → fertig.

------------------------------------------------------------------------

# 🇩🇪 Deutsch

## ✨ Funktionen

### 🧠 Alarm-Logik (Backend)

Erstellt ein echtes `alarm_control_panel`.

**Zustände:** - disarmed - arming - armed_home - armed_away - pending -
triggered

**Zonen:** - Perimeter -- Türen & Fenster\
- Motion -- Bewegungsmelder\
- Always (24/7) -- Rauch, Wasser, Sabotage

Konfigurierbar: - Entry Delay - Exit Delay - Trigger-Zeit

Always-Sensoren lösen auch im disarmed-Modus aus.

------------------------------------------------------------------------

## 🟢 Ready-to-Arm

-   Erkennt offene Sensoren
-   Blockiert Scharfschalten bei offenen Türen/Fenstern
-   Zeigt offene Sensoren in der Card

------------------------------------------------------------------------

## 🔊 Sirene

Unterstützt: - switch.* - siren.* - light.\*

------------------------------------------------------------------------

## 💡 Alarm-Lichter / WLED

Beliebige light.\* Entities auswählbar.

Konfigurierbar: - Farbe (#ff0000) - Helligkeit - Effekt

Bei Alarm → Licht wird gesetzt\
Bei Disarm → Ursprungszustand wird wiederhergestellt

------------------------------------------------------------------------

## 📷 Kameras

-   camera.\* Entities auswählbar
-   Optional nur bei Alarm anzeigen
-   Kamera-Popup bei Alarm möglich

------------------------------------------------------------------------

## 📣 Events

-   zigalarm_always_trigger
-   zigalarm_arm_blocked
-   zigalarm_disarm_denied
-   zigalarm_camera_alert

------------------------------------------------------------------------

# 🧩 Installation (HACS)

1.  Repository hinzufügen: https://github.com/low-streaming/zigalarm
    Kategorie: Integration

2.  Installation

3.  Neustart

4.  Integration hinzufügen

------------------------------------------------------------------------

## Lovelace Resource

URL: /hacsfiles/zigalarm/zigalarm-card.js

Typ: JavaScript Module

------------------------------------------------------------------------

## Card

``` yaml
type: custom:zigalarm-card
alarm_entity: alarm_control_panel.zigalarm
```

------------------------------------------------------------------------

# 📜 License

MIT License\
© LOW -- Streaming
