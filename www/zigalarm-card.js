/**
 * ZigAlarm Infinity Card V1.0.0
 * Standalone Lovelace Card for Home Assistant
 * Premium Security HUD // Tactical Dashboard Edition
 */

console.log("%c 🛡️ ZIGALARM INFINITY V1.0.0 CARD LOADING ", "background: #0ea5e9; color: #fff; font-weight: bold; padding: 5px;");

class ZigAlarmCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = {};
    this._root = this.attachShadow({ mode: "open" });
    this._lastAlarmState = null;
    this._log = [];
    this._renderSkeleton();
  }

  setConfig(config) {
    if (!config) throw new Error("Konfiguration fehlt");
    const alarmEntity = (config.alarm_entity || config.entity || "alarm_control_panel.zigalarm").trim();
    this._config = {
      alarm_entity: alarmEntity,
      name: config.name || "ZIGALARM SECURITY",
      show_log: config.show_log ?? true,
    };
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    const st = this._st();
    if (st && st.state !== this._lastAlarmState) {
      this._lastAlarmState = st.state;
      this._fetchTacticalLog();
    }
    this._update();
  }

  getCardSize() { return 4; }

  _st() {
    return this._hass ? this._hass.states[this._config.alarm_entity] : null;
  }

  async _fetchTacticalLog() {
    if (!this._hass) return;
    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const events = await this._hass.callApi('GET', `logbook/${startTime}?entity=${this._config.alarm_entity}`);
      
      if (events && Array.isArray(events)) {
        this._log = events.slice(-6).reverse().map(ev => {
          const dt = new Date(ev.when || ev.last_changed);
          const timeStr = dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          const dateStr = dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
          
          let msg = ev.message || ev.state;
          if (msg === 'disarmed') msg = "SYSTEM UNSCHARF";
          else if (msg === 'armed_home') msg = "MODUS: ZUHAUSE";
          else if (msg === 'armed_away') msg = "MODUS: ABWESEND";
          else if (msg === 'triggered') msg = "!!! ALARM AUSGELÖST !!!";
          else if (msg === 'pending') msg = "SCHARFSCHALTUNG LÄUFT";

          return {
            time: `${dateStr} ${timeStr}`,
            msg: msg.toUpperCase(),
            type: (ev.state === 'triggered' || msg.includes('ALARM')) ? 'danger' : 'info'
          };
        });
        this._updateLogUI();
      }
    } catch (e) {
      console.error("ZigAlarm Log Error:", e);
    }
  }

  _updateLogUI() {
    const container = this._root.getElementById('sys-log');
    if (!container) return;
    container.innerHTML = this._log.map(l => `
      <div class="log-item ${l.type}">
        <span class="log-time">${l.time}</span>
        <span class="log-msg">${l.msg}</span>
      </div>
    `).join('');
  }

  _renderSkeleton() {

    this._root.innerHTML = `
      <style>

        :host {
          --za-primary: #0ea5e9; 
          --za-accent: #00f6ff;
          --za-success: #10b981;
          --za-danger: #ff003c; 
          --za-warning: #ffb800;
          --za-bg: #08080a;
          --za-glass: rgba(10, 15, 25, 0.7);
          --za-glass-border: rgba(255, 255, 255, 0.1);
          --font-main: 'Outfit', sans-serif;
          --font-tech: 'Orbitron', sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
        }

        ha-card {
          padding: 0; border-radius: 28px; background: var(--za-bg) !important;
          border: 1px solid var(--za-glass-border); position: relative; overflow: hidden !important;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }

        .matrix-bg {
          position: absolute; inset: 0; opacity: 0.1; pointer-events: none;
          background-image: radial-gradient(circle at 1.5px 1.5px, var(--za-primary) 1.5px, transparent 0);
          background-size: 25px 25px;
        }

        .card-content { position: relative; z-index: 2; padding: 25px; }

        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .branding { display: flex; align-items: center; gap: 10px; font-family: var(--font-tech); font-weight: 900; font-size: 0.9rem; letter-spacing: 1px; }
        .branding svg { width: 22px; height: 22px; color: var(--za-primary); }
        
        .status-pill {
          padding: 6px 15px; border-radius: 100px; font-family: var(--font-tech); font-size: 0.7rem; font-weight: 900;
          letter-spacing: 1.5px; background: rgba(255,255,255,0.05); border: 1px solid var(--za-glass-border);
        }
        .status-pill.disarmed { color: var(--za-success); border-color: rgba(16, 185, 129, 0.3); }
        .status-pill.armed { color: var(--za-primary); border-color: var(--za-primary); box-shadow: 0 0 15px rgba(14, 165, 233, 0.2); }
        .status-pill.triggered { color: var(--za-danger); border-color: var(--za-danger); animation: pulse 1s infinite; }

        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

        .actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
        .btn-action {
          background: rgba(255,255,255,0.03); border: 1px solid var(--za-glass-border); border-radius: 15px;
          padding: 15px 5px; display: flex; flex-direction: column; align-items: center; gap: 8px;
          cursor: pointer; transition: 0.2s; color: rgba(255,255,255,0.4);
        }
        .btn-action:hover { background: rgba(255,255,255,0.08); border-color: var(--za-primary); color: #fff; }
        .btn-action.active { background: rgba(14, 165, 233, 0.1); border-color: var(--za-primary); color: var(--za-primary); }
        .btn-action.danger:hover { border-color: var(--za-danger); color: var(--za-danger); }
        .btn-action ha-icon { --mdc-icon-size: 22px; }
        .btn-action span { font-size: 0.55rem; font-weight: 800; text-transform: uppercase; font-family: var(--font-tech); }

        .tactical-log {
          background: rgba(0,0,0,0.3); border-radius: 15px; padding: 15px; border: 1px solid rgba(255,255,255,0.05);
          margin-top: 10px; min-height: 80px;
        }
        .log-item { display: flex; gap: 10px; font-family: var(--font-mono); font-size: 0.65rem; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
        .log-time { color: var(--za-primary); opacity: 0.5; min-width: 75px; }
        .log-msg { color: #fff; opacity: 0.8; }
        .log-item.danger { color: var(--za-danger); }

        .info-row { display: flex; justify-content: space-between; margin-top: 15px; font-size: 0.65rem; font-weight: 700; opacity: 0.5; font-family: var(--font-tech); }
      </style>

      <ha-card>
        <div class="matrix-bg"></div>
        <div class="card-content" id="content">SYSTEM INITIALISIERE...</div>
      </ha-card>
    `;
  }

  _call(service, data = {}) {
    if (!this._hass) return;
    this._hass.callService("alarm_control_panel", service, { entity_id: this._config.alarm_entity, ...data });
  }

  _update() {
    const content = this._root.getElementById("content");
    if (!content) return;
    const st = this._st();
    if (!st) {
      content.innerHTML = "ENTITÄT NICHT GEFUNDEN";
      return;
    }

    const stateRaw = st.state;
    const stateDisplay = stateRaw === 'disarmed' ? 'UNSCHARF' : stateRaw === 'armed_home' ? 'ZUHAUSE' : stateRaw === 'armed_away' ? 'ABWESEND' : stateRaw === 'triggered' ? 'ALARM' : stateRaw.toUpperCase();

    content.innerHTML = `
      <div class="header">
        <div class="branding">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          <div>${this._config.name}</div>
        </div>
        <div class="status-pill ${stateRaw.includes('armed') ? 'armed' : stateRaw}">
          ${stateDisplay}
        </div>
      </div>

      <div class="actions">
        <div class="btn-action ${stateRaw === 'armed_home' ? 'active' : ''}" onclick="this.getRootNode().host._call('alarm_arm_home')">
          <ha-icon icon="mdi:home-shield"></ha-icon>
          <span>Zuhause</span>
        </div>
        <div class="btn-action ${stateRaw === 'armed_away' ? 'active' : ''}" onclick="this.getRootNode().host._call('alarm_arm_away')">
          <ha-icon icon="mdi:shield-lock"></ha-icon>
          <span>Abwesend</span>
        </div>
        <div class="btn-action ${stateRaw === 'disarmed' ? 'active' : ''}" onclick="this.getRootNode().host._call('alarm_disarm')">
          <ha-icon icon="mdi:shield-off"></ha-icon>
          <span>Deaktiv</span>
        </div>
        <div class="btn-action danger" onclick="this.getRootNode().host._call('alarm_trigger')">
          <ha-icon icon="mdi:alert-octagon"></ha-icon>
          <span>Panik</span>
        </div>
      </div>

      <div class="tactical-log" id="sys-log">
        <div style="text-align:center; padding:20px; opacity:0.3; font-size:0.6rem;">LADE TAKTIISCHE DATEN...</div>
      </div>

      <div class="info-row">
        <span>SECURITY LAYER: INFINITY V1.0</span>
        <span>ZIGALARM CORE</span>
      </div>
    `;
    this._updateLogUI();
  }
}

customElements.define("zigalarm-card", ZigAlarmCard);

window.customCards = window.customCards || [];
if (!window.customCards.find(c => c.type === "zigalarm-card")) {
  window.customCards.push({
    type: "zigalarm-card",
    name: "ZigAlarm Infinity Card",
    preview: true,
    description: "High-End Alarmanlagen-Steuerung im OpenKairo Design.",
  });
}
