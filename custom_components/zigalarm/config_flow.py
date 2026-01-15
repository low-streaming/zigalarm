from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback

from .const import DOMAIN, CONF_NAME


class ZigAlarmConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(
                title=user_input[CONF_NAME],
                data=user_input,
                options={},  # defaults will be applied in __init__.py
            )

        schema = vol.Schema({vol.Required(CONF_NAME, default="ZigAlarm"): str})
        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return ZigAlarmOptionsFlow(config_entry)


class ZigAlarmOptionsFlow(config_entries.OptionsFlow):
    def __init__(self, config_entry):
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        # Minimal placeholder. Main configuration is done from the custom card.
        return self.async_show_form(step_id="init", data_schema=vol.Schema({}))
