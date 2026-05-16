from __future__ import annotations

from pathlib import Path
from typing import Any
import json

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.components import panel_custom
from homeassistant.components.http import StaticPathConfig

from .const import (
    DOMAIN,
    PLATFORMS,
    OPT_PERIMETER,
    OPT_MOTION,
    OPT_ALWAYS,
    OPT_SIREN,
    OPT_SIREN_ENTITIES,
    OPT_LIGHTS,
    OPT_LIGHT_COLOR,
    OPT_LIGHT_BRIGHTNESS,
    OPT_LIGHT_EFFECT,
    OPT_LIGHT_RESTORE,
    OPT_CAMERAS,
    OPT_CAMERA_SHOW_ONLY_TRIGGERED,
    OPT_EXIT_DELAY,
    OPT_ENTRY_DELAY,
    OPT_TRIGGER_TIME,
    OPT_FORCE_ARM,
    OPT_SENSOR_MAPPINGS,
    DEFAULT_EXIT_DELAY,
    DEFAULT_ENTRY_DELAY,
    DEFAULT_TRIGGER_TIME,
    DEFAULT_LIGHT_COLOR,
    DEFAULT_LIGHT_BRIGHTNESS,
    DEFAULT_LIGHT_EFFECT,
    DEFAULT_LIGHT_RESTORE,
    DEFAULT_CAMERA_SHOW_ONLY_TRIGGERED,
)

# ✅ Pfade für Panel und Karten (liegen alle in frontend/)
PANEL_URL_PATH = "zigalarm-panel"
STATIC_URL = "/zigalarm_static"
STATIC_DIR = Path(__file__).resolve().parent / "frontend"


def _uniq_list(value: Any) -> list[str]:
    out: list[str] = []
    for x in (value or []):
        s = str(x).strip()
        if s and s not in out:
            out.append(s)
    return out


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN].setdefault("entity_to_entry", {})

    # ✅ Statische Dateien (Panel + Karten) registrieren
    if STATIC_DIR.exists():
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(STATIC_DIR), cache_headers=False)]
        )
    
    # ✅ Version für Cache-Busting laden (async-safe)
    version = "1.0.0"
    manifest_path = Path(__file__).parent / "manifest.json"
    if manifest_path.exists():
        try:
            def _read_version():
                with open(manifest_path) as f:
                    return json.load(f).get("version", "1.0.0")
            version = await hass.async_add_executor_job(_read_version)
        except Exception:
            pass

    # ✅ Panel registrieren
    try:
        await panel_custom.async_register_panel(
            hass,
            frontend_url_path=PANEL_URL_PATH,
            webcomponent_name="zigalarm-panel",
            module_url=f"{STATIC_URL}/zigalarm-panel.js?v={version}",
            sidebar_title="ZigAlarm Panel",
            sidebar_icon="mdi:shield-home",
            require_admin=False,
        )
    except TypeError:
        await panel_custom.async_register_panel(
            hass,
            url_path=PANEL_URL_PATH,
            webcomponent_name="zigalarm-panel",
            module_url=f"{STATIC_URL}/zigalarm-panel.js?v={version}",
            sidebar_title="ZigAlarm Panel",
            sidebar_icon="mdi:shield-home",
            require_admin=False,
        )

    # ✅ ZigAlarm-Karten als Lovelace-Resources registrieren
    from homeassistant.components.frontend import add_extra_js_url
    add_extra_js_url(hass, f"{STATIC_URL}/zigalarm-card-editor.js?v={version}")
    add_extra_js_url(hass, f"{STATIC_URL}/zigalarm-card.js?v={version}")

    async def handle_set_config(call: ServiceCall) -> None:
        data = dict(call.data or {})

        entry_id = (data.get("config_entry_id") or "").strip()

        if not entry_id:
            alarm_entity = (data.get("alarm_entity") or "").strip()
            if alarm_entity:
                entry_id = hass.data.get(DOMAIN, {}).get("entity_to_entry", {}).get(alarm_entity, "")

        if not entry_id:
            raise ValueError("config_entry_id fehlt (Entity prüfen)")

        entry: ConfigEntry | None = hass.config_entries.async_get_entry(entry_id)
        if not entry:
            raise ValueError(f"ConfigEntry nicht gefunden: {entry_id}")

        options = dict(entry.options or {})

        options[OPT_PERIMETER] = _uniq_list(data.get("perimeter_sensors"))
        options[OPT_MOTION] = _uniq_list(data.get("motion_sensors"))
        options[OPT_ALWAYS] = _uniq_list(data.get("always_sensors"))

        options[OPT_SIREN_ENTITIES] = _uniq_list(data.get("siren_entities"))
        options[OPT_SIREN] = (str(data.get("siren_entity") or "").strip() or None)

        options[OPT_LIGHTS] = _uniq_list(data.get("alarm_lights"))
        options[OPT_LIGHT_COLOR] = str(data.get("alarm_light_color") or DEFAULT_LIGHT_COLOR)
        options[OPT_LIGHT_BRIGHTNESS] = int(data.get("alarm_light_brightness") or DEFAULT_LIGHT_BRIGHTNESS)
        options[OPT_LIGHT_EFFECT] = str(data.get("alarm_light_effect") or DEFAULT_LIGHT_EFFECT)
        options[OPT_LIGHT_RESTORE] = bool(
            data.get("alarm_light_restore")
            if data.get("alarm_light_restore") is not None
            else DEFAULT_LIGHT_RESTORE
        )

        options[OPT_CAMERAS] = _uniq_list(data.get("camera_entities"))
        options[OPT_CAMERA_SHOW_ONLY_TRIGGERED] = bool(
            data.get("camera_show_only_triggered")
            if data.get("camera_show_only_triggered") is not None
            else DEFAULT_CAMERA_SHOW_ONLY_TRIGGERED
        )

        options[OPT_EXIT_DELAY] = int(data.get("exit_delay") or DEFAULT_EXIT_DELAY)
        options[OPT_ENTRY_DELAY] = int(data.get("entry_delay") or DEFAULT_ENTRY_DELAY)
        options[OPT_TRIGGER_TIME] = int(data.get("trigger_time") or DEFAULT_TRIGGER_TIME)
        options[OPT_FORCE_ARM] = bool(data.get("force_arm", False))
        options[OPT_SENSOR_MAPPINGS] = data.get("sensor_mappings") or {}

        hass.config_entries.async_update_entry(entry, options=options)
        await hass.config_entries.async_reload(entry.entry_id)

    hass.services.async_register(DOMAIN, "set_config", handle_set_config)

    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
