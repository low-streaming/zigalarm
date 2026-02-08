# 🛡️ ZigAlarm

**Advanced Alarm System for Home Assistant**\
Zigbee2MQTT • WLED • Cameras • Keypad Support

------------------------------------------------------------------------

## 🚀 Overview

ZigAlarm turns your Zigbee2MQTT sensors into a powerful yet easy-to-use
alarm system for Home Assistant.

Concept:\
👉 Install → Add Card → Select Entities → Done.

------------------------------------------------------------------------

# ✨ Features

## 🧠 Real Alarm Control Panel

Creates a native `alarm_control_panel` entity.

### States

-   `disarmed`
-   `arming`
-   `armed_home`
-   `armed_away`
-   `pending`
-   `triggered`

### Zones

-   **Perimeter** -- Doors & windows\

-   **Motion** -- Interior movement\

-   **Always (24/7)** -- Smoke, water, tamper

-   Configurable entry delay\

-   Configurable exit delay\

-   Configurable trigger time\

-   Always-zone triggers even when disarmed

------------------------------------------------------------------------

## 🟢 Ready-to-Arm Logic

-   Detects open doors/windows automatically\
-   Calculates:
    -   `ready_to_arm_home`
    -   `ready_to_arm_away`
-   Blocks arming if sensors are open\
-   Displays open sensors directly in the card

------------------------------------------------------------------------

## 🔊 Siren Support (Optional)

-   Turns ON when alarm is triggered\
-   Turns OFF when disarmed\
-   Supports:
    -   `switch.*`
    -   `siren.*`
    -   `light.*`

------------------------------------------------------------------------

## 💡 Alarm Lights / WLED Support

Select any `light.*` entity.

Configurable:

-   Color (Hex, e.g. `#ff0000`)
-   Brightness
-   Effect
-   Restore previous state after disarm

When triggered: - Lights switch to alarm mode (e.g. red flashing)

When disarmed: - Previous light state is automatically restored

------------------------------------------------------------------------

## 📷 Camera Support

-   Select one or multiple `camera.*` entities
-   Optional: show cameras only when triggered
-   Fires event: `zigalarm_camera_alert`

Perfect for: - Snapshots - Push notifications - Mobile alerts

------------------------------------------------------------------------

## 🔢 Keypad / Remote Support (Optional)

Supports Zigbee2MQTT action-based keypads.

Configure:

-   `arm_home`
-   `arm_away`
-   `disarm`
-   Optional Master PIN (only for keypad disarm)

------------------------------------------------------------------------

# 📣 Events (for Automations)

ZigAlarm fires Home Assistant events:

-   `zigalarm_always_trigger`
-   `zigalarm_arm_blocked`
-   `zigalarm_disarm_denied`
-   `zigalarm_camera_alert`

------------------------------------------------------------------------

# 🧩 Installation (HACS)

## 1️⃣ Add Custom Repository

HACS → Integrations → ⋮ → Custom Repositories

Repository: https://github.com/low-streaming/zigalarm

Category: Integration

------------------------------------------------------------------------

## 2️⃣ Install Integration

-   Install ZigAlarm\
-   Restart Home Assistant\
-   Settings → Devices & Services → Add Integration → ZigAlarm

------------------------------------------------------------------------

## 3️⃣ Add Card Resource

Settings → Dashboards → Resources

Add:

URL: `/hacsfiles/zigalarm/zigalarm-card.js`\
Type: JavaScript Module

------------------------------------------------------------------------

## 4️⃣ Add the Card

``` yaml
type: custom:zigalarm-card
alarm_entity: alarm_control_panel.zigalarm
```

------------------------------------------------------------------------

# 📂 Repository Structure

    custom_components/zigalarm/   → Backend integration
    www/zigalarm-card.js          → Lovelace card

------------------------------------------------------------------------

# 📜 License

MIT License\
© LOW -- Streaming

Free to use. No warranty.

------------------------------------------------------------------------

⭐ If you like the project, consider starring the repository.
