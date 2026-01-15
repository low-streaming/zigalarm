DOMAIN = "zigalarm"

CONF_NAME = "name"

OPT_PERIMETER = "perimeter_sensors"
OPT_MOTION = "motion_sensors"
OPT_ALWAYS = "always_sensors"

OPT_SIREN = "siren_entity"

# WLED / light alarm (Variant A: use HA light entities)
OPT_LIGHTS = "alarm_lights"                 # list[light.*]
OPT_LIGHT_COLOR = "alarm_light_color"       # hex string, e.g. "#ff0000"
OPT_LIGHT_BRIGHTNESS = "alarm_light_brightness"  # 1..255
OPT_LIGHT_EFFECT = "alarm_light_effect"     # effect name string (optional)
OPT_LIGHT_RESTORE = "alarm_light_restore"   # bool

# Cameras (display in card / events)
OPT_CAMERAS = "camera_entities"
OPT_CAMERA_SHOW_ONLY_TRIGGERED = "camera_show_only_triggered"

OPT_EXIT_DELAY = "exit_delay"
OPT_ENTRY_DELAY = "entry_delay"
OPT_TRIGGER_TIME = "trigger_time"

# Keypad / Remote (optional)
OPT_KEYPAD_ENABLED = "keypad_enabled"
OPT_KEYPAD_ENTITIES = "keypad_entities"
OPT_ARM_HOME_ACTION = "arm_home_action"
OPT_ARM_AWAY_ACTION = "arm_away_action"
OPT_DISARM_ACTION = "disarm_action"
OPT_MASTER_PIN = "master_pin"

DEFAULT_EXIT_DELAY = 30
DEFAULT_ENTRY_DELAY = 30
DEFAULT_TRIGGER_TIME = 180

DEFAULT_LIGHT_COLOR = "#ff0000"
DEFAULT_LIGHT_BRIGHTNESS = 255
DEFAULT_LIGHT_EFFECT = ""
DEFAULT_LIGHT_RESTORE = True

DEFAULT_CAMERA_SHOW_ONLY_TRIGGERED = True

DEFAULT_ARM_HOME_ACTION = "arm_home"
DEFAULT_ARM_AWAY_ACTION = "arm_away"
DEFAULT_DISARM_ACTION = "disarm"
