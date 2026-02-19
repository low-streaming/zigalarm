DOMAIN = "zigalarm"


# Platforms
PLATFORMS = ["alarm_control_panel"]

# option keys
OPT_PERIMETER = "perimeter_sensors"
OPT_MOTION = "motion_sensors"
OPT_ALWAYS = "always_sensors"

OPT_EXIT_DELAY = "exit_delay"
OPT_ENTRY_DELAY = "entry_delay"
OPT_TRIGGER_TIME = "trigger_time"

# legacy single siren + new multiple sirens
OPT_SIREN = "siren_entity"
OPT_SIREN_ENTITIES = "siren_entities"

# lights (kann auch switch.* sein, z.B. Kamera-Spotlight)
OPT_LIGHTS = "alarm_lights"
OPT_LIGHT_COLOR = "alarm_light_color"
OPT_LIGHT_BRIGHTNESS = "alarm_light_brightness"
OPT_LIGHT_EFFECT = "alarm_light_effect"
OPT_LIGHT_RESTORE = "alarm_light_restore"

# cameras
OPT_CAMERAS = "camera_entities"
OPT_CAMERA_SHOW_ONLY_TRIGGERED = "camera_show_only_triggered"
OPT_FORCE_ARM = "force_arm"

# keypad (optional)
OPT_KEYPAD_ENABLED = "keypad_enabled"
OPT_KEYPAD_ENTITIES = "keypad_entities"
OPT_ARM_HOME_ACTION = "arm_home_action"
OPT_ARM_AWAY_ACTION = "arm_away_action"
OPT_DISARM_ACTION = "disarm_action"
OPT_MASTER_PIN = "master_pin"

# defaults
DEFAULT_EXIT_DELAY = 5
DEFAULT_ENTRY_DELAY = 5
DEFAULT_TRIGGER_TIME = 180

DEFAULT_LIGHT_COLOR = "#ff0000"
DEFAULT_LIGHT_BRIGHTNESS = 255
DEFAULT_LIGHT_EFFECT = ""
DEFAULT_LIGHT_RESTORE = True

DEFAULT_CAMERA_SHOW_ONLY_TRIGGERED = False
