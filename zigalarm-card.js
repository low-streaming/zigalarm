/* ZigAlarm Card - minimal, no build step */
class ZigAlarmCard extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._root) this._render();
    this._update();
  }

  setConfig(config) {
    if (!config.alarm_entity) throw new Error("alarm_entity is required");
    this._config = config;
  }

  getCardSize() { return 6; }

  _render() {
    this._root = this.attachShadow({ mode: "open" });
    this._root.innerHTML = `
      <style>
        .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .col { display:flex; flex-direction:column; gap:10px; }
        .btn { padding:10px 12px; border-radius:10px; border:1px solid var(--divider-color); background: var(--card-background-color); cursor:pointer; }
        .btn.primary { background: var(--primary-color); color: var(--text-primary-color); border:none; }
        .btn.danger { background: var(--error-color); color: var(--text-primary-color); border:none; }
        .btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .muted { opacity:0.75; font-size: 0.9em; }
        ha-card { padding: 14px; }
        .section { border-top:1px solid var(--divider-color); padding-top:12px; margin-top:12px; }
        .title { font-size: 1.1em; font-weight: 600; }
        .pill { padding:2px 8px; border-radius:999px; border:1px solid var(--divider-color); }
        .openlist { margin: 0; padding-left: 18px; }
        .fieldrow { display:flex; gap:10px; flex-wrap:wrap; }
        .field { min-width: 180px; flex: 1; }
        .toggle { display:flex; gap:10px; align-items:center; }
        input[type="color"] { height: 34px; width: 54px; border: none; background: transparent; padding: 0; }
        .kbd { padding: 10px; border: 1px dashed var(--divider-color); border-radius: 12px; }
      </style>

      <ha-card>
        <div class="row" style="justify-content:space-between;">
          <div class="title">ZigAlarm</div>
          <div class="pill" id="statePill"></div>
        </div>

        <div class="section">
          <div class="row">
            <button class="btn" id="armHome">Arm Home</button>
            <button class="btn primary" id="armAway">Arm Away</button>
            <button class="btn" id="disarm">Disarm</button>
            <button class="btn danger" id="trigger">Trigger</button>
          </div>
          <div class="muted" id="hintLine"></div>
          <div class="muted" id="lastTrigger"></div>
        </div>

        <div class="section col">
          <div class="row" style="justify-content:space-between;">
            <div class="title">Setup</div>
            <button class="btn" id="save">Speichern</button>
          </div>

          <div class="muted">Sensoren auswählen → Speichern. ZigAlarm übernimmt den Rest.</div>

          <ha-entity-picker class="field" id="perimeter" allow-custom-entity="false"
            label="Außenhaut (Tür/Fenster)" multiple></ha-entity-picker>

          <ha-entity-picker class="field" id="motion" allow-custom-entity="false"
            label="Bewegung (PIR)" multiple></ha-entity-picker>

          <ha-entity-picker class="field" id="always" allow-custom-entity="false"
            label="24/7 Sensoren (Rauch/Wasser/Tamper)" multiple></ha-entity-picker>

          <ha-entity-picker class="field" id="siren" allow-custom-entity="false"
            label="Sirene (switch/siren/light) optional"></ha-entity-picker>

          <div class="kbd col">
            <div class="title" style="font-size:1em;">WLED / Alarm-Lichter (optional)</div>
            <ha-entity-picker class="field" id="alarmLights" allow-custom-entity="false"
              label="Alarm-Lichter (light.*)" multiple></ha-entity-picker>

            <div class="fieldrow">
              <div class="field">
                <div class="muted">Farbe</div>
                <input id="lightColor" type="color" value="#ff0000" />
              </div>
              <ha-textfield class="field" id="lightBrightness" type="number" label="Helligkeit (1..255)"></ha-textfield>
              <ha-textfield class="field" id="lightEffect" label="Effect (optional)"></ha-textfield>
            </div>

            <label class="toggle muted">
              <input id="lightRestore" type="checkbox" />
              Lichtzustände bei Disarm wiederherstellen
            </label>
          </div>

          <div class="fieldrow">
            <ha-textfield class="field" id="exitDelay" type="number" label="Exit Delay (s)"></ha-textfield>
            <ha-textfield class="field" id="entryDelay" type="number" label="Entry Delay (s)"></ha-textfield>
            <ha-textfield class="field" id="triggerTime" type="number" label="Trigger Time (s)"></ha-textfield>
          </div>

          <div class="kbd col">
            <div class="row" style="justify-content:space-between;">
              <div class="title" style="font-size:1em;">Keypad / Remote (optional)</div>
            </div>
            <label class="toggle muted">
              <input id="keypadEnabled" type="checkbox" />
              Keypad/Remote Actions aktivieren
            </label>

            <div id="keypadBox" class="col" style="display:none;">
              <ha-entity-picker class="field" id="keypads" allow-custom-entity="false"
                label="Action Entities (sensor/event)" multiple></ha-entity-picker>

              <div class="fieldrow">
                <ha-textfield class="field" id="masterPin" type="password" label="Master PIN (optional)"></ha-textfield>
                <ha-textfield class="field" id="armHomeAction" label="arm_home action"></ha-textfield>
                <ha-textfield class="field" id="armAwayAction" label="arm_away action"></ha-textfield>
                <ha-textfield class="field" id="disarmAction" label="disarm action"></ha-textfield>
              </div>
              <div class="muted">Tipp: Action-Strings findest du unter Entwicklerwerkzeuge → Zustände, indem du am Keypad/Remote drückst.</div>
            </div>
          </div>

          <div>
            <div class="title" style="font-size:1em;">Offen gerade:</div>
            <ul class="openlist" id="openNow"></ul>
          </div>
        </div>
      </ha-card>
    `;

    const $ = (id) => this._root.getElementById(id);

    $("armHome").addEventListener("click", () => this._call("alarm_control_panel", "alarm_arm_home", {}));
    $("armAway").addEventListener("click", () => this._call("alarm_control_panel", "alarm_arm_away", {}));
    $("disarm").addEventListener("click", () => this._call("alarm_control_panel", "alarm_disarm", {}));
    $("trigger").addEventListener("click", () => this._call("alarm_control_panel", "alarm_trigger", {}));
    $("save").addEventListener("click", () => this._saveConfig());

    $("keypadEnabled").addEventListener("change", () => {
      $("keypadBox").style.display = $("keypadEnabled").checked ? "block" : "none";
    });
  }

  _entityState(entityId) {
    return this._hass && this._hass.states ? this._hass.states[entityId] : null;
  }

  _setPickerValue(id, val) {
    const el = this._root.getElementById(id);
    if (!el) return;
    const cur = el.value;
    const nv = val;
    const same = JSON.stringify(cur ?? null) === JSON.stringify(nv ?? null);
    if (!same) el.value = nv;
  }

  _setField(id, val) {
    const el = this._root.getElementById(id);
    if (!el) return;
    if (String(el.value) !== String(val)) el.value = val;
  }

  _setCheckbox(id, val) {
    const el = this._root.getElementById(id);
    if (!el) return;
    el.checked = !!val;
  }

  _update() {
    const alarmId = this._config.alarm_entity;
    const alarm = this._entityState(alarmId);
    if (!alarm) return;

    const $ = (id) => this._root.getElementById(id);

    const attrs = alarm.attributes || {};
    $("statePill").textContent = alarm.state;

    const last = attrs.last_trigger_entity;
    $("lastTrigger").textContent = last ? `Letzte Auslösung: ${last}` : "";

    // ready-to-arm
    const openSensors = attrs.open_sensors || [];
    const readyHome = !!attrs.ready_to_arm_home;
    const readyAway = !!attrs.ready_to_arm_away;

    $("armHome").disabled = !readyHome;
    $("armAway").disabled = !readyAway;

    if (!readyHome || !readyAway) {
      $("hintLine").textContent = `Nicht bereit zum Scharfschalten: ${openSensors.join(", ")}`;
    } else {
      $("hintLine").textContent = "";
    }

    // preload setup fields from attributes/options
    this._setPickerValue("perimeter", attrs.perimeter_sensors || []);
    this._setPickerValue("motion", attrs.motion_sensors || []);
    this._setPickerValue("always", attrs.always_sensors || []);
    this._setPickerValue("siren", attrs.siren_entity || "");

    // lights
    this._setPickerValue("alarmLights", attrs.alarm_lights || []);
    const color = attrs.alarm_light_color || "#ff0000";
    const colorEl = $("lightColor");
    if (colorEl && colorEl.value !== color) colorEl.value = color;
    this._setField("lightBrightness", attrs.alarm_light_brightness ?? 255);
    this._setField("lightEffect", attrs.alarm_light_effect ?? "");
    this._setCheckbox("lightRestore", attrs.alarm_light_restore ?? true);

    // delays
    this._setField("exitDelay", attrs.exit_delay ?? 30);
    this._setField("entryDelay", attrs.entry_delay ?? 30);
    this._setField("triggerTime", attrs.trigger_time ?? 180);

    // keypad optional
    const kben = !!attrs.keypad_enabled;
    this._setCheckbox("keypadEnabled", kben);
    $("keypadBox").style.display = kben ? "block" : "none";
    this._setPickerValue("keypads", attrs.keypad_entities || []);
    this._setField("masterPin", attrs.master_pin ?? "");
    this._setField("armHomeAction", attrs.arm_home_action ?? "arm_home");
    this._setField("armAwayAction", attrs.arm_away_action ?? "arm_away");
    this._setField("disarmAction", attrs.disarm_action ?? "disarm");

    // show open sensors now (computed by backend, but we can also compute here)
    const ul = $("openNow");
    ul.innerHTML = openSensors.length ? openSensors.map((e) => `<li>${e}</li>`).join("") : "<li>keine</li>";
  }

  async _call(domain, service, data) {
    const alarmId = this._config.alarm_entity;
    await this._hass.callService(domain, service, { entity_id: alarmId, ...data });
  }

  async _saveConfig() {
    const $ = (id) => this._root.getElementById(id);
    const alarmId = this._config.alarm_entity;

    const perimeter = $("perimeter").value || [];
    const motion = $("motion").value || [];
    const always = $("always").value || [];
    const siren = $("siren").value || null;

    // lights
    const alarm_lights = $("alarmLights").value || [];
    const alarm_light_color = String($("lightColor").value || "#ff0000");
    const alarm_light_brightness = Number($("lightBrightness").value || 255);
    const alarm_light_effect = String($("lightEffect").value || "");
    const alarm_light_restore = !!$("lightRestore").checked;

    const exit_delay = Number($("exitDelay").value || 30);
    const entry_delay = Number($("entryDelay").value || 30);
    const trigger_time = Number($("triggerTime").value || 180);

    // keypad optional
    const keypad_enabled = !!$("keypadEnabled").checked;
    const keypad_entities = $("keypads").value || [];
    const master_pin = String($("masterPin").value || "");
    const arm_home_action = String($("armHomeAction").value || "arm_home");
    const arm_away_action = String($("armAwayAction").value || "arm_away");
    const disarm_action = String($("disarmAction").value || "disarm");

    await this._hass.callService("zigalarm", "set_config", {
      alarm_entity: alarmId,
      perimeter_sensors: perimeter,
      motion_sensors: motion,
      always_sensors: always,
      siren_entity: siren,

      alarm_lights,
      alarm_light_color,
      alarm_light_brightness,
      alarm_light_effect,
      alarm_light_restore,

      exit_delay,
      entry_delay,
      trigger_time,

      keypad_enabled,
      keypad_entities,
      master_pin,
      arm_home_action,
      arm_away_action,
      disarm_action,
    });
  }
}

customElements.define("zigalarm-card", ZigAlarmCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "zigalarm-card",
  name: "ZigAlarm Card",
  description: "Alarm panel + entity selection for Zigbee2MQTT sensors (includes WLED light triggering)"
});
