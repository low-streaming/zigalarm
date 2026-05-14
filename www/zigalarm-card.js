/**
 * ZigAlarm Infinity Edition V2.0
 * Premium Security Layer for Home Assistant
 * Powered by OpenKairo OS
 */

console.log("%c 🛡️ ZIGALARM INFINITY LOADING ", "background: #0ea5e9; color: #fff; font-weight: bold; padding: 5px;");

class ZigAlarmCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = {};
    this._root = this.attachShadow({ mode: "open" });

    this._lastAlarmState = null;
    this._popup = null;
    this._popupOpenedFor = null;
    this._helpers = null;
    this._log = [];

    this._renderSkeleton();
  }

  // ---- HA card API ----
  setConfig(config) {
    if (!config) throw new Error("Config fehlt");
    const alarmEntity = (config.alarm_entity || config.entity || "").trim();
    if (!alarmEntity) throw new Error("alarm_entity fehlt");

    this._config = {
      alarm_entity: alarmEntity,
      name: config.name || "ZIGALARM SECURITY",
      show_setup: config.show_setup ?? false,
      show_cameras: config.show_cameras || "popup",
      use_panel_cameras: config.use_panel_cameras ?? true,
      cameras: Array.isArray(config.cameras) ? config.cameras : [],
      camera_card: config.camera_card || "picture-entity",
      popup_on_trigger: config.popup_on_trigger ?? true,
      popup_only_when_triggered: config.popup_only_when_triggered ?? true,
      popup_auto_close_on_disarm: config.popup_auto_close_on_disarm ?? true,
      popup_title: config.popup_title || "TACTICAL MONITORING",
    };

    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    const st = this._st();
    const newState = st ? String(st.state || "") : null;

    if (newState && this._lastAlarmState !== newState) {
      this._handleAlarmTransition(this._lastAlarmState, newState, st);
      this._lastAlarmState = newState;
      this._addLog(`SYSTEM STATE: ${newState.toUpperCase()}`, newState === 'triggered' ? 'danger' : 'info');
    } else if (!this._lastAlarmState && newState) {
      this._lastAlarmState = newState;
    }

    this._update();
    this._updatePopupHass();
  }

  getCardSize() { return 5; }

  // ---- internals ----
  _st() {
    if (!this._hass) return null;
    return this._hass.states[this._config.alarm_entity] || null;
  }

  _addLog(msg, type = 'info') {
    const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this._log.unshift({ time, msg, type });
    if (this._log.length > 5) this._log.pop();
    this._updateLogUI();
  }

  _updateLogUI() {
    const container = this._root.getElementById('sys-log');
    if (!container) return;
    container.innerHTML = this._log.map(l => `
      <div class="log-item ${l.type}">
        <span class="log-time">[${l.time}]</span>
        <span class="log-msg">${l.msg}</span>
      </div>
    `).join('');
  }

  _renderSkeleton() {
    this._root.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&family=Orbitron:wght@400;700;900&family=JetBrains+Mono:wght@400;700&display=swap');

        :host {
          --za-primary: #0ea5e9; 
          --za-accent: #00f6ff;
          --za-success: #10b981;
          --za-danger: #ff003c; 
          --za-warning: #ffb800;
          --za-bg: #08080a;
          --za-glass: rgba(10, 15, 25, 0.6);
          --za-glass-border: rgba(255, 255, 255, 0.1);
          --font-main: 'Outfit', sans-serif;
          --font-tech: 'Orbitron', sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
          color: #fff;
          font-family: var(--font-main);
        }

        ha-card {
          padding: 0;
          border-radius: 32px;
          background: var(--za-bg) !important;
          border: 1px solid var(--za-glass-border);
          box-shadow: 0 40px 80px rgba(0,0,0,0.6);
          position: relative;
          overflow: hidden !important;
          transition: 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        /* Tactical Matrix Background */
        .matrix-bg {
          position: absolute; inset: 0; z-index: 0; opacity: 0.12; pointer-events: none;
          background-image: 
            radial-gradient(circle at 1.5px 1.5px, var(--za-primary) 1.5px, transparent 0);
          background-size: 30px 30px;
        }
        .scanline {
          position: absolute; inset: 0; z-index: 1; pointer-events: none;
          background: linear-gradient(to bottom, transparent, rgba(14, 165, 233, 0.04) 50%, transparent);
          background-size: 100% 200%; animation: scan 6s linear infinite;
        }
        @keyframes scan { from { background-position: 0 -100%; } to { background-position: 0 100%; } }

        .card-content { position: relative; z-index: 2; padding: 35px; }

        /* Header & Status */
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .branding { display: flex; align-items: center; gap: 15px; font-family: var(--font-tech); font-weight: 900; letter-spacing: 2px; }
        .branding svg { width: 28px; height: 28px; color: var(--za-primary); filter: drop-shadow(0 0 10px var(--za-primary)); }
        
        .status-pill {
          padding: 8px 20px; border-radius: 100px; font-family: var(--font-tech); font-size: 0.8rem; font-weight: 900;
          letter-spacing: 2px; text-transform: uppercase; background: rgba(255,255,255,0.05); border: 1px solid var(--za-glass-border);
          display: flex; align-items: center; gap: 10px; transition: 0.4s;
        }
        .status-pill.disarmed { color: var(--za-success); border-color: rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.05); }
        .status-pill.armed { color: var(--za-primary); border-color: var(--za-primary); background: rgba(14, 165, 233, 0.1); box-shadow: 0 0 20px rgba(14, 165, 233, 0.2); }
        .status-pill.triggered { color: var(--za-danger); border-color: var(--za-danger); background: rgba(255, 0, 60, 0.15); animation: pulse-danger 0.5s infinite; }
        .status-pill.pending { color: var(--za-warning); border-color: var(--za-warning); background: rgba(255, 184, 0, 0.1); }

        @keyframes pulse-danger { 0%, 100% { transform: scale(1); box-shadow: 0 0 10px var(--za-danger); } 50% { transform: scale(1.08); box-shadow: 0 0 40px var(--za-danger); } }

        /* Action Grid */
        .actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 30px; }
        .btn-action {
          background: rgba(255,255,255,0.03); border: 1px solid var(--za-glass-border); border-radius: 20px;
          padding: 18px 5px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
          cursor: pointer; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); color: rgba(255,255,255,0.3);
        }
        .btn-action:hover { background: rgba(255,255,255,0.08); transform: translateY(-4px); border-color: var(--za-primary); color: #fff; box-shadow: 0 10px 20px rgba(0,0,0,0.4); }
        .btn-action.active { background: rgba(14, 165, 233, 0.12); border-color: var(--za-primary); color: var(--za-primary); border-width: 1.5px; }
        .btn-action.danger:hover { border-color: var(--za-danger); color: var(--za-danger); background: rgba(255, 0, 60, 0.1); box-shadow: 0 10px 25px rgba(255,0,60,0.3); }
        .btn-action ha-icon { --mdc-icon-size: 26px; }
        .btn-action span { font-size: 0.65rem; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; font-family: var(--font-tech); }

        /* Info Grid */
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .info-box { 
          background: rgba(255,255,255,0.02); border: 1px solid var(--za-glass-border); border-radius: 24px; padding: 20px;
          display: flex; flex-direction: column; gap: 12px; position: relative; overflow: hidden;
        }
        .info-box h4 { margin: 0; font-size: 0.7rem; font-weight: 900; color: var(--za-primary); text-transform: uppercase; letter-spacing: 2px; opacity: 0.5; }
        
        .status-row { display: flex; align-items: center; gap: 10px; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.5px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.1); transition: 0.3s; }
        .status-row.ok .dot { background: var(--za-success); box-shadow: 0 0 12px var(--za-success); }
        .status-row.warn .dot { background: var(--za-warning); box-shadow: 0 0 8px var(--za-warning); }

        .sensor-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
        .sensor-item { font-family: var(--font-mono); font-size: 0.7rem; color: var(--za-danger); display: flex; align-items: center; gap: 6px; font-weight: 700; }
        .sensor-item::before { content: '>'; color: var(--za-danger); opacity: 0.7; }
        .all-clear { font-size: 0.8rem; font-style: italic; color: var(--za-success); opacity: 0.7; font-weight: 800; letter-spacing: 1px; }

        /* Log UI */
        #sys-log { 
          margin-bottom: 25px; height: 65px; overflow: hidden; 
          font-family: var(--font-mono); font-size: 0.7rem; 
          mask-image: linear-gradient(to bottom, white, transparent);
        }
        .log-item { margin-bottom: 4px; display: flex; gap: 10px; animation: slideUp 0.3s ease-out; }
        .log-time { opacity: 0.4; font-weight: 700; }
        .log-msg { font-weight: 600; letter-spacing: 0.5px; opacity: 0.8; }
        .log-item.danger { color: var(--za-danger); }
        .log-item.warning { color: var(--za-warning); }
        @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        /* Trigger Animation Overlay */
        .glitch-overlay {
          position: absolute; inset: 0; z-index: 100; pointer-events: none;
          background: rgba(255, 0, 60, 0.15); mix-blend-mode: overlay; display: none;
        }
        ha-card.triggered .glitch-overlay { display: block; animation: glitch 0.15s infinite; }
        @keyframes glitch { 0% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.02) translate(3px, -3px); } 100% { opacity: 0.3; transform: scale(1) translate(-3px, 3px); } }

        /* Popup Tactical Monitor */
        dialog.tactical-monitor {
          background: rgba(5, 7, 12, 0.9); backdrop-filter: blur(50px) saturate(200%); border: 2px solid var(--za-danger);
          border-radius: 40px; padding: 0; max-width: 95vw; width: 1100px; color: #fff;
          box-shadow: 0 0 150px rgba(255, 0, 60, 0.4); overflow: hidden;
        }
        .monitor-head { padding: 30px 40px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; }
        .monitor-title { font-family: var(--font-tech); font-size: 1.6rem; font-weight: 900; letter-spacing: 6px; color: var(--za-danger); text-shadow: 0 0 20px var(--za-danger); }
        .monitor-close { width: 50px; height: 50px; background: rgba(255,255,255,0.05); border-radius: 15px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.3s; }
        .monitor-close:hover { background: var(--za-danger); transform: rotate(90deg); }
        .monitor-body { padding: 40px; }
        .trig-info { 
          background: rgba(255, 0, 60, 0.1); border: 1.5px solid rgba(255, 0, 60, 0.4); border-radius: 20px; padding: 30px;
          margin-bottom: 35px; text-align: center; position: relative; overflow: hidden;
        }
        .trig-info::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 8px; background: var(--za-danger); }
        .trig-label { font-size: 0.85rem; font-weight: 900; text-transform: uppercase; letter-spacing: 5px; color: var(--za-danger); margin-bottom: 10px; display: block; opacity: 0.8; }
        .trig-val { font-family: var(--font-tech); font-size: 2.2rem; font-weight: 900; letter-spacing: 2px; }
        
        .footer { text-align: center; margin-top: 35px; font-size: 0.75rem; font-weight: 900; letter-spacing: 3px; color: rgba(255,255,255,0.15); font-family: var(--font-tech); }
        .footer a { color: var(--za-primary); text-decoration: none; border-bottom: 1px solid transparent; transition: 0.3s; }
        .footer a:hover { border-bottom-color: var(--za-primary); }

        @media (max-width: 650px) {
          .info-grid { grid-template-columns: 1fr; }
          .actions { grid-template-columns: repeat(2, 1fr); }
          .monitor-title { font-size: 1.1rem; letter-spacing: 3px; }
        }
      </style>

      <ha-card>
        <div class="matrix-bg"></div>
        <div class="scanline"></div>
        <div class="glitch-overlay"></div>
        <div class="card-content" id="content">INITIALIZING SECURITY INTERFACE...</div>
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

  _armHome() { 
    this._addLog("INITIATING ARM HOME...", "info");
    return this._call("alarm_control_panel", "alarm_arm_home", { entity_id: this._config.alarm_entity }); 
  }
  _armAway() { 
    this._addLog("INITIATING ARM AWAY...", "info");
    return this._call("alarm_control_panel", "alarm_arm_away", { entity_id: this._config.alarm_entity }); 
  }
  _disarm() { 
    this._addLog("SYSTEM DISARM REQUESTED", "warning");
    return this._call("alarm_control_panel", "alarm_disarm", { entity_id: this._config.alarm_entity }); 
  }
  _trigger() { 
    this._addLog("PANIC TRIGGER ACTIVATED!", "danger");
    return this._call("alarm_control_panel", "alarm_trigger", { entity_id: this._config.alarm_entity }); 
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
      const el = helpers.createCardElement({ type: "picture-glance", title: this._config.popup_title, camera_image: cams[0], entities: [] });
      el.hass = this._hass;
      return el;
    }

    const el = helpers.createCardElement({ 
      type: "vertical-stack", 
      cards: cams.map(cam => ({ 
        type: "picture-entity", 
        entity: cam, 
        camera_image: cam, 
        show_name: true, 
        show_state: false, 
        camera_view: "auto" 
      })) 
    });
    el.hass = this._hass;
    return el;
  }

  async _openCameraPopup(attrs) {
    const trigEid = attrs.last_trigger_entity;
    let trigName = "PERIMETER BREACH";
    if (trigEid && this._hass.states[trigEid]) {
      trigName = this._hass.states[trigEid].attributes.friendly_name || trigEid;
    }

    const cams = this._getCameras(attrs);
    if (!this._popup) {
      const dlg = document.createElement("dialog");
      dlg.className = "tactical-monitor";
      dlg.innerHTML = `
        <div class="monitor-head">
          <div class="monitor-title">TACTICAL SURVEILLANCE FEED</div>
          <div class="monitor-close"><ha-icon icon="mdi:close" style="--mdc-icon-size:30px;"></ha-icon></div>
        </div>
        <div class="monitor-body">
          <div class="dlg-info"></div>
          <div class="dlg-cards" style="display:grid; gap:20px;"></div>
        </div>
      `;
      dlg.querySelector(".monitor-close").onclick = () => dlg.close();
      dlg.onclose = () => { this._popupOpenedFor = null; dlg.querySelector(".dlg-cards").innerHTML = ""; };
      document.body.appendChild(dlg);
      this._popup = dlg;
    }

    const infoBox = this._popup.querySelector(".dlg-info");
    infoBox.innerHTML = trigEid ? `
      <div class="trig-info">
        <span class="trig-label">INTRUSION DETECTED AT</span>
        <span class="trig-val">${trigName.toUpperCase()}</span>
      </div>` : "";

    const box = this._popup.querySelector(".dlg-cards");
    box.innerHTML = "";
    if (cams.length > 0) {
      const camCard = await this._buildCameraCardElement(cams);
      if (camCard) box.appendChild(camCard);
    } else {
      box.innerHTML = `<div style="text-align:center; padding:60px; color:#333; font-family:var(--font-tech); font-weight:900; letter-spacing:4px;">NO ACTIVE VIDEO NODES FOUND</div>`;
    }

    if (!this._popup.open) this._popup.showModal();
  }

  _closeCameraPopup() { if (this._popup && this._popup.open) this._popup.close(); }

  _updatePopupHass() {
    if (!this._popup || !this._popup.open) return;
    this._popup.querySelectorAll(".dlg-cards > *").forEach(el => { try { el.hass = this._hass; } catch(e){} });
  }

  _handleAlarmTransition(oldState, newState, st) {
    const s = String(newState || "").toLowerCase();
    const old = String(oldState || "").toLowerCase();
    if (this._config.popup_on_trigger && s === "triggered") {
      this._popupOpenedFor = "triggered";
      this._openCameraPopup((st && st.attributes) || {});
    } else if (this._config.popup_auto_close_on_disarm && s === "disarmed" && this._popupOpenedFor === "triggered") {
      this._closeCameraPopup();
    } else if (this._config.popup_only_when_triggered && old === "triggered" && s !== "triggered") {
      this._closeCameraPopup();
    }
  }

  _update() {
    const content = this._root.getElementById("content");
    const card = this._root.querySelector("ha-card");
    if (!content) return;

    const st = this._st();
    if (!st) {
      content.innerHTML = `<div style="color:var(--za-danger); padding:20px; font-weight:bold; font-family:var(--font-tech);">CRITICAL: ENTITY NOT FOUND<br/>${this._config.alarm_entity}</div>`;
      return;
    }

    const state = String(st.state).toLowerCase();
    const attrs = st.attributes || {};
    const openSensors = Array.isArray(attrs.open_sensors) ? attrs.open_sensors : [];
    const readyHome = attrs.ready_to_arm_home;
    const readyAway = attrs.ready_to_arm_away;

    if (state === "triggered") card.classList.add("triggered");
    else card.classList.remove("triggered");

    const cams = this._getCameras(attrs);
    const hasCams = cams.length > 0;

    content.innerHTML = `
      <div class="header">
        <div class="branding">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          <div>${this._config.name}</div>
        </div>
        <div class="status-pill ${state.includes('armed') ? 'armed' : state}" id="status-pill">
          ${state.replace('_', ' ')}
        </div>
      </div>

      <div id="sys-log"></div>

      <div class="actions">
        <button class="btn-action ${state === 'armed_home' ? 'active' : ''}" id="btnHome" title="ARM HOME">
          <ha-icon icon="mdi:home-shield"></ha-icon>
          <span>Home</span>
        </button>
        <button class="btn-action ${state === 'armed_away' ? 'active' : ''}" id="btnAway" title="ARM AWAY">
          <ha-icon icon="mdi:shield-lock"></ha-icon>
          <span>Away</span>
        </button>
        <button class="btn-action ${state === 'disarmed' ? 'active' : ''}" id="btnDisarm" title="DISARM">
          <ha-icon icon="mdi:shield-off"></ha-icon>
          <span>Disarm</span>
        </button>
        <button class="btn-action danger" id="btnTrig" title="PANIC TRIGGER">
          <ha-icon icon="mdi:alert-octagon"></ha-icon>
          <span>Panic</span>
        </button>
      </div>

      ${hasCams ? `<button class="btn-action" id="btnCams" style="width:100%; margin-bottom:30px; flex-direction:row; padding:18px; border-radius:20px; background:rgba(255,255,255,0.05); border-color:rgba(14, 165, 233, 0.4);">
        <ha-icon icon="mdi:video-security" style="color:var(--za-primary);"></ha-icon>
        <span style="color:white; margin-left:10px;">TACTICAL SURVEILLANCE FEED</span>
      </button>` : ''}

      <div class="info-grid">
        <div class="info-box">
          <h4>Security Matrix</h4>
          <div class="status-row ${readyHome ? 'ok' : 'warn'}">
            <div class="dot"></div> <span>Ready for Home</span>
          </div>
          <div class="status-row ${readyAway ? 'ok' : 'warn'}">
            <div class="dot"></div> <span>Ready for Away</span>
          </div>
          ${attrs.last_trigger_entity ? `<div style="font-size:0.55rem; opacity:0.3; font-family:var(--font-mono); margin-top:auto; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">[L-TRG] ${attrs.last_trigger_entity}</div>` : ''}
        </div>

        <div class="info-box">
          <h4>Vulnerabilities</h4>
          ${openSensors.length ? `
            <div class="sensor-list">
              ${openSensors.slice(0, 3).map(s => `<div class="sensor-item">${s}</div>`).join('')}
              ${openSensors.length > 3 ? `<div style="font-size:0.6rem; opacity:0.5; font-weight:700; color:var(--za-danger);">+ ${openSensors.length - 3} NODES ACTIVE</div>` : ''}
            </div>
          ` : `<div class="all-clear">PERIMETER SECURE</div>`}
        </div>
      </div>

      <div class="footer">ENCRYPTED CONNECTION // <a href="https://openkairo.de" target="_blank">OPENKAIRO</a></div>
    `;

    this._updateLogUI();

    content.querySelector("#btnHome")?.onclick = () => this._armHome();
    content.querySelector("#btnAway")?.onclick = () => this._armAway();
    content.querySelector("#btnDisarm")?.onclick = () => this._disarm();
    content.querySelector("#btnTrig")?.onclick = () => this._trigger();
    content.querySelector("#btnCams")?.onclick = () => this._openCameraPopup(attrs);
  }
}

customElements.define("zigalarm-card", ZigAlarmCard);
