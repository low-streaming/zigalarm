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
          --za-bg-body: #0b0c15; 
          --za-bg-card: rgba(20, 24, 35, 0.7);
          --za-primary: #0ea5e9; 
          --za-accent: #8b5cf6;
          --za-success: #10b981;
          --za-danger: #ef4444; 
          --za-text: #f8fafc;
          --za-text-muted: #94a3b8;
          --za-border: rgba(255, 255, 255, 0.08);
          font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: var(--za-text);
        }

        ha-card {
          padding: 20px;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(20, 24, 35, 0.95), rgba(11, 12, 21, 0.98)) !important;
          border: 1px solid var(--za-border);
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          color: var(--za-text);
          position: relative;
          overflow: hidden;
        }
        
        /* Subtle grid pattern */
        ha-card::before {
           content: ""; position: absolute; inset:0; 
           background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
           background-size: 20px 20px; pointer-events: none; opacity: 0.5;
        }

        .header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom: 20px; position:relative; z-index:2; }
        .header-left { display:flex; align-items:center; gap: 8px; }
        
        .title { 
          font-size: 1.1rem; font-weight: 800; letter-spacing: -0.02em;
          background: linear-gradient(135deg, #fff 0%, #cbd5e1 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        
        .pill { 
          font-size: 0.75rem; padding: 4px 10px; border-radius: 6px; 
          background: rgba(255,255,255,0.05); border: 1px solid var(--za-border);
          font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
        }
        .header[data-state*="armed"] .pill {
          background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.4); color: #6ee7b7; box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
        }
        .header[data-state="triggered"] .pill {
          background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.6); color: #fca5a5; animation: pulse-danger 1s infinite;
        }
        
        @keyframes pulse-danger { 
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 
          70% { box-shadow: 0 0 0 10px rgba(239,68,68,0); } 
        }

        /* Actions Grid */
        .actions-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; position: relative; z-index: 2; }
        
        .btn-action {
           display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
           background: rgba(255,255,255,0.03); border: 1px solid var(--za-border);
           border-radius: 12px; padding: 10px 4px; cursor: pointer; color: var(--za-text-muted);
           transition: all 0.2s;
        }
        .btn-action:hover { background: rgba(14, 165, 233, 0.1); border-color: var(--za-primary); color: #fff; transform: translateY(-2px); }
        .btn-action.danger:hover { background: rgba(239, 68, 68, 0.15); border-color: var(--za-danger); }
        
        .icon-box svg { width: 24px; height: 24px; display: block; }
        .btn-action span { font-size: 0.7rem; font-weight: 600; }
        
        .btn-cams {
           width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
           padding: 10px; border-radius: 12px; border: 1px solid var(--za-border);
           background: rgba(255,255,255,0.03); color: var(--za-text); cursor: pointer;
           margin-bottom: 16px; position: relative; z-index: 2; font-weight: 600; font-size: 0.9rem;
        }
        .btn-cams:hover { background: rgba(255,255,255,0.08); }

        .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 0; position:relative; z-index:2; }
        
        .box { 
          border: 1px solid var(--za-border); border-radius: 12px; padding: 12px;
          background: rgba(0,0,0,0.15); display: flex; flex-direction: column; gap: 8px;
          min-height: 80px;
        }
        .box h4 { margin: 0 0 4px 0; font-size: 0.75rem; 
           color: var(--za-text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; 
        }

        .status-row { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #333; }
        .status-row.ok .dot { background: var(--za-success); box-shadow: 0 0 8px var(--za-success); }
        .status-row.warn .dot { background: #f59e0b; }
        .status-row.warn { opacity: 0.8; }
        
        .last-trig { font-size: 0.75rem; color: var(--za-text-muted); font-family: monospace; margin-top: auto; }

        .list { margin: 0; padding: 0 0 0 12px; font-size: 0.8rem; color: var(--za-danger); }
        .muted-ok { color: var(--za-success); font-size: 0.8rem; opacity: 0.8; font-style: italic; }

        .setup { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--za-border); position: relative; z-index: 2; }
        
        .footer-card {
           margin-top: 16px; text-align: center; font-size: 0.7rem; color: var(--za-text-muted); 
           opacity: 0.8; letter-spacing: 0.05em; position: relative; z-index: 2;
        }
        .footer-card a {
          color: var(--za-primary);
          text-decoration: none;
          font-weight: 800;
          text-shadow: 0 0 8px rgba(14, 165, 233, 0.4);
          transition: all 0.2s;
          text-transform: uppercase;
        }
        .footer-card a:hover {
          color: #fff;
          text-shadow: 0 0 12px var(--za-primary);
        }
        
        /* Modal Popup Styles remain similar but darkened */
        dialog.zigalarm-popup {
          border: 1px solid var(--za-border); border-radius: 20px;
          padding: 0; max-width: min(900px, 92vw); width: 92vw;
          background: #1a1b23; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
          color: #fff; overflow: hidden;
        }
        /* Alarm Flash Animation */
        ha-card.triggered {
          animation: alarm-flash 1s infinite;
          border-color: var(--za-danger);
        }
        @keyframes alarm-flash {
          0% { box-shadow: inset 0 0 0 rgba(239, 68, 68, 0); }
          50% { box-shadow: inset 0 0 50px rgba(239, 68, 68, 0.5); }
          100% { box-shadow: inset 0 0 0 rgba(239, 68, 68, 0); }
        }

        /* Trigger Info in Popup */
        .trig-info {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.5);
          color: #fca5a5;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 20px;
          text-align: center;
          font-weight: 700;
          font-size: 1.1rem;
          display: flex; flex-direction: column; gap: 4px;
        }
        .trig-label { font-size: 0.8rem; text-transform: uppercase; opacity: 0.8; letter-spacing: 0.1em; }
        .trig-val { color: #fff; font-size: 1.2rem; }
        dialog::backdrop { background: rgba(0,0,0,.8); backdrop-filter: blur(5px); }
        .dlg-head { padding: 16px 20px; border-bottom: 1px solid var(--za-border); display: flex; justify-content: space-between; align-items: center; }
        .dlg-title { font-weight: 700; }
        .dlg-close { background: none; border: 1px solid var(--za-border); color: #fff; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; }
        .dlg-close:hover { background: var(--za-danger); border-color: var(--za-danger); }
        .dlg-body { padding: 20px; background: #0b0c15; }
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
    // Determine trigger source
    const trigEid = attrs.last_trigger_entity;
    let trigName = "Unbekannt";
    if (trigEid && this._hass.states[trigEid]) {
      const a = this._hass.states[trigEid].attributes;
      trigName = a.friendly_name || trigEid;
    } else if (trigEid) {
      trigName = trigEid;
    }

    const cams = this._getCameras(attrs);

    // Popup logic
    if (!this._popup) {
      const dlg = document.createElement("dialog");
      dlg.className = "zigalarm-popup";

      dlg.innerHTML = `
        <div class="dlg-head">
          <div class="dlg-title"></div>
          <button class="dlg-close" type="button">✕</button>
        </div>
        <div class="dlg-body">
          <div class="dlg-info"></div>
          <div class="dlg-cards"></div>
        </div>
      `;

      dlg.querySelector(".dlg-close").addEventListener("click", () => dlg.close());
      dlg.addEventListener("close", () => {
        this._popupOpenedFor = null;
        const box = dlg.querySelector(".dlg-cards");
        box.innerHTML = "";
        const infoBox = dlg.querySelector(".dlg-info");
        infoBox.innerHTML = "";
      });

      document.body.appendChild(dlg);
      this._popup = dlg;
    }

    this._popup.querySelector(".dlg-title").textContent = "ALARM AUSGELÖST!";

    // Show Trigger Info
    const infoBox = this._popup.querySelector(".dlg-info");
    if (trigEid) {
      infoBox.innerHTML = `
        <div class="trig-info">
           <span class="trig-label">Auslöser</span>
           <span class="trig-val">${trigName}</span>
        </div>
      `;
    } else {
      infoBox.innerHTML = "";
    }

    const box = this._popup.querySelector(".dlg-cards");
    box.innerHTML = "";

    if (cams.length > 0) {
      const camCard = await this._buildCameraCardElement(cams);
      if (camCard) {
        box.appendChild(camCard);
        camCard.hass = this._hass;
      }
    } else {
      box.innerHTML = `<div style="text-align:center; padding:20px; color:#aaa;">Keine Kameras konfiguriert</div>`;
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
    const card = this._root.querySelector("ha-card");
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

    // Toggle Flashing Class
    if (state === "triggered") {
      card.classList.add("triggered");
    } else {
      card.classList.remove("triggered");
    }

    const cams = this._getCameras(attrs);
    const hasCams = cams.length > 0;

    const showCameras = String(this._config.show_cameras || "popup");
    const showSetup = !!this._config.show_setup;

    // State Icons mapping
    const getIcon = (action) => {
      if (action === 'home') return '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 5.69l5 4.5V18h-2v-6H9v6H7v-7.81l5-4.5M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z"/></svg>';
      if (action === 'away') return '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3m0 10c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>';
      if (action === 'disarm') return '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4m0 4a3 3 0 0 1 3 3 3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1 3-3m5.13 12A9.69 9.69 0 0 1 12 20.92 9.69 9.69 0 0 1 6.87 17a5.5 5.5 0 0 1 10.26 0z"/></svg>';
      if (action === 'trigger') return '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
      if (action === 'camera') return '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 6.5h-1.28l-.32-1a3 3 0 0 0-2.84-2H9.44A3 3 0 0 0 6.6 5.5l-.32 1H5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-8a3 3 0 0 0-3-3M12 17a5 5 0 1 1 5-5 5 5 0 0 1-5 5m0-8a3 3 0 1 0 3 3 3 3 0 0 0-3-3z"/></svg>';
      return '';
    };

    const iconAway = '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4m0 6a3 3 0 0 1 3 3c0 1.3-.84 2.4-2 2.82V15h-2v-2.18c-1.16-.42-2-1.52-2-2.82a3 3 0 0 1 3-3z"/></svg>';

    content.innerHTML = `
      <div class="header" data-state="${st.state || ""}">
        <div class="header-left">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--za-primary)"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
           <div class="title">${this._config.name || "ZigAlarm"}</div>
        </div>
        <div class="pill">${state}</div>
      </div>

      <div class="actions-grid">
        <button class="btn-action" title="Zuhause aktivieren" id="btnHome">
          <div class="icon-box">${getIcon('home')}</div>
          <span>Zuhause</span>
        </button>
        <button class="btn-action" title="Abwesend aktivieren" id="btnAway">
          <div class="icon-box">${iconAway}</div>
          <span>Abwesend</span>
        </button>
        <button class="btn-action" title="Unscharf schalten" id="btnDisarm">
          <div class="icon-box">${getIcon('disarm')}</div>
          <span>Unscharf</span>
        </button>
        <button class="btn-action danger" title="Alarm auslösen" id="btnTrig">
          <div class="icon-box">${getIcon('trigger')}</div>
          <span>ALARM</span>
        </button>
      </div>

      ${hasCams ? `<button class="btn-cams" id="btnCams">${getIcon('camera')} Kameras ansehen</button>` : ``}

    <div class="grid">
      <div class="box">
        <h4>System Status</h4>
        <div class="status-row ${readyHome ? 'ok' : 'warn'}">
          <div class="dot"></div> <span>Bereit für Home</span>
        </div>
        <div class="status-row ${readyAway ? 'ok' : 'warn'}">
          <div class="dot"></div> <span>Bereit für Away</span>
        </div>
        ${lastTrig !== "-" ? `<div class="last-trig">Letzter: ${lastTrig}</div>` : ''}
      </div>

      <div class="box">
        <h4>Offene Sensoren</h4>
        ${openSensors.length ? `<ul class="list">${openSensors.map((e) => `<li>${e}</li>`).join("")}</ul>` : `<div class="muted-ok">Alles geschlossen</div>`}
      </div>
    </div>

      ${showCameras === "inline" && hasCams ? `<div class="cams-inline box"><h4>Kameras</h4><div class="inlineCams"></div></div>` : ``}

      ${showSetup ? `
        <div class="setup">
          <b>Setup</b>
          <small class="muted">Konfiguration über das ZigAlarm Panel.</small>
        </div>
      ` : ``
      }

    <div class="footer-card">Powered by <a href="https://openkairo.de" target="_blank">OPENKAIRO</a></div>
    `;

    // Re-attach listeners
    content.querySelector("#btnHome")?.addEventListener("click", () => this._armHome());
    content.querySelector("#btnAway")?.addEventListener("click", () => this._armAway());
    content.querySelector("#btnDisarm")?.addEventListener("click", () => this._disarm());
    content.querySelector("#btnTrig")?.addEventListener("click", () => this._trigger());
    content.querySelector("#btnCams")?.addEventListener("click", () => {
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
