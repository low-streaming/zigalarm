[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![github_release](https://img.shields.io/github/v/release/low-streaming/zigalarm?style=for-the-badge)](https://github.com/low-streaming/zigalarm/releases)
[![github_license](https://img.shields.io/github/license/low-streaming/zigalarm?style=for-the-badge)](https://github.com/low-streaming/zigalarm/blob/master/LICENSE)

# 🛡️ ZigAlarm

------------------------------------------------------------------------

# 🇩🇪 Deutsch

## 🚀 Übersicht

ZigAlarm verwandelt deine Zigbee2MQTT-Sensoren in eine leistungsstarke
und dennoch einfach zu bedienende Alarmanlage für Home Assistant.

Prinzip:\
👉 Installieren → Karte hinzufügen → Entitäten auswählen → Fertig.

------------------------------------------------------------------------

## ✨ Funktionen

### 🧠 Echtes Alarm-Control-Panel

Erstellt eine native `alarm_control_panel`-Entität.

**Zustände:**

-   `disarmed`
-   `arming`
-   `armed_home`
-   `armed_away`
-   `pending`
-   `triggered`

**Zonen:**

-   Außenhaut (Türen & Fenster)
-   Bewegung (Innenraum)
-   24/7 (Rauch, Wasser, Sabotage)

Einstellbar:

-   Eingangsverzögerung
-   Ausgangsverzögerung
-   Alarmdauer

24/7-Zonen lösen auch im `disarmed`-Modus aus.

------------------------------------------------------------------------

### 🟢 Ready-to-Arm Logik

-   Erkennt automatisch offene Sensoren
-   Berechnet:
    -   `ready_to_arm_home`
    -   `ready_to_arm_away`
-   Blockiert Scharfschaltung bei offenen Sensoren
-   Zeigt offene Sensoren in der Karte an

------------------------------------------------------------------------

### 🔊 Sirenen-Unterstützung

Unterstützt:

-   `switch.*`
-   `siren.*`
-   `light.*`

Wird bei Alarm aktiviert und bei Unscharf deaktiviert.

------------------------------------------------------------------------

### 💡 Alarm-Lichter / WLED

Beliebige `light.*`-Entitäten auswählbar.

Konfigurierbar:

-   Farbe (Hex)
-   Helligkeit
-   Effekt
-   Wiederherstellung des ursprünglichen Zustands

------------------------------------------------------------------------

### 📷 Kamera-Unterstützung

-   Mehrere `camera.*` Entitäten auswählbar
-   Optional nur bei Alarm anzeigen
-   Event: `zigalarm_camera_alert`

------------------------------------------------------------------------

## 🧩 Installation (HACS)

### 1️⃣ Repository hinzufügen

HACS → Integrationen → Benutzerdefiniertes Repository

Repository: https://github.com/low-streaming/zigalarm

Kategorie: Integration

------------------------------------------------------------------------

### 2️⃣ Integration installieren

-   ZigAlarm installieren
-   Home Assistant neu starten
-   Einstellungen → Geräte & Dienste → Integration hinzufügen → ZigAlarm

------------------------------------------------------------------------

### 3️⃣ Karten-Ressource hinzufügen

Einstellungen → Dashboards → Ressourcen

URL: /hacsfiles/zigalarm/zigalarm-card.js

Typ: JavaScript Module

------------------------------------------------------------------------

### 4️⃣ Karte hinzufügen

#### Minimal

``` yaml
type: custom:zigalarm-card
alarm_entity: alarm_control_panel.zigalarm
```

#### Vollständige Konfiguration

``` yaml
type: custom:zigalarm-card
alarm_entity: alarm_control_panel.zigalarm
name: ZigAlarm
show_setup: false
show_cameras: popup
use_panel_cameras: true
popup_on_trigger: true
popup_only_when_triggered: true
popup_auto_close_on_disarm: true
popup_title: Alarm-Kameras
camera_card: picture-entity
```

------------------------------------------------------------------------

# 🇬🇧 English

## 🚀 Overview

ZigAlarm turns your Zigbee2MQTT sensors into a powerful yet easy-to-use
alarm system for Home Assistant.

Concept:\
👉 Install → Add Card → Select Entities → Done.

------------------------------------------------------------------------

## ✨ Features

### 🧠 Real Alarm Control Panel

Creates a native `alarm_control_panel` entity.

**States:**

-   `disarmed`
-   `arming`
-   `armed_home`
-   `armed_away`
-   `pending`
-   `triggered`

**Zones:**

-   Perimeter (doors & windows)
-   Motion (interior)
-   24/7 (smoke, water, tamper)

Configurable:

-   Entry delay
-   Exit delay
-   Trigger time

24/7 zones trigger even when disarmed.

------------------------------------------------------------------------

### 🟢 Ready-to-Arm Logic

-   Automatically detects open sensors
-   Calculates:
    -   `ready_to_arm_home`
    -   `ready_to_arm_away`
-   Blocks arming if sensors are open
-   Displays open sensors inside the card

------------------------------------------------------------------------

### 🔊 Siren Support

Supports:

-   `switch.*`
-   `siren.*`
-   `light.*`

Turns on when triggered and off when disarmed.

------------------------------------------------------------------------

### 💡 Alarm Lights / WLED

Select any `light.*` entity.

Configurable:

-   Color (Hex)
-   Brightness
-   Effect
-   Restore previous state on disarm

------------------------------------------------------------------------

### 📷 Camera Support

-   Select multiple `camera.*` entities
-   Optional: show only when triggered
-   Event: `zigalarm_camera_alert`

------------------------------------------------------------------------

## 📂 Repository Structure

custom_components/zigalarm/ → Backend integration\
www/zigalarm-card.js → Lovelace card

------------------------------------------------------------------------

## 📜 License

MIT License\
© LOW -- Streaming\
Free to use. No warranty.
