from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import entity_registry as er

from .const import (
    DOMAIN,
    OPT_ALWAYS,
    OPT_ENTRY_DELAY,
    OPT_EXIT_DELAY,
    OPT_MOTION,
    OPT_PERIMETER,
    OPT_SIREN,
    OPT_TRIGGER_TIME,
    DEFAULT_ENTRY_DELAY,
    DEFAULT_EXIT_DELAY,
    DEFAULT_TRIGGER_TIME,
    # WLED/light options
    OPT_LIGHTS,
    OPT_LIGHT_COLOR,
    OPT_LIGHT_BRIGHTNESS,
    OPT_LIGHT_EFFECT,
    OPT_LIGHT_RESTORE,
    DEFAULT_LIGHT_COLOR,
    DEFAULT_LIGHT_BRIGHTNESS,
    DEFAULT_LIGHT_EFFECT,
    DEFAULT_LIGHT_RESTORE,
        # cameras
        OPT_CAMERAS,
        OPT_CAMERA_SHOW_ONLY_TRIGGERED,
        DEFAULT_CAMERA_SHOW_ONLY_TRIGGERED,
    # keypad options
    OPT_KEYPAD_ENABLED,
    OPT_KEYPAD_ENTITIES,
    OPT_ARM_HOME_ACTION,
    OPT_ARM_AWAY_ACTION,
    OPT_DISARM_ACTION,
    OPT_MASTER_PIN,
    DEFAULT_ARM_HOME_ACTION,
    DEFAULT_ARM_AWAY_ACTION,
    DEFAULT_DISARM_ACTION,
)

PLATFORMS = ["alarm_control_panel"]


def _normalize_options(entry: ConfigEntry) -> dict:
    opts = dict(entry.options)

    opts.setdefault(OPT_PERIMETER, [])
    opts.setdefault(OPT_MOTION, [])
    opts.setdefault(OPT_ALWAYS, [])

    opts.setdefault(OPT_SIREN, None)

    opts.setdefault(OPT_LIGHTS, [])
    opts.setdefault(OPT_LIGHT_COLOR, DEFAULT_LIGHT_COLOR)
    opts.setdefault(OPT_LIGHT_BRIGHTNESS, DEFAULT_LIGHT_BRIGHTNESS)
    opts.setdefault(OPT_LIGHT_EFFECT, DEFAULT_LIGHT_EFFECT)
    opts.setdefault(OPT_LIGHT_RESTORE, DEFAULT_LIGHT_RESTORE)

        opts.setdefault(OPT_CAMERAS, [])
        opts.setdefault(OPT_CAMERA_SHOW_ONLY_TRIGGERED, DEFAULT_CAMERA_SHOW_ONLY_TRIGGERED)

    opts.setdefault(OPT_EXIT_DELAY, DEFAULT_EXIT_DELAY)
    opts.setdefault(OPT_ENTRY_DELAY, DEFAULT_ENTRY_DELAY)
    opts.setdefault(OPT_TRIGGER_TIME, DEFAULT_TRIGGER_TIME)

    opts.setdefault(OPT_KEYPAD_ENABLED, False)
    opts.setdefault(OPT_KEYPAD_ENTITIES, [])
    opts.setdefault(OPT_MASTER_PIN, "")
    opts.setdefault(OPT_ARM_HOME_ACTION, DEFAULT_ARM_HOME_ACTION)
    opts.setdefault(OPT_ARM_AWAY_ACTION, DEFAULT_ARM_AWAY_ACTION)
    opts.setdefault(OPT_DISARM_ACTION, DEFAULT_DISARM_ACTION)

    return opts


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN].setdefault("entity_to_entry", {})  # alarm_entity_id -> entry_id

    # ensure defaults exist
    hass.config_entries.async_update_entry(entry, options=_normalize_options(entry))

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    async def handle_set_config(call: ServiceCall) -> None:
        alarm_entity = call.data["alarm_entity"]

        entry_id = hass.data[DOMAIN]["entity_to_entry"].get(alarm_entity)
        if entry_id is None:
            # fallback (rare): try to locate via entity registry
            ent_reg = er.async_get(hass)
            ent = ent_reg.async_get(alarm_entity)
            if ent and ent.unique_id:
                entry_id = ent.unique_id
            else:
                raise ValueError(f"Unknown ZigAlarm entity: {alarm_entity}")

        config_entry = hass.config_entries.async_get_entry(entry_id)
        if config_entry is None:
            raise ValueError("Config entry not found")

        new_opts = _normalize_options(config_entry)

        mapping = {
            "perimeter_sensors": OPT_PERIMETER,
            "motion_sensors": OPT_MOTION,
            "always_sensors": OPT_ALWAYS,
            "siren_entity": OPT_SIREN,
            "alarm_lights": OPT_LIGHTS,
            "alarm_light_color": OPT_LIGHT_COLOR,
            "alarm_light_brightness": OPT_LIGHT_BRIGHTNESS,
            "alarm_light_effect": OPT_LIGHT_EFFECT,
            "alarm_light_restore": OPT_LIGHT_RESTORE,
                "camera_entities": OPT_CAMERAS,
                "camera_show_only_triggered": OPT_CAMERA_SHOW_ONLY_TRIGGERED,
            "exit_delay": OPT_EXIT_DELAY,
            "entry_delay": OPT_ENTRY_DELAY,
            "trigger_time": OPT_TRIGGER_TIME,
            "keypad_enabled": OPT_KEYPAD_ENABLED,
            "keypad_entities": OPT_KEYPAD_ENTITIES,
            "master_pin": OPT_MASTER_PIN,
            "arm_home_action": OPT_ARM_HOME_ACTION,
            "arm_away_action": OPT_ARM_AWAY_ACTION,
            "disarm_action": OPT_DISARM_ACTION,
        }

        for key, opt_key in mapping.items():
            if key in call.data:
                new_opts[opt_key] = call.data[key]

        hass.config_entries.async_update_entry(config_entry, options=new_opts)

    hass.services.async_register(DOMAIN, "set_config", handle_set_config)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    return unload_ok
