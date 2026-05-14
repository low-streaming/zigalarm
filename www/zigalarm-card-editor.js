/**
 * ZigAlarm Infinity Editor
 * Premium Configuration Interface
 */

const DEFAULTS = {
  entity: "",
  title: "ZIGALARM SECURITY",
  show_setup: true,
  show_cameras: "popup",
  popup_on_trigger: true,
  popup_only_when_triggered: true,
  popup_auto_close_on_disarm: true,
  popup_title: "TACTICAL MONITORING",
  camera_card: "picture-glance",
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
    const entities = hass ? Object.keys(hass.states).sort() : [];
    const alarmEntities = entities.filter((e) => e.startsWith("alarm_control_panel."));
    const cameraEntities = entities.filter((e) => e.startsWith("camera."));

    const showManualCams = !this._config.use_panel_cameras;

    this.shadowRoot.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;800&family=Orbitron:wght@900&display=swap');
        
        :host { 
          display: block; 
          --za-primary: #0ea5e9; 
          --za-bg: #0a0c14;
          --za-border: rgba(255, 255, 255, 0.1);
          font-family: 'Outfit', sans-serif;
          color: #eee;
        }

        .architect-wrap {
          background: var(--za-bg);
          padding: 30px;
          border-radius: 24px;
          border: 1px solid var(--za-border);
        }

        .header {
          display: flex; align-items: center; gap: 15px; margin-bottom: 35px; border-bottom: 1px solid var(--za-border); padding-bottom: 20px;
        }
        .header h3 { margin: 0; font-family: 'Orbitron'; font-size: 1.2rem; letter-spacing: 3px; }
        .header span { color: var(--za-primary); }

        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 25px; }
        .col { display: flex; flex-direction: column; gap: 10px; }
        
        label { font-size: 10px; font-weight: 900; color: var(--za-primary); text-transform: uppercase; letter-spacing: 2px; }
        
        input, select {
          width: 100%; padding: 15px; border-radius: 12px; background: rgba(255,255,255,0.05);
          border: 1px solid var(--za-border); color: #fff; font-family: inherit; font-size: 0.9rem;
          outline: none; transition: 0.3s; box-sizing: border-box;
        }
        input:focus, select:focus { border-color: var(--za-primary); background: rgba(255,255,255,0.08); box-shadow: 0 0 20px rgba(14, 165, 233, 0.2); }
        
        .hint { font-size: 0.75rem; opacity: 0.4; line-height: 1.5; margin-top: 5px; }

        .chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 5px; }
        .chip {
          background: rgba(255,255,255,0.05); border: 1px solid var(--za-border); border-radius: 12px;
          padding: 10px 18px; font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: 0.3s;
          display: flex; align-items: center; gap: 8px;
        }
        .chip:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); }
        .chip.on { background: rgba(14, 165, 233, 0.15); border-color: var(--za-primary); color: var(--za-primary); }

        .full { grid-column: span 2; }
      </style>

      <div class="architect-wrap">
        <div class="header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--za-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          <h3>ZIGALARM <span>ARCHITECT</span></h3>
        </div>

        <div class="row">
          <div class="col">
            <label>Alarm Entity</label>
            <select id="entity">
              <option value="">-- SELECT ENTITY --</option>
              ${alarmEntities.map(e => `<option value="${e}" ${this._config.entity === e ? "selected" : ""}>${e}</option>`).join("")}
            </select>
          </div>
          <div class="col">
            <label>Interface Name</label>
            <input id="title" value="${this._config.title || ""}" placeholder="ZIGALARM SECURITY" />
          </div>
        </div>

        <div class="row">
          <div class="col">
            <label>Visual Mode</label>
            <select id="show_cameras">
              <option value="popup" ${this._config.show_cameras === "popup" ? "selected" : ""}>TACTICAL OVERLAY (POPUP)</option>
              <option value="inline" ${this._config.show_cameras === "inline" ? "selected" : ""}>INTEGRATED FEED (INLINE)</option>
              <option value="off" ${this._config.show_cameras === "off" ? "selected" : ""}>DISABLED</option>
            </select>
          </div>
          <div class="col">
            <label>Camera Card Engine</label>
            <select id="camera_card">
              <option value="picture-glance" ${this._config.camera_card === "picture-glance" ? "selected" : ""}>PICTURE-GLANCE (LIVE)</option>
              <option value="picture-entity" ${this._config.camera_card === "picture-entity" ? "selected" : ""}>PICTURE-ENTITY</option>
            </select>
          </div>
        </div>

        <div class="row">
          <div class="col full">
            <label>Auto-Monitoring Intelligence</label>
            <div class="chips">
              <div class="chip ${this._config.popup_on_trigger ? "on" : ""}" id="popup_on_trigger">DEPLOY ON ALARM</div>
              <div class="chip ${this._config.popup_only_when_triggered ? "on" : ""}" id="popup_only">STRICT TRIGGER MODE</div>
              <div class="chip ${this._config.popup_auto_close_on_disarm ? "on" : ""}" id="popup_close">AUTO-RETRACT ON DISARM</div>
            </div>
            <div class="hint">STRICT TRIGGER MODE prevents the tactical feed from opening unless the system is in actual alarm state.</div>
          </div>
        </div>

        <div class="row">
          <div class="col full">
            <label>Camera Source Architecture</label>
            <div class="chips">
              <div class="chip ${this._config.use_panel_cameras ? "on" : ""}" id="use_panel">FROM PANEL ATTRIBUTES</div>
              <div class="chip ${!this._config.use_panel_cameras ? "on" : ""}" id="use_manual">MANUAL ASSIGNMENT</div>
            </div>
          </div>
        </div>

        ${showManualCams ? `
          <div class="row">
            <div class="col full">
              <label>Tactical Nodes (camera.*)</label>
              <select id="camera_add">
                <option value="">-- ADD NODE --</option>
                ${cameraEntities.map(c => `<option value="${c}">${c}</option>`).join("")}
              </select>
              <div class="chips" style="margin-top:15px;">
                ${(this._config.cameras || []).map(c => `<div class="chip on" data-del="${c}">✕ ${c}</div>`).join("")}
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const s = this.shadowRoot;
    const bind = (id, event, fn) => s.getElementById(id)?.addEventListener(event, fn);

    bind("entity", "change", (e) => this._set("entity", e.target.value));
    bind("title", "input", (e) => this._set("title", e.target.value));
    bind("show_cameras", "change", (e) => this._set("show_cameras", e.target.value));
    bind("camera_card", "change", (e) => this._set("camera_card", e.target.value));
    
    bind("use_panel", "click", () => this._set("use_panel_cameras", true));
    bind("use_manual", "click", () => this._set("use_panel_cameras", false));
    
    bind("popup_on_trigger", "click", () => this._set("popup_on_trigger", !this._config.popup_on_trigger));
    bind("popup_only", "click", () => this._set("popup_only_when_triggered", !this._config.popup_only_when_triggered));
    bind("popup_close", "click", () => this._set("popup_auto_close_on_disarm", !this._config.popup_auto_close_on_disarm));

    bind("camera_add", "change", (e) => {
      const v = e.target.value; if (!v) return;
      this._set("cameras", Array.from(new Set([...(this._config.cameras || []), v])));
      e.target.value = "";
    });

    s.querySelectorAll("[data-del]").forEach(el => {
      el.onclick = () => this._set("cameras", (this._config.cameras || []).filter(c => c !== el.dataset.del));
    });
  }
}

customElements.define("zigalarm-card-editor", ZigAlarmCardEditor);
