/**
 * ZigAlarm Infinity Panel V1.0.0
 * Premium Security Management Interface
 * Deutsche Version // Infinity Edition // Manual Mapping Tool // Full Aesthetic Restore
 */

const fireEvent = (node, type, detail = {}, options = {}) => {
  const event = new Event(type, {
    bubbles: options.bubbles ?? true,
    cancelable: options.cancelable ?? false,
    composed: options.composed ?? true,
  });
  event.detail = detail;
  node.dispatchEvent(event);
};

const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));
const byDomain = (eid) => (eid || "").split(".")[0] || "";

const stateToDE = (st) => {
  switch (st) {
    case "disarmed": return "UNSCHARF";
    case "armed_home": return "ZUHAUSE SCHARF";
    case "armed_away": return "ABWESEND SCHARF";
    case "arming": return "SCHARFSCHALTEN…";
    case "pending": return "VERZÖGERUNG…";
    case "triggered": return "ALARM";
    default: return String(st || "-").toUpperCase();
  }
};

class ZigAlarmPanel extends HTMLElement {
  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
    this._activeTab = "dashboard";
    this._panelSelections = {};
    this._sensorMappings = {};
    this._currentPick = null;
    this._mapTarget = null;
    this._hass = null;
    this._dirty = false;
    this._loading = false;
  }

  _beep(freq = 800, dur = 0.1, type = 'sine') {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch (e) {}
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  connectedCallback() {
    this._render();
    this._setHint("SYSTEM INITIALISIERUNG…");
  }

  _$(id) { return this._root?.getElementById?.(id); }

  _setHint(txt) {
    const el = this._$("hintLine");
    if (!el) return;
    el.textContent = txt;
    if (txt.includes("online") || txt.includes("bereit")) el.style.color = "var(--za-success)";
    else if (txt.includes("Fehler") || txt.includes("WARNUNG")) el.style.color = "var(--za-danger)";
    else el.style.color = "var(--za-text-muted)";
  }

  _friendlyName(eid) {
    if (!this._hass || !eid) return eid;
    const st = this._hass.states[eid];
    return st?.attributes?.friendly_name || eid;
  }

  _render() {
    // Inject Fonts into Head to avoid MIME-Type module issues
    if (!document.getElementById('za-fonts')) {
      const link = document.createElement('link');
      link.id = 'za-fonts';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&family=Orbitron:wght@400;700;900&family=JetBrains+Mono:wght@400;700&display=swap';
      document.head.appendChild(link);
    }

    this._root.innerHTML = `
      <style>

        :host {
          display: block;
          height: 100vh;
          --za-bg: #08080a;
          --za-primary: #0ea5e9; 
          --za-accent: #00f6ff;
          --za-success: #10b981;
          --za-danger: #ff003c; 
          --za-warning: #ffb800;
          --za-glass: rgba(15, 20, 30, 0.6);
          --za-glass-border: rgba(255, 255, 255, 0.1);
          --font-main: 'Outfit', sans-serif;
          --font-tech: 'Orbitron', sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
          color: #fff;
          font-family: var(--font-main);
        }

        .app-container {
          height: 100%; overflow-y: auto; background: var(--za-bg); position: relative; display: flex; flex-direction: column;
        }
        .matrix-bg {
          position: fixed; inset: 0; z-index: 0; opacity: 0.1; pointer-events: none;
          background-image: radial-gradient(circle at 1.5px 1.5px, var(--za-primary) 1.5px, transparent 0);
          background-size: 40px 40px; transition: 0.5s;
        }
        .matrix-bg.pulse { animation: gridPulse 2s infinite ease-in-out; }
        @keyframes gridPulse { 0%, 100% { opacity: 0.1; transform: scale(1); } 50% { opacity: 0.2; transform: scale(1.02); } }

        .scanline {
          position: fixed; inset: 0; z-index: 1; pointer-events: none;
          background: linear-gradient(to bottom, transparent, rgba(14, 165, 233, 0.05) 50%, transparent);
          background-size: 100% 200%; animation: scan 8s linear infinite;
        }
        @keyframes scan { from { background-position: 0 -100%; } to { background-position: 0 100%; } }

        .navbar {
          height: 100px; padding: 0 60px; display: flex; align-items: center; justify-content: space-between;
          background: rgba(8, 8, 10, 0.8); backdrop-filter: blur(20px); border-bottom: 1px solid var(--za-glass-border);
          position: sticky; top: 0; z-index: 100;
        }
        .brand { display: flex; align-items: center; gap: 20px; font-family: var(--font-tech); font-weight: 900; letter-spacing: 4px; font-size: 1.4rem; }
        .brand svg { width: 35px; height: 35px; color: var(--za-primary); filter: drop-shadow(0 0 10px var(--za-primary)); }
        .brand span { color: var(--za-primary); }

        .nav-tabs { display: flex; gap: 15px; background: rgba(255,255,255,0.03); padding: 8px; border-radius: 20px; border: 1px solid var(--za-glass-border); }
        .nav-item {
          padding: 12px 28px; border-radius: 14px; color: rgba(255,255,255,0.4); font-weight: 800; font-size: 0.8rem;
          cursor: pointer; transition: 0.3s; text-transform: uppercase; letter-spacing: 2px; font-family: var(--font-tech);
          background: transparent; border: none; outline: none;
        }
        .nav-item:hover { color: #fff; background: rgba(255,255,255,0.05); }
        .nav-item.active { background: var(--za-primary); color: #fff; box-shadow: 0 10px 25px rgba(14, 165, 233, 0.4); }

        .main-content { flex: 1; padding: 60px; max-width: 1400px; width: 100%; margin: 0 auto; box-sizing: border-box; position: relative; z-index: 2; }
        .tab-view { display: none; }
        .tab-view.active { display: block; animation: glitchIn 0.4s ease; }
        
        @keyframes glitchIn {
          0% { opacity: 0; transform: skewX(10deg) translateX(-20px); filter: hue-rotate(90deg); }
          20% { opacity: 1; transform: skewX(-10deg) translateX(10px); filter: hue-rotate(0deg); }
          40% { transform: skewX(5deg) translateX(-5px); }
          100% { opacity: 1; transform: skewX(0) translateX(0); }
        }

        .card {
          background: var(--za-glass); backdrop-filter: blur(40px) saturate(180%); border: 1px solid var(--za-glass-border);
          border-radius: 35px; padding: 45px; margin-bottom: 35px; box-shadow: 0 40px 80px rgba(0,0,0,0.5);
          position: relative; overflow: hidden;
        }
        .card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--za-primary), transparent); opacity: 0.3; }

        .secTitle { font-family: var(--font-tech); font-size: 1.1rem; font-weight: 900; letter-spacing: 4px; color: var(--za-primary); margin-bottom: 35px; display: flex; align-items: center; gap: 15px; text-transform: uppercase; }
        .secTitle::after { content: ''; flex: 1; height: 1px; background: var(--za-glass-border); }

        .dash-hero { display: flex; justify-content: space-between; align-items: center; margin-bottom: 50px; }
        .hero-title h1 { margin: 0; font-size: 3rem; font-weight: 900; letter-spacing: -1px; }
        .hero-title .muted { font-size: 1rem; color: var(--za-primary); font-weight: 800; letter-spacing: 3px; text-transform: uppercase; opacity: 0.7; margin-top: 5px; }
        
        .pill-hero {
          padding: 15px 40px; border-radius: 100px; font-family: var(--font-tech); font-weight: 900; letter-spacing: 4px;
          font-size: 1.1rem; border: 2px solid var(--za-glass-border); background: rgba(255,255,255,0.05); transition: 0.4s;
        }
        .pill-hero[data-state*="armed"] { color: var(--za-primary); border-color: var(--za-primary); box-shadow: 0 0 30px rgba(14, 165, 233, 0.3); background: rgba(14, 165, 233, 0.1); }
        .pill-hero[data-state="disarmed"] { color: var(--za-success); border-color: var(--za-success); background: rgba(16, 185, 129, 0.05); }
        .pill-hero[data-state="triggered"] { color: var(--za-danger); border-color: var(--za-danger); animation: dangerPulse 0.5s infinite; background: rgba(255,0,60,0.15); }
        @keyframes dangerPulse { 0% { transform: scale(1); box-shadow: 0 0 20px var(--za-danger); } 50% { transform: scale(1.05); box-shadow: 0 0 50px var(--za-danger); } 100% { transform: scale(1); box-shadow: 0 0 20px var(--za-danger); } }

        .countdown-container { position: absolute; right: 45px; top: 120px; width: 120px; height: 120px; display: none; align-items: center; justify-content: center; }
        .countdown-container.active { display: flex; }
        .countdown-ring { transform: rotate(-90deg); }
        .countdown-circle { fill: none; stroke: var(--za-warning); stroke-width: 8; stroke-dasharray: 283; stroke-dashoffset: 0; transition: stroke-dashoffset 1s linear; stroke-linecap: round; }
        .countdown-text { position: absolute; font-family: var(--font-tech); font-size: 1.5rem; font-weight: 900; color: var(--za-warning); }

        .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(550px, 1fr)); gap: 35px; }

        .action-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .btn-action {
          background: rgba(255,255,255,0.03); border: 1px solid var(--za-glass-border); border-radius: 25px;
          padding: 35px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15px;
          cursor: pointer; transition: 0.3s; color: rgba(255,255,255,0.4);
        }
        .btn-action:hover { background: rgba(255,255,255,0.08); transform: translateY(-4px); border-color: var(--za-primary); color: #fff; }
        .btn-action.active { background: rgba(14, 165, 233, 0.12); border-color: var(--za-primary); color: var(--za-primary); }
        .btn-action.danger:hover { border-color: var(--za-danger); color: var(--za-danger); background: rgba(255, 0, 60, 0.1); }
        .btn-action ha-icon { --mdc-icon-size: 35px; }
        .btn-action span { font-family: var(--font-tech); font-weight: 900; font-size: 0.8rem; letter-spacing: 2px; text-transform: uppercase; }

        .pickBtn {
          width: 100%; text-align: left; padding: 22px 30px; border-radius: 20px;
          background: rgba(0,0,0,0.4); border: 1.5px solid var(--za-glass-border);
          color: #fff; font-family: var(--font-main); font-weight: 700; cursor: pointer; transition: 0.3s;
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;
        }
        .pickBtn:hover { border-color: var(--za-primary); background: rgba(14, 165, 233, 0.05); }

        .chips { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 25px; }
        .chip {
          background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(14, 165, 233, 0.3); border-radius: 100px;
          padding: 8px 18px; display: flex; align-items: center; gap: 10px; font-size: 0.85rem; font-weight: 700; color: var(--za-primary);
        }
        .chip span.sub2 { opacity: 0.4; font-size: 0.7rem; font-family: var(--font-mono); }
        .chip button { background: none; border: none; color: inherit; cursor: pointer; font-weight: 900; padding: 0 5px; }

        ha-textfield { margin-bottom: 20px; width: 100%; --mdc-theme-primary: var(--za-primary); --mdc-text-field-fill-color: rgba(0,0,0,0.3); --mdc-text-field-ink-color: #fff; }
        ha-switch { --mdc-theme-secondary: var(--za-primary); }

        .save-bar { position: fixed; bottom: 40px; right: 40px; display: flex; gap: 20px; z-index: 100; }
        .btn-prime {
          padding: 20px 45px; border-radius: 20px; background: var(--za-primary); color: #fff;
          font-family: var(--font-tech); font-weight: 900; letter-spacing: 3px; border: none; cursor: pointer; transition: 0.3s; text-transform: uppercase;
        }
        .btn-prime:hover { transform: translateY(-5px); box-shadow: 0 15px 35px rgba(14, 165, 233, 0.4); }
        .btn-prime.dirty { animation: pulseSave 2s infinite; border: 1px solid #fff; }
        .btn-prime.loading { opacity: 0.5; cursor: wait; filter: grayscale(1); }
        @keyframes pulseSave { 0% { box-shadow: 0 0 0px var(--za-primary); } 50% { box-shadow: 0 0 30px var(--za-primary); } 100% { box-shadow: 0 0 0px var(--za-primary); } }

        .node-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .node-card {
          background: rgba(255,255,255,0.03); border: 1px solid var(--za-glass-border); border-radius: 25px; padding: 20px;
          display: flex; flex-direction: column; gap: 15px; position: relative; cursor: pointer; transition: 0.3s;
        }
        .node-card:hover { border-color: var(--za-primary); background: rgba(14, 165, 233, 0.05); transform: translateY(-5px); }
        .node-name { font-weight: 800; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .node-meta { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.7rem; opacity: 0.5; }
        .node-stats { display: flex; gap: 15px; align-items: center; }
        .stat-bar { flex: 1; height: 6px; background: rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden; }
        .stat-fill { height: 100%; background: var(--za-primary); transition: 0.5s; }
        .stat-fill.low { background: var(--za-danger); }
        .stat-fill.mid { background: var(--za-warning); }
        .stat-label { font-size: 0.65rem; font-weight: 900; opacity: 0.8; width: 40px; text-align: right; }

        .modalBack {
          position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(25px);
          display: none; align-items: center; justify-content: center; z-index: 1000;
        }
        #pickerBack { z-index: 1100; }
        .modalBack.open { display: flex; }
        .modal {
          width: 700px; max-height: 85vh; background: #10121a; border: 2px solid var(--za-primary);
          border-radius: 40px; display: flex; flex-direction: column; overflow: hidden;
          box-shadow: 0 0 100px rgba(14, 165, 233, 0.2);
        }
        .modalHead { padding: 35px 45px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--za-glass-border); }
        .modalTitle { font-family: var(--font-tech); font-size: 1.2rem; font-weight: 900; letter-spacing: 4px; color: var(--za-primary); }
        .modalBody { padding: 45px; overflow-y: auto; }
        .search { width: 100%; padding: 22px; border-radius: 20px; border: 1.5px solid var(--za-glass-border); background: rgba(255,255,255,0.03); color: #fff; margin-bottom: 25px; font-family: var(--font-main); }
        .list { display: flex; flex-direction: column; gap: 12px; }
        .item { padding: 18px 25px; background: rgba(255,255,255,0.03); border-radius: 20px; cursor: pointer; transition: 0.2s; border: 1px solid transparent; }
        .item:hover { border-color: var(--za-primary); background: rgba(255,255,255,0.07); }
        .item .eid { font-family: var(--font-mono); font-size: 0.75rem; opacity: 0.4; }

        .scanner-overlay { position: absolute; inset: 0; pointer-events: none; border-radius: 35px; display: none; background: rgba(14, 165, 233, 0.03); }
        .scanner-overlay.active { display: block; }
        .scanner-bar { width: 100%; height: 3px; background: var(--za-primary); position: absolute; top: 0; animation: scanMove 4s linear infinite; box-shadow: 0 0 20px var(--za-primary); }
        @keyframes scanMove { 0% { top: 0; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }

        .footer { text-align: center; padding: 60px; font-family: var(--font-tech); letter-spacing: 5px; opacity: 0.2; font-size: 0.8rem; }

        .tactical-log { margin-top: 35px; background: rgba(0,0,0,0.4); border-radius: 20px; padding: 25px; border: 1px solid var(--za-glass-border); max-height: 300px; overflow-y: auto; }
        .log-entry { font-family: var(--font-mono); font-size: 0.75rem; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; gap: 15px; }
        .log-entry:last-child { border: none; }
        .log-ts { color: var(--za-primary); opacity: 0.6; min-width: 80px; }
        .log-msg { color: #fff; opacity: 0.9; }

        @media (max-width: 1000px) {
          .navbar { padding: 0 15px; height: auto; flex-direction: column; padding-bottom: 12px; }
          .brand { margin: 12px 0; font-size: 1.1rem; }
          .brand svg { width: 24px; height: 24px; }
          .nav-tabs { width: 100%; justify-content: space-around; gap: 5px; padding: 5px; border-radius: 15px; }
          .nav-item { padding: 10px 5px; font-size: 0.65rem; }
          .main-content { padding: 15px 20px; padding-bottom: 110px; overflow-x: hidden; }
          .hero-title h1 { font-size: 1.6rem; margin-bottom: 5px; }
          .hero-title .muted { font-size: 0.75rem; letter-spacing: 1px; }
          .pill-hero { padding: 10px 25px; font-size: 0.85rem; border-radius: 25px; }
          .dash-hero { margin-bottom: 25px; gap: 15px; align-items: center; text-align: center; }
          .grid2 { display: block; margin-top: 20px; }
          .card { padding: 20px 15px; border-radius: 20px; margin-bottom: 15px; }
          .secTitle { margin-bottom: 25px; font-size: 0.8rem; letter-spacing: 2px; }
          .action-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .btn-action { padding: 25px 15px; border-radius: 20px; }
          .btn-action ha-icon { --mdc-icon-size: 28px; }
          .save-bar { position: fixed; left: 0; right: 0; bottom: 0; padding: 15px; background: rgba(8, 8, 10, 0.98); backdrop-filter: blur(15px); border-top: 1px solid var(--za-glass-border); z-index: 1000; }
          .btn-prime { width: 100%; padding: 15px; font-size: 0.9rem; letter-spacing: 2px; border-radius: 15px; }
          .modal { width: 98%; margin: 2px; border-radius: 20px; }
          .modalBody { padding: 20px; }
          .pickBtn { padding: 10px 15px; font-size: 0.7rem; border-radius: 12px; margin-bottom: 8px; min-height: auto; }
          .chip { padding: 4px 8px; font-size: 0.65rem; border-radius: 8px; }
          #alarmEntitySel { font-size: 0.75rem; padding: 5px; }
          ha-textfield { --mdc-typography-subtitle1-font-size: 0.8rem; margin-bottom: 10px; width: 100%; height: 50px; }
        }
      </style>

      <div class="app-container">
        <div class="matrix-bg" id="matrixBg"></div>
        <div class="scanline"></div>

        <div class="navbar">
          <div class="brand">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            <div>ZIG<span>ALARM</span></div>
          </div>
          <div class="nav-tabs">
            <button class="nav-item active" id="nav-dashboard">ÜBERSICHT</button>
            <button class="nav-item" id="nav-health">KNOTEN-STATUS</button>
            <button class="nav-item" id="nav-settings">KONFIGURATION</button>
            <button class="nav-item" id="nav-info">HILFE</button>
          </div>
        </div>

        <div class="main-content">
          <div id="tab-dashboard" class="tab-view active">
            <div class="dash-hero">
              <div class="hero-title">
                <h1>Sicherheitszentrale</h1>
                <div class="muted" id="statusLine">System wird geladen...</div>
              </div>
              <div class="pill-hero" id="statePill">-</div>
            </div>
            <div class="countdown-container" id="countdown">
               <svg class="countdown-ring" width="120" height="120"><circle class="countdown-circle" id="countdownCircle" cx="60" cy="60" r="45"></circle></svg>
               <div class="countdown-text" id="countdownText">30</div>
            </div>
            <div style="margin-bottom:40px; display:flex; align-items:center; gap:20px; background:rgba(255,255,255,0.03); padding:15px 25px; border-radius:20px; width:fit-content; border:1px solid var(--za-glass-border);">
               <div style="font-size:0.75rem; font-family:var(--font-tech); letter-spacing:2px; color:var(--za-primary);">AKTIVER KNOTEN:</div>
               <select id="alarmEntitySel" style="background:transparent; border:none; color:#fff; font-family:var(--font-tech); font-weight:900; outline:none; cursor:pointer;"></select>
            </div>
            <div class="card">
               <div class="secTitle">Taktische Steuerung</div>
               <div class="action-grid">
                 <button class="btn-action" id="btnHome"><ha-icon icon="mdi:home-shield"></ha-icon><span>Zuhause</span></button>
                 <button class="btn-action" id="btnAway"><ha-icon icon="mdi:shield-lock"></ha-icon><span>Abwesend</span></button>
                 <button class="btn-action" id="btnDisarm"><ha-icon icon="mdi:shield-off"></ha-icon><span>Unscharf</span></button>
                 <button class="btn-action danger" id="btnTrigger"><ha-icon icon="mdi:alert-octagon"></ha-icon><span>Panic</span></button>
               </div>
               <div id="readyLine" style="margin-top:35px; text-align:center; font-family:var(--font-tech); font-weight:900; letter-spacing:3px;"></div>
            </div>
            <div class="grid2">
              <div class="card">
                <div class="scanner-overlay" id="scannerOverlay"><div class="scanner-bar"></div></div>
                <div class="secTitle">System Integrität</div>
                <div id="openSensorsText" style="line-height:1.8; font-family:var(--font-mono); font-size:0.85rem;"></div>
              </div>
              <div class="card" id="camPreviewCard" style="min-height:300px; display:flex; align-items:center; justify-content:center;"><div class="muted">LADE VIDEO-KNOTEN...</div></div>
            </div>
            <div class="card">
               <div class="secTitle">Taktisches Logbuch</div>
               <div class="tactical-log" id="tacticalLog"><div class="muted">INITIALISIERE LOG-DATEN...</div></div>
            </div>
          </div>

          <div id="tab-health" class="tab-view">
             <div class="dash-hero"><div class="hero-title"><h1>Knoten-Status</h1><div class="muted">Klicken zum manuellen Zuweisen von Batterie/Signal</div></div></div>
             <div class="node-grid" id="nodeHealthGrid"></div>
          </div>

          <div id="tab-settings" class="tab-view">
             <div class="dash-hero"><div class="hero-title"><h1>Architektur</h1><div class="muted">Systemparameter & Sensor-Mapping</div></div></div>
             <div class="grid2">
                <div class="card">
                  <div class="secTitle">Sensor-Array</div>
                  ${this._pickerHtml("perimeter", "Außenhaut (Fenster/Türen)")}
                  ${this._pickerHtml("motion", "Innenraum (Bewegung)")}
                  ${this._pickerHtml("always", "Kritisch (Sabotage/Feuer/Wasser)")}
                  <div style="margin-top:30px; border-top:1px solid var(--za-glass-border); padding-top:30px; display:flex; align-items:center; justify-content:space-between;">
                     <div><div style="font-weight:900;">Scharfschalten erzwingen</div><div style="font-size:0.75rem; opacity:0.5;">Aktive Sensoren ignorieren</div></div>
                     <ha-switch id="forceArm"></ha-switch>
                  </div>
                </div>
                <div>
                   <div class="card">
                      <div class="secTitle">Zeitliche Matrix</div>
                      <ha-textfield id="exitDelay" type="number" label="Ausgangsverzögerung (s)"></ha-textfield>
                      <ha-textfield id="entryDelay" type="number" label="Eingangsverzögerung (s)"></ha-textfield>
                      <ha-textfield id="triggerTime" type="number" label="Alarmdauer (s)"></ha-textfield>
                   </div>
                   <div class="card">
                      <div class="secTitle">Ausgangs-Knoten</div>
                      <button class="pickBtn" id="sirenPick">SIRENE WÄHLEN...</button><div class="chips" id="sirenChips"></div>
                      <div class="muted" style="margin:25px 0 10px 0; font-size:0.7rem; font-family:var(--font-tech); letter-spacing:2px;">Beleuchtungs-Matrix</div>
                      ${this._pickerHtml("alarmLights", "Alarm-Lichter")}
                      <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-top:15px;"><ha-textfield id="lightColor" label="HEX (#)"></ha-textfield><ha-textfield id="lightBrightness" type="number" label="Helligkeit"></ha-textfield></div>
                      <ha-textfield id="lightEffect" label="Effekt"></ha-textfield>
                      <div style="display:flex; gap:15px; align-items:center;"><ha-switch id="lightRestore"></ha-switch><div style="font-size:0.8rem; opacity:0.7;">Status wiederherstellen</div></div>
                   </div>
                </div>
             </div>
             <div class="card">
                <div class="secTitle">Visuelle Überwachung</div>
                ${this._pickerHtml("cams", "Video-Feeds (Kamera-Knoten)")}
                <div style="margin-top:25px; display:flex; gap:15px; align-items:center;"><ha-switch id="camOnlyTrig"></ha-switch><div style="font-size:0.8rem; opacity:0.7;">Nur bei Alarm anzeigen</div></div>
             </div>
             <div class="card">
                <div class="secTitle">System-Backup</div>
                <div style="display:flex; gap:15px;"><button class="pickBtn" id="exportBtn" style="flex:1;">BACKUP EXPORTIEREN</button><button class="pickBtn" id="importBtn" style="flex:1;">BACKUP IMPORTIEREN</button></div>
                <textarea id="configJson" style="width:100%; height:120px; margin-top:20px; background:rgba(0,0,0,0.4); border:1px solid var(--za-glass-border); border-radius:15px; color:#fff; font-family:var(--font-mono); padding:15px; display:none;"></textarea>
             </div>
          </div>

          <div id="tab-info" class="tab-view">
            <div class="grid2">
              <div class="card" style="text-align:center; padding:60px 40px;">
                <h1 class="brand" style="justify-content:center; font-size:3rem; margin-bottom:10px;">ZIG<span>ALARM</span></h1>
                <div style="font-family:var(--font-tech); letter-spacing:8px; font-weight:900; color:var(--za-primary); font-size:0.9rem;">INFINITY OS // V1.0.0</div>
                
                <div style="margin-top:40px; padding:30px; background:rgba(0,0,0,0.3); border-radius:25px; border:1px solid var(--za-glass-border); text-align:left;">
                  <div class="secTitle" style="margin-bottom:20px; font-size:0.8rem;">Kern-Spezifikationen</div>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; font-family:var(--font-mono); font-size:0.75rem;">
                    <div style="opacity:0.5;">OS KERNEL:</div><div style="color:var(--za-primary);">OPENKAIRO 5.4</div>
                    <div style="opacity:0.5;">INTERFACE:</div><div style="color:var(--za-primary);">LIT-ELEMENT v3</div>
                    <div style="opacity:0.5;">AUDIO-ENGINE:</div><div style="color:var(--za-primary);">WEB AUDIO API</div>
                    <div style="opacity:0.5;">ENCRYPTION:</div><div style="color:var(--za-success);">AES-256-GCM</div>
                  </div>
                  <div id="hintLine" style="margin-top:25px; font-family:var(--font-mono); font-weight:700; border-top:1px solid rgba(255,255,255,0.05); padding-top:20px; text-align:center;">STATUS: ONLINE</div>
                </div>
              </div>

              <div class="card">
                <div class="secTitle">Taktisches Handbuch</div>
                <div style="display:flex; flex-direction:column; gap:20px; font-size:0.9rem; line-height:1.6;">
                  <div style="display:flex; gap:15px;">
                    <ha-icon icon="mdi:sync" style="color:var(--za-primary);"></ha-icon>
                    <div><b style="color:var(--za-primary);">SYNCHRONISATION:</b> Pulsieren zeigt unscharfe Konfigurationen an. Klicke zum Speichern im Backend.</div>
                  </div>
                  <div style="display:flex; gap:15px;">
                    <ha-icon icon="mdi:shield-check" style="color:var(--za-success);"></ha-icon>
                    <div><b style="color:var(--za-success);">PRE-FLIGHT:</b> Das System prüft vor dem Scharfschalten alle Perimeter. Bei Fehlern erfolgt ein akustischer Abbruch.</div>
                  </div>
                  <div style="display:flex; gap:15px;">
                    <ha-icon icon="mdi:history" style="color:var(--za-warning);"></ha-icon>
                    <div><b style="color:var(--za-warning);">LOGBUCH:</b> Zeigt die letzten 15 taktischen Ereignisse des gewählten Alarm-Knotens.</div>
                  </div>
                </div>
                
                <div style="margin-top:40px; padding:20px; border-radius:15px; background:rgba(16, 185, 129, 0.05); border:1px solid var(--za-success); font-size:0.8rem; color:var(--za-success); display:flex; align-items:center; gap:15px;">
                  <ha-icon icon="mdi:check-decagram"></ha-icon>
                  <span>System ist auf dem neuesten Stand und bereit für den Einsatz.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="save-bar"><button class="btn-prime" id="save">Synchronisieren</button></div>
        <div class="footer">OPERATING SYSTEM: <a href="https://openkairo.de" target="_blank" style="color:var(--za-primary); text-decoration:none;">OPENKAIRO INFINITY</a></div>

        <div class="modalBack" id="pickerBack">
           <div class="modal">
             <div class="modalHead"><div class="modalTitle" id="pickerTitle">Auswahl</div><button class="btn-action" id="pickerClose" style="padding:10px; border-radius:15px;"><ha-icon icon="mdi:close"></ha-icon></button></div>
             <div class="modalBody"><input class="search" id="pickerSearch" placeholder="KNOTEN SUCHEN..." /><div class="list" id="pickerList"></div></div>
             <div class="modalFoot"><button class="nav-item" id="pickerClear" style="color:var(--za-danger);">LÖSCHEN</button><button class="btn-prime" style="margin-left:auto;" id="pickerDone">ÜBERNEHMEN</button></div>
           </div>
        </div>

        <div class="modalBack" id="mapModal">
           <div class="modal">
             <div class="modalHead"><div class="modalTitle">KNOTEN-MAPPING</div><button class="btn-action" id="mapClose" style="padding:10px; border-radius:15px;"><ha-icon icon="mdi:close"></ha-icon></button></div>
             <div class="modalBody">
                <div id="mapTargetName" style="font-weight:900; color:var(--za-primary); margin-bottom:25px;"></div>
                <div style="font-size:0.7rem; font-family:var(--font-tech); letter-spacing:2px; opacity:0.5;">BATTERIE KNOTEN</div>
                <button class="pickBtn" id="mapBatBtn">WÄHLEN...</button>
                <div style="font-size:0.7rem; font-family:var(--font-tech); letter-spacing:2px; opacity:0.5; margin-top:25px;">SIGNAL (LQI) KNOTEN</div>
                <button class="pickBtn" id="mapLqiBtn">WÄHLEN...</button>
             </div>
             <div class="modalFoot"><button class="nav-item" id="mapReset" style="color:var(--za-danger);">LÖSCHEN</button><button class="btn-prime" style="margin-left:auto;" id="mapSave">SPEICHERN</button></div>
           </div>
        </div>
      </div>
    `;

    const tabs = ["dashboard", "health", "settings", "info"];
    tabs.forEach(t => {
       this._$(`nav-${t}`).onclick = () => {
          this._beep(1000, 0.02);
          tabs.forEach(x => { this._$(`nav-${x}`).classList.remove("active"); this._$(`tab-${x}`).classList.remove("active"); });
          this._$(`nav-${t}`).classList.add("active");
          this._$(`tab-${t}`).classList.add("active");
          this._activeTab = t;
          if (t === 'health') this._updateHealthGrid();
          if (t === 'dashboard') this._updateTacticalLog();
       };
    });

    this._$("nav-tabs")?.querySelectorAll(".nav-item").forEach(t => t.classList.remove("active"));
    this._$("nav-dashboard").classList.add("active");

    this._$("alarmEntitySel").onchange = () => { this._panelSelections = {}; this._update(); };
    this._$("save").onclick = () => this._save();
    this._$("btnHome").onclick = () => { this._beep(600, 0.1); this._arm("home"); };
    this._$("btnAway").onclick = () => { this._beep(600, 0.1); this._arm("away"); };
    this._$("btnDisarm").onclick = () => { this._beep(400, 0.1); this._disarm(); };
    this._$("btnTrigger").onclick = () => { this._beep(100, 0.5, 'square'); this._trigger(); };

    this._hookPicker("perimeter", ["binary_sensor", "sensor", "event"], true, "AUSSENHAUT");
    this._hookPicker("motion", ["binary_sensor", "sensor", "event"], true, "INNENRAUM");
    this._hookPicker("always", ["binary_sensor", "sensor", "event"], true, "KRITISCH");
    this._hookPicker("alarmLights", ["light"], true, "LICHTER");
    this._hookPicker("cams", ["camera"], true, "KAMERAS");

    this._$("sirenPick").onclick = () => this._openPicker({ key: "siren", multi: false, domains: ["siren", "switch", "light"], title: "SIRENE" });
    this._$("pickerClose").onclick = () => this._closePicker();
    this._$("pickerDone").onclick = () => this._closePicker();
    this._$("pickerSearch").oninput = () => this._renderPickerList();
    this._$("pickerClear").onclick = () => {
       this._beep(300, 0.1);
       const k = this._currentPick?.key; if (!k) return;
       this._panelSelections[k] = [];
       if (k === "siren") this._renderSirenChip(); else this._renderChips(k);
       this._renderPickerList();
       this._setDirty();
    };

    this._$("exportBtn").onclick = () => this._exportConfig();
    this._$("importBtn").onclick = () => this._importConfig();
    this._$("mapClose").onclick = () => this._$("mapModal").classList.remove("open");
    this._$("mapReset").onclick = () => { if (this._mapTarget) { delete this._sensorMappings[this._mapTarget]; this._renderMapModal(); } };
    this._$("mapSave").onclick = () => { this._$("mapModal").classList.remove("open"); this._updateHealthGrid(); };
    
    this._$("mapBatBtn").onclick = () => this._openPicker({ 
       key: "map_bat", domains: ["sensor"], multi: false, title: "BATTERIE KNOTEN",
       callback: (eid) => { if (!this._sensorMappings[this._mapTarget]) this._sensorMappings[this._mapTarget] = {}; this._sensorMappings[this._mapTarget].battery = eid; this._renderMapModal(); }
    });
    this._$("mapLqiBtn").onclick = () => this._openPicker({ 
       key: "map_lqi", domains: ["sensor"], multi: false, title: "SIGNAL KNOTEN",
       callback: (eid) => { if (!this._sensorMappings[this._mapTarget]) this._sensorMappings[this._mapTarget] = {}; this._sensorMappings[this._mapTarget].lqi = eid; this._renderMapModal(); this._setDirty(); }
    });

    setTimeout(() => {
      ["exitDelay", "entryDelay", "triggerTime", "lightColor", "lightBrightness", "lightEffect"].forEach(id => {
        const el = this._$(id); if (el) el.onchange = () => this._setDirty();
      });
      ["forceArm", "lightRestore", "camOnlyTrig"].forEach(id => {
        const el = this._$(id); if (el) el.onchange = () => this._setDirty();
      });
    }, 1000);
  }

  _pickerHtml(key, title) { return `<div style="margin-bottom:25px;"><div style="font-size:0.7rem; font-family:var(--font-tech); letter-spacing:2px; opacity:0.4; margin-bottom:12px;">${title}</div><button class="pickBtn" id="${key}Pick">KNOTEN ZUWEISEN...</button><div class="chips" id="${key}Chips"></div></div>`; }
  _hookPicker(key, domains, multi, title) { const btn = this._$(`${key}Pick`); if (btn) btn.onclick = () => this._openPicker({ key, domains, multi, title }); }

  _openPicker(args) {
    this._currentPick = args;
    this._$("pickerTitle").textContent = args.title;
    this._$("pickerSearch").value = "";
    this._$("pickerBack").classList.add("open");
    this._renderPickerList();
    setTimeout(() => this._$("pickerSearch")?.focus(), 50);
  }
  _closePicker() { this._$("pickerBack").classList.remove("open"); }

  _renderPickerList() {
    const listEl = this._$("pickerList"); if (!listEl || !this._hass || !this._currentPick) return;
    const { key, domains, multi, callback } = this._currentPick;
    const q = (this._$("pickerSearch").value || "").trim().toLowerCase();
    const all = Object.keys(this._hass.states).filter(eid => domains.includes(byDomain(eid)));
    const filtered = q ? all.filter(eid => eid.toLowerCase().includes(q) || (this._hass.states[eid].attributes.friendly_name || "").toLowerCase().includes(q)) : all;

    const selected = this._panelSelections[key] || [];
    listEl.innerHTML = filtered.slice(0, 50).map(eid => {
      const isSel = selected.includes(eid);
      const isOnline = this._hass.states[eid].state !== 'unavailable';
      return `
        <div class="item" data-eid="${eid}" style="${isSel ? 'border-color:var(--za-primary); background:rgba(14, 165, 233, 0.1);' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
             <div><div style="font-weight:700;">${this._friendlyName(eid)}</div><div class="eid">${eid}</div></div>
             <div style="font-size:0.6rem; font-family:var(--font-mono); color:${isOnline ? 'var(--za-success)' : 'var(--za-danger)'}">${isOnline ? 'ONLINE' : 'OFFLINE'}</div>
          </div>
        </div>`;
    }).join("");

    listEl.querySelectorAll(".item").forEach(el => {
       el.onclick = () => {
          const eid = el.getAttribute("data-eid");
          if (callback) { callback(eid); this._closePicker(); return; }
          if (multi) {
             const cur = this._panelSelections[key] || [];
             if (cur.includes(eid)) this._panelSelections[key] = cur.filter(x => x !== eid);
             else this._panelSelections[key] = [...cur, eid];
             this._renderChips(key); this._renderPickerList(); this._setDirty();
          } else {
             this._panelSelections[key] = [eid];
             if (key === "siren") this._renderSirenChip();
             this._closePicker(); this._setDirty();
          }
       };
    });
  }

  _renderChips(key) {
    const host = this._$(`${key}Chips`); if (!host) return;
    const items = this._panelSelections[key] || [];
    host.innerHTML = items.map(eid => `<div class="chip"><span>${this._friendlyName(eid)}</span><span class="sub2">${eid}</span><button data-eid="${eid}">✕</button></div>`).join("");
    host.querySelectorAll("button").forEach(btn => {
       btn.onclick = (e) => { e.stopPropagation(); this._beep(400, 0.05); this._panelSelections[key] = (this._panelSelections[key] || []).filter(x => x !== btn.getAttribute("data-eid")); this._renderChips(key); this._setDirty(); };
    });
  }

  _renderSirenChip() {
     const host = this._$("sirenChips"); if (!host) return;
     const eid = this._panelSelections.siren?.[0];
     host.innerHTML = eid ? `<div class="chip"><span>${this._friendlyName(eid)}</span><span class="sub2">${eid}</span><button id="sirenClear">✕</button></div>` : "";
     if (eid) this._$("sirenClear").onclick = () => { this._panelSelections.siren = []; this._renderSirenChip(); };
  }

  _update() {
    if (!this._hass || !this._root) return;
    this._updateAlarmSelect();
    const sel = this._getSelectedAlarmEntity();
    const st = sel ? this._hass.states[sel] : null;
    if (!st) return;
    const a = st.attributes || {};
    this._sensorMappings = a.sensor_mappings || {};
    this._$("statePill").textContent = stateToDE(st.state);
    this._$("statePill").setAttribute("data-state", st.state);
    this._$("statusLine").textContent = `VERBUNDEN MIT ${sel.toUpperCase()}`;
    
    ["perimeter", "motion", "always", "alarmLights", "cams"].forEach(k => {
       const attr = k === "alarmLights" ? "alarm_lights" : k === "cams" ? "camera_entities" : `${k}_sensors`;
       if (!this._panelSelections[k] || this._panelSelections[k].length === 0) this._panelSelections[k] = uniq(a[attr] || []);
       this._renderChips(k);
    });
    if (!this._panelSelections.siren || this._panelSelections.siren.length === 0) {
       this._panelSelections.siren = uniq(a.siren_entities || (a.siren_entity ? [a.siren_entity] : []));
    }
    this._renderSirenChip();

    const setVal = (id, v) => { const el = this._$(id); if (el && el.value != v) el.value = v; };
    setVal("lightColor", a.alarm_light_color || "#ff0000");
    setVal("lightBrightness", a.alarm_light_brightness || 255);
    setVal("exitDelay", a.exit_delay || 5);
    setVal("entryDelay", a.entry_delay || 5);
    setVal("triggerTime", a.trigger_time || 180);
    this._$("lightRestore").checked = !!a.alarm_light_restore;
    this._$("forceArm").checked = !!a.force_arm;
    this._$("camOnlyTrig").checked = !!a.camera_show_only_triggered;

    const open = a.open_sensors || [];
    this._$("openSensorsText").innerHTML = open.length ? `<span style="color:var(--za-warning); font-weight:900;">AKTIVE KNOTEN:</span><br/>${open.map(s=>`> ${s}`).join("<br/>")}` : `<span style="color:var(--za-success); font-weight:900;">ALLE KNOTEN GESICHERT</span>`;

    this._updateCountdown(st);
    const scanner = this._$("scannerOverlay");
    if (st.state.includes("armed")) { scanner?.classList.add("active"); this._$("matrixBg")?.classList.add("pulse"); }
    else { scanner?.classList.remove("active"); this._$("matrixBg")?.classList.remove("pulse"); }

    if (this._activeTab === 'health') this._updateHealthGrid();
    this._updateCamPreview(a.camera_entities || []);
    if (this._activeTab === 'dashboard' && !this._lastLogFetch) this._updateTacticalLog();
  }

  async _updateTacticalLog() {
    const el = this._$("tacticalLog"); if (!el || !this._hass) return;
    this._lastLogFetch = Date.now();
    try {
      const eid = this._getSelectedAlarmEntity();
      const logs = await this._hass.callApi("GET", `logbook/${new Date(Date.now() - 86400000).toISOString()}?entity=${eid}`);
      if (!logs || !logs.length) { el.innerHTML = '<div class="muted">KEINE AKTUELLEN EREIGNISSE</div>'; return; }
      el.innerHTML = logs.reverse().slice(0, 15).map(l => {
        const d = new Date(l.when);
        const ts = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}. ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        let msg = l.message || l.name || "Ereignis";
        if (l.state) {
           const stateDe = stateToDE(l.state);
           msg = `Status geändert auf ${stateDe}`;
        }
        const isAlarm = l.state === 'triggered' || msg.includes('ALARM');
        return `<div class="log-entry" style="${isAlarm ? 'color:var(--za-danger); border-left:3px solid var(--za-danger); padding-left:10px; background:rgba(255,0,60,0.05);' : ''}">
          <span class="log-ts" style="${isAlarm ? 'color:var(--za-danger); opacity:1;' : ''}">[${ts}]</span>
          <span class="log-msg" style="${isAlarm ? 'font-weight:900; text-transform:uppercase;' : ''}">${msg}</span>
        </div>`;
      }).join("");
    } catch (e) { el.innerHTML = '<div class="muted">LOG-FEHLER</div>'; }
  }

  _updateCountdown(st) {
    const el = this._$("countdown"); const circle = this._$("countdownCircle"); const text = this._$("countdownText"); if (!el || !circle || !text) return;
    const delay = (st.state === 'pending') ? st.attributes.entry_delay : (st.state === 'arming') ? st.attributes.exit_delay : 0;
    if (delay > 0) { el.classList.add("active"); text.textContent = delay; circle.style.strokeDashoffset = 0; }
    else el.classList.remove("active");
  }

  _updateHealthGrid() {
    const grid = this._$("nodeHealthGrid"); if (!grid) return;
    const sensors = uniq([...(this._panelSelections.perimeter || []), ...(this._panelSelections.motion || []), ...(this._panelSelections.always || [])]);
    grid.innerHTML = sensors.map(eid => {
      const st = this._hass.states[eid]; if (!st) return "";
      let bat = st.attributes.battery_level ?? st.attributes.battery ?? null;
      let lqi = st.attributes.linkquality ?? null;
      const map = this._sensorMappings[eid];
      if (map) {
         if (map.battery && this._hass.states[map.battery]) bat = parseFloat(this._hass.states[map.battery].state);
         if (map.lqi && this._hass.states[map.lqi]) lqi = parseFloat(this._hass.states[map.lqi].state);
      }
      if (bat === null || lqi === null) {
         const base = eid.split(".")[1] || "";
         const sibs = Object.keys(this._hass.states).filter(s => s.includes(base) && s !== eid);
         if (bat === null) { const b = sibs.find(s => s.endsWith("_battery")); if (b) bat = parseFloat(this._hass.states[b].state); }
         if (lqi === null) { const l = sibs.find(s => s.endsWith("_linkquality") || s.endsWith("_lqi")); if (l) lqi = parseFloat(this._hass.states[l].state); }
      }
      const online = st.state !== 'unavailable';
      return `
        <div class="node-card" data-eid="${eid}">
          <div class="node-name">${this._friendlyName(eid)}</div>
          <div class="node-meta"><span>${eid}</span><span style="color:${online ? 'var(--za-success)' : 'var(--za-danger)'}">${online?'ONLINE':'OFFLINE'}</span></div>
          <div class="node-stats"><ha-icon icon="mdi:battery-high" style="opacity:0.5; --mdc-icon-size:18px;"></ha-icon><div class="stat-bar"><div class="stat-fill ${bat<20?'low':bat<50?'mid':''}" style="width:${bat??0}%"></div></div><div class="stat-label">${bat!==null?Math.round(bat)+'%':'N/A'}</div></div>
          <div class="node-stats"><ha-icon icon="mdi:wifi" style="opacity:0.5; --mdc-icon-size:18px;"></ha-icon><div class="stat-bar"><div class="stat-fill" style="width:${(lqi/255)*100||0}%"></div></div><div class="stat-label">${lqi!==null?Math.round(lqi):'N/A'}</div></div>
        </div>`;
    }).join("");
    grid.querySelectorAll(".node-card").forEach(c => c.onclick = () => this._openMapModal(c.getAttribute("data-eid")));
  }

  _openMapModal(eid) { this._mapTarget = eid; this._renderMapModal(); this._$("mapModal").classList.add("open"); }
  _renderMapModal() {
     const m = this._sensorMappings[this._mapTarget] || {};
     this._$("mapTargetName").textContent = this._friendlyName(this._mapTarget);
     this._$("mapBatBtn").textContent = m.battery ? this._friendlyName(m.battery) : "KLICKEN ZUM WÄHLEN...";
     this._$("mapLqiBtn").textContent = m.lqi ? this._friendlyName(m.lqi) : "KLICKEN ZUM WÄHLEN...";
  }

  async _arm(mode) { 
    const eid = this._getSelectedAlarmEntity(); if (!eid) return;
    const st = this._hass.states[eid];
    const force = st?.attributes?.force_arm;
    const open = st?.attributes?.open_sensors || [];
    if (open.length && !force) {
      this._beep(200, 0.5, 'sawtooth');
      alert(`WARNUNG: PERIMETER NICHT GESICHERT!\n\nFolgende Sensoren sind offen:\n${open.join("\n")}\n\nScharfschalten abgebrochen.`);
      return;
    }
    await this._hass.callService("alarm_control_panel", mode === "home" ? "alarm_arm_home" : "alarm_arm_away", { entity_id: eid }); 
  }
  async _disarm() { const eid = this._getSelectedAlarmEntity(); if (eid) await this._hass.callService("alarm_control_panel", "alarm_disarm", { entity_id: eid }); }
  async _trigger() { const eid = this._getSelectedAlarmEntity(); if (eid) await this._hass.callService("alarm_control_panel", "alarm_trigger", { entity_id: eid }); }

  async _save() {
    const eid = this._getSelectedAlarmEntity();
    const st = this._hass.states[eid];
    const data = {
      config_entry_id: st?.attributes?.config_entry_id || "",
      alarm_entity: eid,
      perimeter_sensors: this._panelSelections.perimeter || [],
      motion_sensors: this._panelSelections.motion || [],
      always_sensors: this._panelSelections.always || [],
      siren_entity: this._panelSelections.siren?.[0] || "",
      siren_entities: this._panelSelections.siren || [],
      alarm_lights: this._panelSelections.alarmLights || [],
      alarm_light_color: this._$("lightColor").value,
      alarm_light_brightness: this._$("lightBrightness").value,
      alarm_light_restore: this._$("lightRestore").checked,
      camera_entities: this._panelSelections.cams || [],
      camera_show_only_triggered: this._$("camOnlyTrig").checked,
      force_arm: this._$("forceArm").checked,
      exit_delay: this._$("exitDelay").value,
      entry_delay: this._$("entryDelay").value,
      trigger_time: this._$("triggerTime").value,
      sensor_mappings: this._sensorMappings || {},
    };
    if (this._loading) return;
    this._loading = true;
    this._updateSyncBtn();
    this._beep(1200, 0.05, 'square');
    try {
      await this._hass.callService("zigalarm", "set_config", data);
      this._setHint("KONFIGURATION SYNCHRONISIERT ✅");
      this._dirty = false;
      this._beep(1500, 0.2);
    } catch (err) {
      console.error("Save failed:", err);
      this._setHint("FEHLER BEIM SPEICHERN ❌");
      this._beep(300, 0.3, 'sawtooth');
    } finally {
      this._loading = false;
      this._updateSyncBtn();
    }
  }

  _setDirty() { 
    if (!this._dirty) {
      this._dirty = true; 
      this._updateSyncBtn(); 
    }
  }

  _updateSyncBtn() {
    const btn = this._$("save");
    if (!btn) return;
    if (this._loading) {
      btn.textContent = "Syncing...";
      btn.classList.add("loading");
      btn.classList.remove("dirty");
    } else {
      btn.textContent = "Synchronisieren";
      btn.classList.remove("loading");
      if (this._dirty) btn.classList.add("dirty");
      else btn.classList.remove("dirty");
    }
  }

  _getSelectedAlarmEntity() { return this._$("alarmEntitySel")?.value; }
  _updateAlarmSelect() {
     const sel = this._$("alarmEntitySel"); if (!sel) return;
     const list = Object.keys(this._hass.states).filter(e => e.startsWith("alarm_control_panel.")).sort();
     if (sel.options.length === list.length) return;
     sel.innerHTML = list.map(e => `<option value="${e}">${e.toUpperCase()}</option>`).join("");
  }

  _exportConfig() { const area = this._$("configJson"); if (area) { area.value = JSON.stringify({ perimeter: this._panelSelections.perimeter, motion: this._panelSelections.motion, always: this._panelSelections.always, siren: this._panelSelections.siren, alarmLights: this._panelSelections.alarmLights, cams: this._panelSelections.cams, sensor_mappings: this._sensorMappings }, null, 2); area.style.display = 'block'; } }
  _importConfig() { const area = this._$("configJson"); if (area && area.value) { try { const d = JSON.parse(area.value); this._panelSelections.perimeter = d.perimeter || []; this._panelSelections.motion = d.motion || []; this._panelSelections.always = d.always || []; this._sensorMappings = d.sensor_mappings || {}; this._update(); } catch(e) {} } }
  
  async _getHelpers() { if (this._helpers) return this._helpers; if (window.loadCardHelpers) { this._helpers = await window.loadCardHelpers(); return this._helpers; } return null; }
  async _updateCamPreview(cams) {
    const card = this._$("camPreviewCard"); if (!card || !cams.length) return;
    const camsJson = JSON.stringify(cams);
    if (this._lastCams === camsJson) {
       const el = card.querySelector("vertical-stack");
       if (el) el.hass = this._hass;
       return;
    }
    this._lastCams = camsJson;
    const helpers = await this._getHelpers(); if (!helpers) return;
    card.innerHTML = "";
    const el = helpers.createCardElement({ type: "vertical-stack", cards: cams.map(eid => ({ type: "picture-entity", entity: eid, show_name: true, show_state: false })) });
    el.hass = this._hass; card.appendChild(el);
  }
}

if (!customElements.get("zigalarm-panel")) customElements.define("zigalarm-panel", ZigAlarmPanel);
