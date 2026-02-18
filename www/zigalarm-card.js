/*
  ZigAlarm Lovelace Card (Dashboard / Overview)
  - shows alarm state + actions
  - optional camera popup on trigger (no Browser Mod required)
  Config:
    type: custom:zigalarm-card
    alarm_entity: alarm_control_panel.zigalarm   # or "entity"
    show_setup: false                           # default false
    show_cameras: popup|inline|none             # default popup
    use_panel_cameras: true                     # default true (reads alarm entity attribute "camera_entities")
    cameras: []                                 # optional when use_panel_cameras: false
    camera_card: picture-entity|picture-glance  # default picture-entity
    popup_on_trigger: true                      # default true
    popup_only_when_triggered: true             # default true
    popup_auto_close_on_disarm: true            # default true
    popup_title: Alarm-Kameras                  # default
*/

class ZigAlarmCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = {};
    this._root = this.attachShadow({ mode: "open" });

    this._lastAlarmState = null;
    this._popup = null;          // native <dialog>
    this._popupOpenedFor = null; // alarm state that opened it ("triggered")
    this._helpers = null;

    this._renderSkeleton();
  }

  // ---- HA card API ----
  setConfig(config) {
    if (!config) throw new Error("Config fehlt");

    const alarmEntity = (config.alarm_entity || config.entity || "").trim();
    if (!alarmEntity) {
      throw new Error("alarm_entity fehlt");
    }

    this._config = {
      // defaults
      alarm_entity: alarmEntity,
      name: config.name || "ZigAlarm",
      show_setup: config.show_setup ?? false,
      show_cameras: config.show_cameras || "popup", // popup | inline | none
      use_panel_cameras: config.use_panel_cameras ?? true,
      cameras: Array.isArray(config.cameras) ? config.cameras : [],
      camera_card: config.camera_card || "picture-entity",
      popup_on_trigger: config.popup_on_trigger ?? true,
      popup_only_when_triggered: config.popup_only_when_triggered ?? true,
      popup_auto_close_on_disarm: config.popup_auto_close_on_disarm ?? true,
      popup_title: config.popup_title || "Alarm-Kameras",
    };

    this._config.alarm_entity = alarmEntity;

    this._update();
  }

  set hass(hass) {
    this._hass = hass;

    // detect state transitions for popup
    const st = this._st();
    const newState = st ? String(st.state || "") : null;

    if (newState && this._lastAlarmState !== newState) {
      this._handleAlarmTransition(this._lastAlarmState, newState, st);
      this._lastAlarmState = newState;
    } else if (!this._lastAlarmState && newState) {
      this._lastAlarmState = newState;
    }

    this._update();
    this._updatePopupHass();
  }

  getCardSize() {
    return 3;
  }

  // ---- internals ----
  _st() {
    if (!this._hass) return null;
    return this._hass.states[this._config.alarm_entity] || null;
  }

  _renderSkeleton() {
    this._root.innerHTML = `
      <style>
        :host {
          --za-bg-body: #0f172a; 
          --za-bg-card: rgba(15, 23, 42, 0.6);
          --za-primary: #3b82f6; 
          --za-primary-glow: rgba(59, 130, 246, 0.5);
          --za-success: #10b981;
          --za-success-glow: rgba(16, 185, 129, 0.5);
          --za-danger: #ef4444; 
          --za-danger-glow: rgba(239, 68, 68, 0.5);
          --za-text: #f8fafc;
          --za-border: rgba(255, 255, 255, 0.08);
          font-family: ui-sans-serif, system-ui, sans-serif;
        }

        ha-card {
          padding: 24px;
          border-radius: 24px;
          background: linear-gradient(145deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95)) !important;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--za-border);
          box-shadow: 0 8px 32px rgba(0,0,0,0.25);
          color: var(--za-text);
          transition: all 0.3s ease;
          overflow: hidden;
          position: relative;
        }
        
        /* Aurora effect on card specific states */
        ha-card::before {
          content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
          background: radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.05), transparent 60%);
          animation: aurora 15s linear infinite; pointer-events: none;
        }
        @keyframes aurora { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        .header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom: 20px; position:relative; z-index:2; }
        
        .title { 
          font-size: 1.4rem; font-weight: 800; letter-spacing: -0.02em;
          background: linear-gradient(to right, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        
        .pill { 
          font-size: 0.75rem; padding: 6px 14px; border-radius: 99px; 
          background: rgba(255,255,255,0.05); border: 1px solid var(--za-border);
          font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;
          transition: all 0.3s;
        }
        
        /* State styling via data-state on header */
        .header[data-state*="armed"] .pill {
          background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.4); color: #6ee7b7; box-shadow: 0 0 12px var(--za-success-glow);
        }
        .header[data-state="triggered"] .pill {
          background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.6); color: #fca5a5; animation: pulse-danger 1.5s infinite;
        }
        @keyframes pulse-danger { 
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 
          70% { box-shadow: 0 0 0 10px rgba(239,68,68,0); } 
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } 
        }

        .row { display:flex; gap:10px; flex-wrap:wrap; margin-top: 12px; position:relative; z-index:2; }
        
        button {
          border: 1px solid var(--za-border); border-radius: 14px; padding: 12px 18px;
          cursor: pointer; background: rgba(255,255,255,0.03); color: var(--za-text);
          font-weight: 700; transition: all 0.2s; flex: 1; white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size: 0.9rem;
        }
        button:hover { background: rgba(255,255,255,0.08); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        
        button.primary { 
          background: linear-gradient(135deg, var(--za-primary) 0%, #2563eb 100%); color: #fff; border: none;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        button.primary:hover { box-shadow: 0 8px 16px rgba(37, 99, 235, 0.4); }

        button.danger {
          background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.3); color: #fca5a5;
        }
        button.danger:hover { background: rgba(239, 68, 68, 0.25); color: #fff; box-shadow: 0 8px 20px var(--za-danger-glow); }

        .muted { opacity: .6; font-size: 0.8rem; margin-top: 8px; }
        
        .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px; position:relative; z-index:2; }
        
        .box { 
          border: 1px solid var(--za-border); border-radius: 18px; padding: 16px;
          background: rgba(0,0,0,0.2); transition: all 0.2s;
        }
        .box:hover { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.15); }

        .box h4 { margin: 0 0 10px 0; font-size: 0.8rem; opacity: .7; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        
        .kv { display:flex; justify-content:space-between; gap:12px; font-size: 0.9rem; margin-bottom: 6px; }
        .kv span:first-child { color: var(--za-text-muted); }
        
        .list { margin: 6px 0 0 0; padding-left: 18px; font-size: 0.85rem; opacity: .85; }
        .cams-inline { margin-top: 20px; position:relative; z-index:2; }
        
        .warn { margin-top: 16px; padding: 16px; border-radius: 16px; background: rgba(255,193,7,.1); border: 1px solid rgba(255,193,7,.2); color: #fcd34d; position:relative; z-index:2; }
        
        .setup { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--za-border); position:relative; z-index:2; }
        
        /* Modal Popup */
        dialog.zigalarm-popup {
          border: 1px solid rgba(255,255,255,0.1); border-radius: 28px;
          padding: 0; max-width: min(900px, 92vw); width: 92vw;
          background: #0f172a; box-shadow: 0 50px 100px -20px rgba(0,0,0,0.7);
          overflow: hidden;
        }
        dialog::backdrop { background: rgba(0,0,0,.8); backdrop-filter: blur(8px); }
        
        .dlg-head {
          display:flex; align-items:center; justify-content:space-between; gap:12px;
          padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.02);
        }
        .dlg-title { font-weight: 800; font-size: 1.25rem; color: #fff; }
        .dlg-body { padding: 24px; background: #0f172a; }
        .dlg-close { background: rgba(255,255,255,0.1); width: 36px; height: 36px; padding: 0; display:flex; align-items:center; justify-content:center; border-radius: 50%; border:none; color:#fff; cursor:pointer; transition: all 0.2s; }
        .dlg-close:hover { background: rgba(239, 68, 68, 0.8); transform: rotate(90deg); }
        .dlg-cards { display: grid; gap: 16px; }
      </style>

      <ha-card>
        <div id="content">Lade…</div>
      </ha-card>
    `;
  }

  async _getHelpers() {
    if (this._helpers) return this._helpers;
    if (window.loadCardHelpers) {
      this._helpers = await window.loadCardHelpers();
      return this._helpers;
    }
    return null;
  }

  _call(domain, service, data = {}) {
    if (!this._hass) return;
    return this._hass.callService(domain, service, data);
  }

  _armHome() { return this._call("alarm_control_panel", "alarm_arm_home", { entity_id: this._config.alarm_entity }); }
  _armAway() { return this._call("alarm_control_panel", "alarm_arm_away", { entity_id: this._config.alarm_entity }); }
  _disarm() { return this._call("alarm_control_panel", "alarm_disarm", { entity_id: this._config.alarm_entity }); }
  _trigger() { return this._call("alarm_control_panel", "alarm_trigger", { entity_id: this._config.alarm_entity }); }

  _stateLabel(state) {
    const s = String(state || "").toLowerCase();
    if (s === "disarmed") return "disarmed";
    if (s === "arming") return "arming";
    if (s === "armed_home") return "armed_home";
    if (s === "armed_away") return "armed_away";
    if (s === "pending") return "pending";
    if (s === "triggered") return "triggered";
    return s || "unknown";
  }

  _getPanelCameras(attrs) {
    const list = attrs && Array.isArray(attrs.camera_entities) ? attrs.camera_entities : [];
    return list.map((x) => String(x)).filter(Boolean);
  }

  _getCameras(attrs) {
    if (this._config.use_panel_cameras) return this._getPanelCameras(attrs);
    return (this._config.cameras || []).map((x) => String(x)).filter(Boolean);
  }

  async _buildCameraCardElement(cams) {
    const helpers = await this._getHelpers();
    if (!helpers || !cams || cams.length === 0) return null;

    const mode = String(this._config.camera_card || "picture-entity");

    if (mode === "picture-glance") {
      const cfg = {
        type: "picture-glance",
        title: this._config.popup_title || "Kameras",
        camera_image: cams[0],
        entities: [],
      };
      const el = helpers.createCardElement(cfg);
      el.hass = this._hass;
      return el;
    }

    const stackCfg = {
      type: "vertical-stack",
      cards: cams.map((cam) => ({
        type: "picture-entity",
        entity: cam,
        camera_image: cam,
        show_name: true,
        show_state: false,
        camera_view: "auto",
      })),
    };
    const el = helpers.createCardElement(stackCfg);
    el.hass = this._hass;
    return el;
  }

  async _openCameraPopup(attrs) {
    const cams = this._getCameras(attrs);
    if (!cams.length) return;

    if (!this._popup) {
      const dlg = document.createElement("dialog");
      dlg.className = "zigalarm-popup";

      dlg.innerHTML = `
        <div class="dlg-head">
          <div class="dlg-title"></div>
          <button class="dlg-close" type="button">✕</button>
        </div>
        <div class="dlg-body">
          <div class="dlg-cards"></div>
        </div>
      `;

      dlg.querySelector(".dlg-close").addEventListener("click", () => dlg.close());
      dlg.addEventListener("close", () => {
        this._popupOpenedFor = null;
        const box = dlg.querySelector(".dlg-cards");
        box.innerHTML = "";
      });

      document.body.appendChild(dlg);
      this._popup = dlg;
    }

    this._popup.querySelector(".dlg-title").textContent = this._config.popup_title || "Alarm-Kameras";

    const box = this._popup.querySelector(".dlg-cards");
    box.innerHTML = "";
    const camCard = await this._buildCameraCardElement(cams);
    if (camCard) {
      box.appendChild(camCard);
      camCard.hass = this._hass;
    }

    if (!this._popup.open) {
      try { this._popup.showModal(); } catch (e) { this._popup.setAttribute("open", ""); }
    }
  }

  _closeCameraPopup() {
    if (this._popup && this._popup.open) {
      try { this._popup.close(); } catch (e) { this._popup.removeAttribute("open"); }
    }
  }

  _updatePopupHass() {
    if (!this._popup || !this._popup.open) return;
    const cards = this._popup.querySelectorAll(".dlg-cards > *");
    cards.forEach((el) => {
      try { el.hass = this._hass; } catch (e) { }
    });
  }

  _handleAlarmTransition(oldState, newState, st) {
    const s = String(newState || "").toLowerCase();
    const old = String(oldState || "").toLowerCase();

    if (this._config.popup_on_trigger && s === "triggered") {
      this._popupOpenedFor = "triggered";
      this._openCameraPopup((st && st.attributes) || {});
      return;
    }

    if (this._config.popup_auto_close_on_disarm && s === "disarmed" && this._popupOpenedFor === "triggered") {
      this._closeCameraPopup();
      return;
    }

    if (this._config.popup_only_when_triggered && old === "triggered" && s !== "triggered") {
      this._closeCameraPopup();
    }
  }

  async _updateInlineCameras(container, attrs) {
    container.innerHTML = "";
    const cams = this._getCameras(attrs);
    if (!cams.length) return;

    const camCard = await this._buildCameraCardElement(cams);
    if (camCard) {
      container.appendChild(camCard);
      camCard.hass = this._hass;
    }
  }

  _update() {
    const content = this._root.getElementById("content");
    if (!content) return;

    const st = this._st();
    if (!st) {
      content.innerHTML = `
        <div class="warn">
          <b>Entität nicht gefunden</b><br/>
          <div style="margin-top:6px;">${this._config.alarm_entity}</div>
        </div>
      `;
      return;
    }

    const state = this._stateLabel(st.state);
    const attrs = st.attributes || {};
    const openSensors = Array.isArray(attrs.open_sensors) ? attrs.open_sensors : [];
    const lastTrig = attrs.last_trigger_entity || "-";
    const readyHome = attrs.ready_to_arm_home;
    const readyAway = attrs.ready_to_arm_away;

    const cams = this._getCameras(attrs);
    const hasCams = cams.length > 0;

    const showCameras = String(this._config.show_cameras || "popup");
    const showSetup = !!this._config.show_setup;

    content.innerHTML = `
      <div class="header" data-state="${st.state || ""}">
        <div class="title">${this._config.name || "ZigAlarm"}</div>
        <div class="pill">${state}</div>
      </div>

      <div class="row">
        <button class="btnHome">Aktivieren (Zuhause)</button>
        <button class="btnAway primary">Aktivieren (Abwesend)</button>
        <button class="btnDisarm">Unscharf</button>
        <button class="btnTrig danger">Alarm auslösen</button>
        ${hasCams ? `<button class="btnCams">Kameras</button>` : ``}
      </div>

      <div class="grid">
        <div class="box">
          <h4>Status</h4>
          <div class="kv"><span>Bereit (Home)</span><span>${readyHome ? "✅" : "⚠️"}</span></div>
          <div class="kv"><span>Bereit (Away)</span><span>${readyAway ? "✅" : "⚠️"}</span></div>
          <div class="kv"><span>Letzter Trigger</span><span style="font-family: monospace;">${lastTrig}</span></div>
        </div>

        <div class="box">
          <h4>Offene Sensoren</h4>
          ${openSensors.length ? `<ul class="list">${openSensors.map((e) => `<li>${e}</li>`).join("")}</ul>` : `<div class="muted">keine</div>`}
        </div>
      </div>

      ${showCameras === "inline" && hasCams ? `<div class="cams-inline box"><h4>Kameras</h4><div class="inlineCams"></div></div>` : ``}

      ${showSetup ? `
        <div class="setup">
          <b>Setup (Dashboard)</b>
          <small>Optional: Wenn du hier nichts brauchst → show_setup: false setzen.</small>
          <div class="muted">Du konfigurierst alles im ZigAlarm Panel. Diese Karte ist hauptsächlich eine Übersicht.</div>
        </div>
      ` : ``}
    `;

    content.querySelector(".btnHome")?.addEventListener("click", () => this._armHome());
    content.querySelector(".btnAway")?.addEventListener("click", () => this._armAway());
    content.querySelector(".btnDisarm")?.addEventListener("click", () => this._disarm());
    content.querySelector(".btnTrig")?.addEventListener("click", () => this._trigger());
    content.querySelector(".btnCams")?.addEventListener("click", () => {
      if (showCameras === "popup") this._openCameraPopup(attrs);
      else if (showCameras === "inline") {
        const box = content.querySelector(".inlineCams")?.parentElement;
        if (box) box.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });

    if (showCameras === "inline" && hasCams) {
      const inline = content.querySelector(".inlineCams");
      this._updateInlineCameras(inline, attrs);
    }
  }
}

customElements.define("zigalarm-card", ZigAlarmCard);
