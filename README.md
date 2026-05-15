[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![github_release](https://img.shields.io/github/v/release/openkairo/ZigAlarm?style=for-the-badge)](https://github.com/openkairo/ZigAlarm/releases)
[![github_license](https://img.shields.io/github/license/openkairo/ZigAlarm?style=for-the-badge)](https://github.com/openkairo/ZigAlarm/blob/master/LICENSE)

# 🛡️ ZigAlarm Infinity Edition (V1.0)

**Das ultimative taktische Sicherheits-Dashboard für Home Assistant.**

ZigAlarm Infinity verwandelt deine Home Assistant Installation in eine hochmoderne Sicherheitszentrale. Inspiriert von High-End "Cyber" Operating Systems bietet es nicht nur Schutz, sondern ein visuell beeindruckendes Erlebnis.

---

## 🚀 Übersicht

ZigAlarm ist eine "Zero-Configuration-Experience" Alarmanlage. Du wählst deine Sensoren einfach per Dropdown aus und das System erstellt automatisch eine native Home Assistant Alarmentität inklusive eines voll integrierten Side-Panels und einer Lovelace-Karte.

---

## ✨ Features (Infinity Edition)

### 🧠 Tactical Command Center (Panel)
Ein eigenständiges Full-Screen Dashboard in der Seitenleiste:
- **Cyber HUD Design**: Hochwertige Glasmorphismus-Aoptik mit taktischen Scanlines und Matrix-Effekten.
- **Echtzeit-Telemetrie**: Überwache den Status deiner Sensoren (Außenhaut, Innenraum, Sabotage).
- **Integrierte Kamera-Überwachung**: Live-Feeds deiner Sicherheitskameras direkt im Dashboard.

### 📜 Tactical Logbook (Neu in V1.0)
Ein direkt im Dashboard integriertes Logbuch, das:
- Echte Home Assistant Daten nutzt.
- Alarm-Ereignisse rot markiert.
- Status-Wechsel und Manipulationen übersetzt und visualisiert.

### 📷 Visual Guard
- Intelligente Kamera-Steuerung.
- Automatischer Fokus auf die auslösende Kamera bei Alarm.
- Ressourcen-schonendes Rendering zur Vermeidung von Browser-Instabilität.

### 💡 Tactical Lighting (WLED & Zigbee)
- Simuliert eine echte Alarmanlage durch visuelle Signalisierung.
- Unterstützung für WLED-Effekte und RGB-Farben.
- Automatisches Wiederherstellen der Beleuchtung nach dem Entschärfen.

---

## 🧩 Installation

### 1️⃣ HACS Integration
1. HACS -> Integrationen -> Drei Punkte (oben rechts) -> Benutzerdefiniertes Repository.
2. Link einfügen: `https://github.com/openkairo/ZigAlarm`
3. Kategorie: `Integration`.
4. Installieren und Home Assistant neu starten.

### 2️⃣ Einrichtung
1. Einstellungen -> Geräte & Dienste -> Integration hinzufügen -> **ZigAlarm**.
2. Wähle deine Sensoren, Sirenen und Kameras aus.
3. Die native Entität `alarm_control_panel.zigalarm` wird automatisch erstellt.

### 3️⃣ Frontend (Lovelace Card)
Für deine Dashboards kannst du die mitgelieferte Karte nutzen:
```yaml
type: custom:zigalarm-card
entity: alarm_control_panel.zigalarm
name: SECURITY CENTER
```

---

## 📍 Roadmap
- [ ] **Push-Notifications**: Native Benachrichtigungen an das Smartphone.
- [ ] **PIN-Code Keypad**: Unterstützung für externe Keypads und Panel-PIN.
- [ ] **Geofencing**: Automatisches Scharfschalten beim Verlassen der Zone.
- [x] **Logbuch**: Integrierte Historie (Erledigt in V1.0).

---

## ❤️ Unterstützung
Gefällt dir die Infinity Edition? Unterstütze die Entwicklung mit einer Spende!

[![paypal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=info@low-streaming.de&item_name=ZigAlarm+Support&currency_code=EUR)

**PayPal:** [info@low-streaming.de](https://paypal.me/lowstreaming)

---

## 📜 Lizenz
MIT License | © LOW -- Streaming
