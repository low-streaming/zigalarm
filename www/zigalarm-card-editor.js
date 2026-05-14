/**
 * ZigAlarm Infinity Card Editor V2.1
 * Architect Panel // Deutsche Version
 */

class ZigAlarmCardEditor extends HTMLElement {
  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
  }

  set hass(hass) { this._hass = hass; }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  _render() {
    if (!this._hass) return;

    this._root.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&family=Orbitron:wght@900&family=JetBrains+Mono:wght@400;700&display=swap');
        
        :host {
          display: block;
          color: #fff;
          font-family: 'Outfit', sans-serif;
          --za-primary: #0ea5e9;
        }

        .editor-container {
          background: #08080a;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          padding: 25px;
        }

        .head {
          font-family: 'Orbitron', sans-serif;
          font-size: 1.1rem;
          color: var(--za-primary);
          letter-spacing: 4px;
          margin-bottom: 25px;
          text-transform: uppercase;
        }

        .section {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .section-title {
          font-size: 0.75rem;
          font-weight: 900;
          letter-spacing: 2px;
          opacity: 0.5;
          margin-bottom: 20px;
          text-transform: uppercase;
        }

        ha-textfield, ha-formfield, ha-select {
          display: block;
          margin-bottom: 15px;
          width: 100%;
          --mdc-theme-primary: var(--za-primary);
        }

        ha-switch {
          --mdc-theme-secondary: var(--za-primary);
        }

        .row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          font-size: 0.9rem;
          font-weight: 700;
        }
      </style>

      <div class="editor-container">
        <div class="head">Architekt-Panel</div>

        <div class="section">
          <div class="section-title">Kern-Konfiguration</div>
          <ha-textfield label="Alarm Entität" .value="${this._config.alarm_entity || ''}" .configValue="${"alarm_entity"}" @input="${this._valueChanged}"></ha-textfield>
          <ha-textfield label="Karten Name" .value="${this._config.name || 'ZIGALARM SECURITY'}" .configValue="${"name"}" @input="${this._valueChanged}"></ha-textfield>
        </div>

        <div class="section">
          <div class="section-title">Video-Überwachung (Popup)</div>
          
          <div class="row">
            <span>Integration Kameras nutzen</span>
            <ha-switch .checked="${this._config.use_panel_cameras !== false}" .configValue="${"use_panel_cameras"}" @change="${this._valueChanged}"></ha-switch>
          </div>

          <div class="row">
            <span>Popup bei Alarm automatisch öffnen</span>
            <ha-switch .checked="${this._config.popup_on_trigger !== false}" .configValue="${"popup_on_trigger"}" @change="${this._valueChanged}"></ha-switch>
          </div>

          <div class="row">
            <span>Popup beim Entschärfen schließen</span>
            <ha-switch .checked="${this._config.popup_auto_close_on_disarm !== false}" .configValue="${"popup_auto_close_on_disarm"}" @change="${this._valueChanged}"></ha-switch>
          </div>

          <ha-textfield label="Popup Titel" .value="${this._config.popup_title || 'TAKTIISCHE ÜBERWACHUNG'}" .configValue="${"popup_title"}" @input="${this._valueChanged}"></ha-textfield>
        </div>

        <div class="section">
          <div class="section-title">Erweitert</div>
          <div class="row">
            <span>Setup-Informationen anzeigen</span>
            <ha-switch .checked="${this._config.show_setup}" .configValue="${"show_setup"}" @change="${this._valueChanged}"></ha-switch>
          </div>
        </div>
      </div>
    `;
  }

  _valueChanged(ev) {
    if (!this._config || !this._hass) return;
    const target = ev.target;
    if (this[`_${target.configValue}`] === target.value) return;

    if (target.configValue) {
      if (target.value === "") {
        delete this._config[target.configValue];
      } else {
        this._config = {
          ...this._config,
          [target.configValue]: target.checked !== undefined ? target.checked : target.value,
        };
      }
    }
    fireEvent(this, "config-changed", { config: this._config });
  }
}

customElements.define("zigalarm-card-editor", ZigAlarmCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "zigalarm-card",
  name: "ZigAlarm Infinity Card",
  preview: true,
  description: "High-End Alarmanlagen-Steuerung im OpenKairo Design.",
});
