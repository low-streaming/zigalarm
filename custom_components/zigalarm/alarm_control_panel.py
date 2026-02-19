from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Iterable, Optional

from homeassistant.components.alarm_control_panel import (
    AlarmControlPanelEntity,
    AlarmControlPanelEntityFeature,
    AlarmControlPanelState,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback, Event
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.helpers.restore_state import RestoreEntity

from .const import (
    DOMAIN,
    OPT_ALWAYS,
    OPT_ENTRY_DELAY,
    OPT_EXIT_DELAY,
    OPT_MOTION,
    OPT_PERIMETER,
    OPT_SIREN,
    OPT_SIREN_ENTITIES,
    OPT_TRIGGER_TIME,
    OPT_FORCE_ARM,
    DEFAULT_ENTRY_DELAY,
    DEFAULT_EXIT_DELAY,
    DEFAULT_TRIGGER_TIME,
    # lights
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
    # keypad (optional)
    OPT_KEYPAD_ENABLED,
    OPT_KEYPAD_ENTITIES,
    OPT_ARM_HOME_ACTION,
    OPT_ARM_AWAY_ACTION,
    OPT_DISARM_ACTION,
    OPT_MASTER_PIN,
)


def _uniq_clean(items: Any) -> list[str]:
    out: list[str] = []
    for x in (items or []):
        s = str(x).strip()
        if s and s not in out:
            out.append(s)
    return out


def _domain(entity_id: str) -> str:
    return entity_id.split(".", 1)[0] if entity_id and "." in entity_id else ""


@dataclass
class ArmedProfile:
    perimeter: bool
    motion: bool


PROFILES = {
    AlarmControlPanelState.ARMED_HOME: ArmedProfile(perimeter=True, motion=False),
    AlarmControlPanelState.ARMED_AWAY: ArmedProfile(perimeter=True, motion=True),
}


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities):
    name = entry.data.get("name", "ZigAlarm")
    async_add_entities([ZigAlarmPanel(hass, entry, name)])


class ZigAlarmPanel(AlarmControlPanelEntity, RestoreEntity):
    _attr_has_entity_name = True
    _attr_supported_features = (
        AlarmControlPanelEntityFeature.ARM_HOME
        | AlarmControlPanelEntityFeature.ARM_AWAY
        | AlarmControlPanelEntityFeature.TRIGGER
    )

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, name: str):
        self.hass = hass
        self.entry = entry
        self._attr_name = name
        self._attr_unique_id = entry.entry_id

        self._state: AlarmControlPanelState = AlarmControlPanelState.DISARMED

        self._unsub = None
        self._arming_task: Optional[asyncio.Task] = None
        self._pending_task: Optional[asyncio.Task] = None
        self._trigger_task: Optional[asyncio.Task] = None

        self._last_trigger_entity: Optional[str] = None
        self._open_sensors: list[str] = []
        self._ready_home: bool = True
        self._ready_away: bool = True

        # light restore cache (only for light.*)
        self._light_snapshot: dict[str, dict[str, Any]] = {}

    # ---------------------- NO PIN / NO CODE ----------------------

    @property
    def code_format(self) -> str | None:
        return None

    @property
    def code_arm_required(self) -> bool:
        return False

    @property
    def code_disarm_required(self) -> bool:
        return False

    # ---------------------- HA Entity Basics ----------------------

    @property
    def state(self) -> AlarmControlPanelState:
        return self._state

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        opts = self.entry.options or {}
        return {
            "config_entry_id": self.entry.entry_id,

            "perimeter_sensors": _uniq_clean(opts.get(OPT_PERIMETER, [])),
            "motion_sensors": _uniq_clean(opts.get(OPT_MOTION, [])),
            "always_sensors": _uniq_clean(opts.get(OPT_ALWAYS, [])),

            "siren_entity": (opts.get(OPT_SIREN) or None),
            "siren_entities": _uniq_clean(opts.get(OPT_SIREN_ENTITIES, [])),

            "alarm_lights": _uniq_clean(opts.get(OPT_LIGHTS, [])),
            "alarm_light_color": opts.get(OPT_LIGHT_COLOR, DEFAULT_LIGHT_COLOR),
            "alarm_light_brightness": int(opts.get(OPT_LIGHT_BRIGHTNESS, DEFAULT_LIGHT_BRIGHTNESS)),
            "alarm_light_effect": opts.get(OPT_LIGHT_EFFECT, DEFAULT_LIGHT_EFFECT),
            "alarm_light_restore": bool(opts.get(OPT_LIGHT_RESTORE, DEFAULT_LIGHT_RESTORE)),

            "camera_entities": _uniq_clean(opts.get(OPT_CAMERAS, [])),
            "camera_show_only_triggered": bool(
                opts.get(OPT_CAMERA_SHOW_ONLY_TRIGGERED, DEFAULT_CAMERA_SHOW_ONLY_TRIGGERED)
            ),

            "exit_delay": int(opts.get(OPT_EXIT_DELAY, DEFAULT_EXIT_DELAY)),
            "entry_delay": int(opts.get(OPT_ENTRY_DELAY, DEFAULT_ENTRY_DELAY)),
            "trigger_time": int(opts.get(OPT_TRIGGER_TIME, DEFAULT_TRIGGER_TIME)),

            "last_trigger_entity": self._last_trigger_entity,
            "open_sensors": self._open_sensors,
            "ready_to_arm_home": self._ready_home,
            "ready_to_arm_away": self._ready_away,
            "force_arm": bool(opts.get(OPT_FORCE_ARM, False)),

            "keypad_enabled": bool(opts.get(OPT_KEYPAD_ENABLED, False)),
            "keypad_entities": _uniq_clean(opts.get(OPT_KEYPAD_ENTITIES, [])),
            "master_pin": str(opts.get(OPT_MASTER_PIN, "") or ""),
            "arm_home_action": str(opts.get(OPT_ARM_HOME_ACTION, "arm_home") or "arm_home"),
            "arm_away_action": str(opts.get(OPT_ARM_AWAY_ACTION, "arm_away") or "arm_away"),
            "disarm_action": str(opts.get(OPT_DISARM_ACTION, "disarm") or "disarm"),
        }

    async def async_added_to_hass(self) -> None:
        last = await self.async_get_last_state()
        if last and last.state:
            try:
                self._state = AlarmControlPanelState(last.state)
            except Exception:
                self._state = AlarmControlPanelState.DISARMED

        self.hass.data.setdefault(DOMAIN, {})
        self.hass.data[DOMAIN].setdefault("entity_to_entry", {})
        self.hass.data[DOMAIN]["entity_to_entry"][self.entity_id] = self.entry.entry_id

        self._install_listeners()
        self._compute_ready()
        self.async_write_ha_state()

    async def async_will_remove_from_hass(self) -> None:
        if self._unsub:
            self._unsub()
            self._unsub = None

        for t in (self._arming_task, self._pending_task, self._trigger_task):
            if t and not t.done():
                t.cancel()

    # ---------------------- Helpers ----------------------

    def _install_listeners(self) -> None:
        if self._unsub:
            self._unsub()
            self._unsub = None

        opts = self.entry.options or {}
        entities = set(self._configured_entities_all())

        if opts.get(OPT_KEYPAD_ENABLED, False):
            entities |= set(_uniq_clean(opts.get(OPT_KEYPAD_ENTITIES, [])))

        if not entities:
            return

        self._unsub = async_track_state_change_event(
            self.hass, list(entities), self._handle_state_change_event
        )

    def _configured_entities_all(self) -> Iterable[str]:
        opts = self.entry.options or {}
        for key in (OPT_PERIMETER, OPT_MOTION, OPT_ALWAYS):
            for e in _uniq_clean(opts.get(key, [])):
                yield e

    def _compute_ready(self) -> None:
        opts = self.entry.options or {}
        perimeter = _uniq_clean(opts.get(OPT_PERIMETER, []))
        motion = _uniq_clean(opts.get(OPT_MOTION, []))

        def is_on(eid: str) -> bool:
            st = self.hass.states.get(eid)
            return bool(st and st.state == "on")

        open_now = [eid for eid in set(perimeter + motion) if is_on(eid)]
        self._open_sensors = sorted(open_now)

        open_perimeter = [eid for eid in perimeter if is_on(eid)]
        self._ready_home = len(open_perimeter) == 0
        self._ready_away = len(self._open_sensors) == 0

    def _is_relevant_trigger(self, entity_id: str) -> bool:
        opts = self.entry.options or {}
        always = set(_uniq_clean(opts.get(OPT_ALWAYS, [])))

        if entity_id in always:
            return True

        if self._state in (AlarmControlPanelState.ARMED_HOME, AlarmControlPanelState.ARMED_AWAY):
            profile = PROFILES[self._state]
            if profile.perimeter and entity_id in set(_uniq_clean(opts.get(OPT_PERIMETER, []))):
                return True
            if profile.motion and entity_id in set(_uniq_clean(opts.get(OPT_MOTION, []))):
                return True

        return False

    def _cancel_tasks(self) -> None:
        for attr in ("_arming_task", "_pending_task", "_trigger_task"):
            t = getattr(self, attr)
            if t and not t.done():
                t.cancel()
            setattr(self, attr, None)

    def _set_state(self, st: AlarmControlPanelState) -> None:
        self._state = st
        self.async_write_ha_state()

    # ---------------------- Event Handling ----------------------

    @callback
    def _handle_state_change_event(self, event: Event) -> None:
        new_state = event.data.get("new_state")
        if not new_state:
            return

        entity_id = event.data.get("entity_id")
        if not entity_id:
            return

        self._compute_ready()
        self.async_write_ha_state()

        # Only trigger on "on"
        if new_state.state != "on":
            return

        opts = self.entry.options or {}

        always = set(_uniq_clean(opts.get(OPT_ALWAYS, [])))
        if entity_id in always:
            self._last_trigger_entity = entity_id
            self.hass.async_create_task(self.async_alarm_trigger())
            return

        if self._state == AlarmControlPanelState.TRIGGERED:
            return

        if not self._is_relevant_trigger(entity_id):
            return

        self._last_trigger_entity = entity_id

        entry_delay = int(opts.get(OPT_ENTRY_DELAY, DEFAULT_ENTRY_DELAY))
        if self._state == AlarmControlPanelState.PENDING:
            return

        self._set_state(AlarmControlPanelState.PENDING)
        self._start_pending(entry_delay)

    # ---------------------- Timers ----------------------

    def _start_pending(self, delay_s: int) -> None:
        async def _pending():
            try:
                await asyncio.sleep(max(0, int(delay_s)))
                await self.async_alarm_trigger()
            except asyncio.CancelledError:
                return

        self._pending_task = asyncio.create_task(_pending())

    def _start_arming(self, target: AlarmControlPanelState, delay_s: int) -> None:
        self._set_state(AlarmControlPanelState.ARMING)

        async def _arming():
            try:
                await asyncio.sleep(max(0, int(delay_s)))
                self._set_state(target)
            except asyncio.CancelledError:
                return

        self._arming_task = asyncio.create_task(_arming())

    # ---------------------- Actions ----------------------

    async def async_alarm_disarm(self, code: str | None = None) -> None:
        self._cancel_tasks()
        self._set_state(AlarmControlPanelState.DISARMED)

        # ✅ Wunsch: bei Unscharf alles aus
        await self._sirens_off()
        await self._alarm_lights_restore_or_off()

    async def async_alarm_arm_home(self, code: str | None = None) -> None:
        self._cancel_tasks()
        self._compute_ready()
        
        force = bool(self.entry.options.get(OPT_FORCE_ARM, False))
        if not self._ready_home and not force:
            return
        exit_delay = int((self.entry.options or {}).get(OPT_EXIT_DELAY, DEFAULT_EXIT_DELAY))
        self._start_arming(AlarmControlPanelState.ARMED_HOME, exit_delay)

    async def async_alarm_arm_away(self, code: str | None = None) -> None:
        self._cancel_tasks()
        self._compute_ready()
        
        force = bool(self.entry.options.get(OPT_FORCE_ARM, False))
        if not self._ready_away and not force:
            return
        exit_delay = int((self.entry.options or {}).get(OPT_EXIT_DELAY, DEFAULT_EXIT_DELAY))
        self._start_arming(AlarmControlPanelState.ARMED_AWAY, exit_delay)

    async def async_alarm_trigger(self, code: str | None = None) -> None:
        self._cancel_tasks()
        self._set_state(AlarmControlPanelState.TRIGGERED)

        await self._alarm_lights_on()
        await self._sirens_on()

        trigger_time = int((self.entry.options or {}).get(OPT_TRIGGER_TIME, DEFAULT_TRIGGER_TIME))

        async def _auto_stop_outputs():
            try:
                await asyncio.sleep(max(1, int(trigger_time)))
                await self._sirens_off()
            except asyncio.CancelledError:
                return

        self._trigger_task = asyncio.create_task(_auto_stop_outputs())

    # ---------------------- Outputs: Sirens ----------------------

    def _get_sirens(self) -> list[str]:
        opts = self.entry.options or {}
        sirens = _uniq_clean(opts.get(OPT_SIREN_ENTITIES, []))
        legacy = str(opts.get(OPT_SIREN) or "").strip()
        if legacy and legacy not in sirens:
            sirens.append(legacy)
        return sirens

    async def _sirens_on(self) -> None:
        for ent in self._get_sirens():
            dom = _domain(ent)
            if dom not in ("switch", "siren", "light"):
                dom = "switch"
            await self.hass.services.async_call(dom, "turn_on", {"entity_id": ent}, blocking=False)

    async def _sirens_off(self) -> None:
        for ent in self._get_sirens():
            dom = _domain(ent)
            if dom not in ("switch", "siren", "light"):
                dom = "switch"
            await self.hass.services.async_call(dom, "turn_off", {"entity_id": ent}, blocking=False)

    # ---------------------- Outputs: Alarm Lights ----------------------

    def _parse_hex_color(self, hex_color: str) -> tuple[int, int, int] | None:
        if not hex_color:
            return None
        s = str(hex_color).strip()
        if not s.startswith("#"):
            return None
        s = s[1:]
        if len(s) == 3:
            s = "".join([c * 2 for c in s])
        if len(s) != 6:
            return None
        try:
            r = int(s[0:2], 16)
            g = int(s[2:4], 16)
            b = int(s[4:6], 16)
            return (r, g, b)
        except Exception:
            return None

    def _snapshot_light(self, entity_id: str) -> None:
        st = self.hass.states.get(entity_id)
        if not st:
            return
        attrs = dict(st.attributes or {})
        self._light_snapshot[entity_id] = {
            "state": st.state,
            "brightness": attrs.get("brightness"),
            "rgb_color": attrs.get("rgb_color"),
            "effect": attrs.get("effect"),
            "color_temp": attrs.get("color_temp"),
            "hs_color": attrs.get("hs_color"),
            "xy_color": attrs.get("xy_color"),
        }

    async def _alarm_lights_on(self) -> None:
        opts = self.entry.options or {}
        entities = _uniq_clean(opts.get(OPT_LIGHTS, []))
        if not entities:
            return

        # Snapshot only for light.*
        if bool(opts.get(OPT_LIGHT_RESTORE, DEFAULT_LIGHT_RESTORE)):
            self._light_snapshot = {}
            for eid in entities:
                if _domain(eid) == "light":
                    self._snapshot_light(eid)

        light_entities = [e for e in entities if _domain(e) == "light"]
        other_entities = [e for e in entities if _domain(e) in ("switch", "siren")]

        # turn on non-light (z.B. Kamera-Spotlight als switch.*)
        for eid in other_entities:
            dom = _domain(eid)
            await self.hass.services.async_call(dom, "turn_on", {"entity_id": eid}, blocking=False)

        # turn on lights with settings
        if light_entities:
            rgb = self._parse_hex_color(str(opts.get(OPT_LIGHT_COLOR, DEFAULT_LIGHT_COLOR)))
            brightness = int(opts.get(OPT_LIGHT_BRIGHTNESS, DEFAULT_LIGHT_BRIGHTNESS) or DEFAULT_LIGHT_BRIGHTNESS)
            effect = str(opts.get(OPT_LIGHT_EFFECT, DEFAULT_LIGHT_EFFECT) or "").strip()

            data: dict[str, Any] = {"entity_id": light_entities}
            if rgb:
                data["rgb_color"] = list(rgb)
            if 1 <= brightness <= 255:
                data["brightness"] = brightness
            if effect:
                data["effect"] = effect

            await self.hass.services.async_call("light", "turn_on", data, blocking=False)

    async def _alarm_lights_restore_or_off(self) -> None:
        opts = self.entry.options or {}
        entities = _uniq_clean(opts.get(OPT_LIGHTS, []))
        if not entities:
            return

        # non-light immer aus
        for eid in entities:
            dom = _domain(eid)
            if dom in ("switch", "siren"):
                await self.hass.services.async_call(dom, "turn_off", {"entity_id": eid}, blocking=False)

        # lights restore or off
        if bool(opts.get(OPT_LIGHT_RESTORE, DEFAULT_LIGHT_RESTORE)) and self._light_snapshot:
            for eid, snap in self._light_snapshot.items():
                try:
                    if snap.get("state") == "off":
                        await self.hass.services.async_call("light", "turn_off", {"entity_id": eid}, blocking=False)
                    else:
                        data: dict[str, Any] = {"entity_id": eid}
                        for k in ("brightness", "rgb_color", "effect", "color_temp", "hs_color", "xy_color"):
                            v = snap.get(k)
                            if v is not None:
                                data[k] = v
                        await self.hass.services.async_call("light", "turn_on", data, blocking=False)
                except Exception:
                    continue
            self._light_snapshot = {}
        else:
            # restore aus -> lights einfach aus
            light_entities = [e for e in entities if _domain(e) == "light"]
            if light_entities:
                await self.hass.services.async_call("light", "turn_off", {"entity_id": light_entities}, blocking=False)
