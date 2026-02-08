const DEFAULTS = {
  entity: "",
  title: "ZigAlarm",
  show_setup: true,

  show_cameras: "popup", // popup|inline|off
  popup_on_trigger: true,
  popup_only_when_triggered: true,
  popup_auto_close_on_disarm: true,
  popup_title: "Alarm-Kameras",
  camera_card: "picture-glance", // picture-glance|picture-entity
  use_panel_cameras: true,
  cameras: [],

  compact: false,
};

function fireEvent(node, type, detail = {}, options = {}) {
  const event = new CustomEvent(type, {
    bubbles: options.bubbles ?? true,
    cancelable: options.cancelable ?? false,
    composed: options.composed ?? true,
    detail,
  });
  node.dispatchEvent(event);
  return event;
}

class ZigAlarmCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...DEFAULTS, ...(config || {}) };
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this.shadowRoot) this._render();
  }

  _valueChanged() {
    fireEvent(this, "config-changed", { config: this._config });
  }

  _set(path, val) {
    this._config = { ...this._config, [path]: val };
    this._valueChanged();
    this._render();
  }

  _render() {
    if (!this.shadowRoot) return;

    const hass = this._hass;
    const entities = hass ? Object.keys(hass.states) : [];

    const alarmEntities = entities.filter((e) => e.startsWith("alarm_control_panel."));
    const cameraEntities = entities.filter((e) => e.startsWith("camera."));

    const showManualCams = !this._config.use_panel_cameras;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        .wrap { padding: 10px; }
        .row { display:flex; gap:10px; align-items:center; margin: 10px 0; flex-wrap:wrap; }
        label { display:block; font-size: 12px; opacity:.8; margin-bottom: 4px; }
        input, select {
          width: 100%;
          padding: 10px;
          border-radius: 10px;
          border: 1px solid var(--divider-color);
          background: var(--card-background-color);
          color: var(--primary-text-color);
        }
        .col { flex: 1 1 220px; min-width: 220px; }
        .hint { font-size: 12px; opacity:.75; margin-top: 6px; }
        .chips { display:flex; flex-wrap:wrap; gap: 8px; }
        .chip {
          border: 1px solid var(--divider-color);
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          cursor:pointer;
          user-select:none;
        }
        .chip.on { background: var(--primary-color); color: var(--text-primary-color,#fff); border-color: transparent; }
        .small { font-size: 12px; opacity:.85; }
      </style>

      <div class="wrap">
        <div class="row">
          <div class="col">
            <label>Alarm Entity</label>
            <select id="entity">
              <option value="">-- wählen --</option>
              ${alarmEntities
                .map(
                  (e) =>
                    `<option value="${e}" ${this._config.entity === e ? "selected" : ""}>${e}</option>`
                )
                .join("")}
            </select>
            <div class="hint">Muss ein <code>alarm_control_panel.*</code> sein.</div>
          </div>

          <div class="col">
            <label>Titel</label>
            <input id="title" value="${this._config.title || ""}" />
          </div>
        </div>

        <div class="row">
          <div class="col">
            <label>Kameras anzeigen</label>
            <select id="show_cameras">
              <option value="popup" ${this._config.show_cameras === "popup" ? "selected" : ""}>Popup/Overlay</option>
              <option value="inline" ${this._config.show_cameras === "inline" ? "selected" : ""}>Inline im Card</option>
              <option value="off" ${this._config.show_cameras === "off" ? "selected" : ""}>Aus</option>
            </select>
          </div>

          <div class="col">
            <label>Kamera-Card Typ</label>
            <select id="camera_card">
              <option value="picture-glance" ${this._config.camera_card === "picture-glance" ? "selected" : ""}>picture-glance (Live)</option>
              <option value="picture-entity" ${this._config.camera_card === "picture-entity" ? "selected" : ""}>picture-entity</option>
            </select>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <label>Kameras Quelle</label>
            <div class="chips">
              <div class="chip ${this._config.use_panel_cameras ? "on" : ""}" id="use_panel">aus Panel-Config</div>
              <div class="chip ${!this._config.use_panel_cameras ? "on" : ""}" id="use_manual">manuell auswählen</div>
            </div>
            <div class="hint">Empfohlen: <b>aus Panel</b> – dann musst du die Liste nicht doppelt pflegen.</div>
          </div>

          <div class="col">
            <label>Popup Titel</label>
            <input id="popup_title" value="${this._config.popup_title || ""}" />
          </div>
        </div>

        <div class="row">
          <div class="col">
            <label>Popup Verhalten</label>
            <div class="chips">
              <div class="chip ${this._config.popup_on_trigger ? "on" : ""}" id="popup_on_trigger">bei Alarm automatisch öffnen</div>
              <div class="chip ${this._config.popup_only_when_triggered ? "on" : ""}" id="popup_only">nur bei Triggered anzeigen</div>
              <div class="chip ${this._config.popup_auto_close_on_disarm ? "on" : ""}" id="popup_close">bei Unscharf schließen</div>
            </div>
          </div>

          <div class="col">
            <label>Compact</label>
            <div class="chips">
              <div class="chip ${this._config.compact ? "on" : ""}" id="compact">kompakt</div>
            </div>
            <div class="hint">Kleineres Layout in der Karte.</div>
          </div>
        </div>

        ${
          showManualCams
            ? `<div class="row">
                 <div class="col">
                   <label>Manuelle Kamera Entities (camera.*)</label>
                   <select id="camera_add">
                     <option value="">-- Kamera hinzufügen --</option>
                     ${cameraEntities.map((c) => `<option value="${c}">${c}</option>`).join("")}
                   </select>
                   <div class="hint small">Auswahl fügt hinzu – mehrfach möglich.</div>
                   <div class="chips" style="margin-top:8px;">
                     ${(this._config.cameras || [])
                       .map(
                         (c) => `<div class="chip on" data-del="${c}">✕ ${c}</div>`
                       )
                       .join("")}
                   </div>
                 </div>
               </div>`
            : `<div class="hint">Kamera-Liste wird aus dem Panel gelesen.</div>`
        }
      </div>
    `;

    // Handlers
    this.shadowRoot.getElementById("entity")?.addEventListener("change", (e) => {
      this._set("entity", e.target.value);
    });

    this.shadowRoot.getElementById("title")?.addEventListener("input", (e) => {
      this._set("title", e.target.value);
    });

    this.shadowRoot.getElementById("show_cameras")?.addEventListener("change", (e) => {
      this._set("show_cameras", e.target.value);
    });

    this.shadowRoot.getElementById("camera_card")?.addEventListener("change", (e) => {
      this._set("camera_card", e.target.value);
    });

    this.shadowRoot.getElementById("popup_title")?.addEventListener("input", (e) => {
      this._set("popup_title", e.target.value);
    });

    this.shadowRoot.getElementById("use_panel")?.addEventListener("click", () => {
      this._set("use_panel_cameras", true);
    });

    this.shadowRoot.getElementById("use_manual")?.addEventListener("click", () => {
      this._set("use_panel_cameras", false);
    });

    this.shadowRoot.getElementById("popup_on_trigger")?.addEventListener("click", () => {
      this._set("popup_on_trigger", !this._config.popup_on_trigger);
    });

    this.shadowRoot.getElementById("popup_only")?.addEventListener("click", () => {
      this._set("popup_only_when_triggered", !this._config.popup_only_when_triggered);
    });

    this.shadowRoot.getElementById("popup_close")?.addEventListener("click", () => {
      this._set("popup_auto_close_on_disarm", !this._config.popup_auto_close_on_disarm);
    });

    this.shadowRoot.getElementById("compact")?.addEventListener("click", () => {
      this._set("compact", !this._config.compact);
    });

    this.shadowRoot.getElementById("camera_add")?.addEventListener("change", (e) => {
      const v = e.target.value;
      if (!v) return;
      const cams = Array.from(new Set([...(this._config.cameras || []), v]));
      this._set("cameras", cams);
      e.target.value = "";
    });

    // Delete chip
    this.shadowRoot.querySelectorAll("[data-del]")?.forEach((el) => {
      el.addEventListener("click", () => {
        const c = el.getAttribute("data-del");
        const cams = (this._config.cameras || []).filter((x) => x !== c);
        this._set("cameras", cams);
      });
    });
  }
}

customElements.define("zigalarm-card-editor", ZigAlarmCardEditor);
