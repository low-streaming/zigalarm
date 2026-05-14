/**
 * ZigAlarm Infinity Panel V2.3
 * Premium Security Management Interface
 * Deutsche Version // Infinity Edition // Backup Tool
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
  set hass(hass) {
    this._hass = hass;
    if (!this._root) this._render();
    this._update();
  }

  connectedCallback() {
    if (!this._root) this._render();
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
    const st = this._hass?.states?.[eid];
    return st?.attributes?.friendly_name || eid;
  }

  _render() {
    this._root = this.attachShadow({ mode: "open" });
    this._activeTab = "dashboard";

    this._root.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&family=Orbitron:wght@400;700;900&family=JetBrains+Mono:wght@400;700&display=swap');

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

        /* Tactical Background */
        .app-container {
          height: 100%;
          overflow-y: auto;
          background: var(--za-bg);
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .matrix-bg {
          position: fixed; inset: 0; z-index: 0; opacity: 0.1; pointer-events: none;
          background-image: radial-gradient(circle at 1.5px 1.5px, var(--za-primary) 1.5px, transparent 0);
          background-size: 40px 40px;
          transition: 0.5s;
        }
        .matrix-bg.pulse { animation: gridPulse 2s infinite ease-in-out; }
        @keyframes gridPulse { 0%, 100% { opacity: 0.1; transform: scale(1); } 50% { opacity: 0.2; transform: scale(1.02); } }

        .scanline {
          position: fixed; inset: 0; z-index: 1; pointer-events: none;
          background: linear-gradient(to bottom, transparent, rgba(14, 165, 233, 0.05) 50%, transparent);
          background-size: 100% 200%; animation: scan 8s linear infinite;
        }
        @keyframes scan { from { background-position: 0 -100%; } to { background-position: 0 100%; } }

        /* Navbar */
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

        /* Main */
        .main-content { flex: 1; padding: 60px; max-width: 1400px; width: 100%; margin: 0 auto; box-sizing: border-box; position: relative; z-index: 2; }
        .tab-view { display: none; }
        .tab-view.active { display: block; animation: glitchIn 0.4s ease; }
        
        @keyframes glitchIn {
          0% { opacity: 0; transform: skewX(10deg) translateX(-20px); filter: hue-rotate(90deg); }
          20% { opacity: 1; transform: skewX(-10deg) translateX(10px); filter: hue-rotate(0deg); }
          40% { transform: skewX(5deg) translateX(-5px); }
          60% { transform: skewX(-2deg) translateX(2px); }
          100% { opacity: 1; transform: skewX(0) translateX(0); }
        }

        /* Infinity Cards */
        .card {
          background: var(--za-glass); backdrop-filter: blur(40px) saturate(180%); border: 1px solid var(--za-glass-border);
          border-radius: 35px; padding: 45px; margin-bottom: 35px; box-shadow: 0 40px 80px rgba(0,0,0,0.5);
          position: relative; overflow: hidden;
        }
        .card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--za-primary), transparent); opacity: 0.3; }

        .secTitle { font-family: var(--font-tech); font-size: 1.1rem; font-weight: 900; letter-spacing: 4px; color: var(--za-primary); margin-bottom: 35px; display: flex; align-items: center; gap: 15px; text-transform: uppercase; }
        .secTitle::after { content: ''; flex: 1; height: 1px; background: var(--za-glass-border); }

        /* Hero */
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

        /* Countdown */
        .countdown-container {
          position: absolute; right: 45px; top: 120px; width: 120px; height: 120px;
          display: none; align-items: center; justify-content: center;
        }
        .countdown-container.active { display: flex; }
        .countdown-ring { transform: rotate(-90deg); }
        .countdown-circle { fill: none; stroke: var(--za-warning); stroke-width: 8; stroke-dasharray: 283; stroke-dashoffset: 0; transition: stroke-dashoffset 1s linear; stroke-linecap: round; }
        .countdown-text { position: absolute; font-family: var(--font-tech); font-size: 1.5rem; font-weight: 900; color: var(--za-warning); }

        /* Grid */
        .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(550px, 1fr)); gap: 35px; }

        /* Controls */
        .action-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .btn-action {
          background: rgba(255,255,255,0.03); border: 1px solid var(--za-glass-border); border-radius: 25px;
          padding: 35px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15px;
          cursor: pointer; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); color: rgba(255,255,255,0.4);
        }
        .btn-action:hover { background: rgba(255,255,255,0.08); transform: translateY(-4px); border-color: var(--za-primary); color: #fff; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        .btn-action.active { background: rgba(14, 165, 233, 0.12); border-color: var(--za-primary); color: var(--za-primary); border-width: 1.5px; }
        .btn-action.danger:hover { border-color: var(--za-danger); color: var(--za-danger); background: rgba(255, 0, 60, 0.1); box-shadow: 0 10px 25px rgba(255,0,60,0.3); }
        .btn-action ha-icon { --mdc-icon-size: 35px; }
        .btn-action span { font-family: var(--font-tech); font-weight: 900; font-size: 0.8rem; letter-spacing: 2px; text-transform: uppercase; }

        /* Inputs & Pickers */
        .pickBtn {
          width: 100%; text-align: left; padding: 22px 30px; border-radius: 20px;
          background: rgba(0,0,0,0.4); border: 1.5px solid var(--za-glass-border);
          color: #fff; font-family: var(--font-main); font-weight: 700; cursor: pointer; transition: 0.3s;
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;
        }
        .pickBtn:hover { border-color: var(--za-primary); background: rgba(14, 165, 233, 0.05); box-shadow: 0 0 20px rgba(14, 165, 233, 0.1); }
        .pickBtn::after { content: '→'; font-family: var(--font-tech); color: var(--za-primary); opacity: 0.6; font-size: 1.2rem; }

        .chips { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 25px; }
        .chip {
          background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(14, 165, 233, 0.3); border-radius: 100px;
          padding: 8px 18px; display: flex; align-items: center; gap: 10px; font-size: 0.85rem; font-weight: 700; color: var(--za-primary);
        }
        .chip span.sub2 { opacity: 0.4; font-size: 0.7rem; font-family: var(--font-mono); }
        .chip button { background: none; border: none; color: inherit; cursor: pointer; font-weight: 900; padding: 0 5px; font-size: 1.1rem; }

        ha-textfield {
          --mdc-text-field-fill-color: rgba(0,0,0,0.3);
          --mdc-text-field-ink-color: #fff;
          --mdc-text-field-label-ink-color: rgba(255,255,255,0.4);
          --mdc-theme-primary: var(--za-primary);
          margin-bottom: 20px; width: 100%;
        }
        ha-switch { --mdc-theme-secondary: var(--za-primary); }

        .save-bar { position: fixed; bottom: 40px; right: 40px; display: flex; gap: 20px; z-index: 100; }
        .btn-prime {
          padding: 20px 45px; border-radius: 20px; background: var(--za-primary); color: #fff;
          font-family: var(--font-tech); font-weight: 900; letter-spacing: 3px; border: none; cursor: pointer;
          box-shadow: 0 15px 35px rgba(14, 165, 233, 0.4); transition: 0.3s; text-transform: uppercase;
        }
        .btn-prime:hover { transform: translateY(-5px); box-shadow: 0 20px 50px rgba(14, 165, 233, 0.6); }

        /* Node Health Matrix */
        .node-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .node-card {
          background: rgba(255,255,255,0.03); border: 1px solid var(--za-glass-border); border-radius: 25px; padding: 20px;
          display: flex; flex-direction: column; gap: 15px; position: relative;
        }
        .node-name { font-weight: 800; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .node-meta { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.7rem; opacity: 0.5; }
        .node-stats { display: flex; gap: 15px; align-items: center; }
        .stat-bar { flex: 1; height: 6px; background: rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden; }
        .stat-fill { height: 100%; background: var(--za-primary); transition: 0.5s; }
        .stat-fill.low { background: var(--za-danger); }
        .stat-fill.mid { background: var(--za-warning); }
        .stat-label { font-size: 0.65rem; font-weight: 900; opacity: 0.8; width: 40px; text-align: right; }

        /* Modal Infinity */
        .modalBack {
          position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(25px);
          display: none; align-items: center; justify-content: center; z-index: 1000;
        }
        .modalBack.open { display: flex; }
        .modal {
          width: 700px; max-height: 85vh; background: #10121a; border: 2px solid var(--za-primary);
          border-radius: 40px; display: flex; flex-direction: column; overflow: hidden;
          box-shadow: 0 0 100px rgba(14, 165, 233, 0.2);
        }
        .modalHead { padding: 35px 45px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--za-glass-border); }
        .modalTitle { font-family: var(--font-tech); font-size: 1.2rem; font-weight: 900; letter-spacing: 4px; color: var(--za-primary); }
        .modalBody { padding: 45px; overflow-y: auto; }
        .search {
          width: 100%; padding: 22px; border-radius: 20px; border: 1.5px solid var(--za-glass-border);
          background: rgba(255,255,255,0.03); color: #fff; font-size: 1rem; outline: none; margin-bottom: 25px;
          font-family: var(--font-main); transition: 0.3s;
        }
        .search:focus { border-color: var(--za-primary); box-shadow: 0 0 20px rgba(14, 165, 233, 0.1); }
        .list { display: flex; flex-direction: column; gap: 12px; }
        .item { padding: 18px 25px; background: rgba(255,255,255,0.03); border-radius: 20px; cursor: pointer; transition: 0.2s; border: 1px solid transparent; }
        .item:hover { background: rgba(255,255,255,0.07); border-color: var(--za-primary); }
        .item .eid { font-family: var(--font-mono); font-size: 0.75rem; opacity: 0.4; margin-top: 4px; }
        .modalFoot { padding: 30px 45px; border-top: 1px solid var(--za-glass-border); display: flex; gap: 15px; }

        /* Scanner */
        .scanner-overlay { position: absolute; inset: 0; pointer-events: none; border-radius: 35px; display: none; z-index: 5; background: rgba(14, 165, 233, 0.03); }
        .scanner-bar { width: 100%; height: 3px; background: var(--za-primary); box-shadow: 0 0 20px var(--za-primary); position: absolute; top: 0; animation: scanMove 4s linear infinite; }
        .scanner-overlay.active { display: block; }
        @keyframes scanMove { 0% { top: 0; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }

        .footer { text-align: center; padding: 60px; font-family: var(--font-tech); letter-spacing: 5px; opacity: 0.2; font-size: 0.8rem; }
        .footer a { color: var(--za-primary); text-decoration: none; }

        @media (max-width: 900px) {
          .navbar { padding: 0 25px; }
          .hero-title h1 { font-size: 2rem; }
          .main-content { padding: 30px; }
          .grid2 { grid-template-columns: 1fr; }
          .action-grid { grid-template-columns: 1fr 1fr; }
          .countdown-container { position: relative; right: 0; top: 0; margin: 20px auto; }
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
            <button class="nav-item active" data-tab="dashboard">ÜBERSICHT</button>
            <button class="nav-item" data-tab="health">KNOTEN-STATUS</button>
            <button class="nav-item" data-tab="settings">KONFIGURATION</button>
            <button class="nav-item" data-tab="info">HILFE</button>
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
               <svg class="countdown-ring" width="120" height="120">
                  <circle class="countdown-circle" id="countdownCircle" cx="60" cy="60" r="45"></circle>
               </svg>
               <div class="countdown-text" id="countdownText">30</div>
            </div>

            <div style="margin-bottom: 40px; display:flex; align-items:center; gap:20px; background:rgba(255,255,255,0.03); padding:15px 25px; border-radius:20px; width:fit-content; border:1px solid var(--za-glass-border);">
               <div style="font-size:0.75rem; font-family:var(--font-tech); letter-spacing:2px; color:var(--za-primary);">AKTIVER KNOTEN:</div>
               <select id="alarmEntitySel" style="background:transparent; border:none; color:#fff; font-family:var(--font-tech); font-weight:900; font-size:0.9rem; outline:none; cursor:pointer;">
                  <option>LADE...</option>
               </select>
            </div>

            <div class="card">
               <div class="secTitle">Taktische Steuerung</div>
               <div class="action-grid">
                 <button class="btn-action" id="btnHome">
                   <ha-icon icon="mdi:home-shield"></ha-icon>
                   <span>Zuhause</span>
                 </button>
                 <button class="btn-action" id="btnAway">
                   <ha-icon icon="mdi:shield-lock"></ha-icon>
                   <span>Abwesend</span>
                 </button>
                 <button class="btn-action" id="btnDisarm">
                   <ha-icon icon="mdi:shield-off"></ha-icon>
                   <span>Unscharf</span>
                 </button>
                 <button class="btn-action danger" id="btnTrigger">
                   <ha-icon icon="mdi:alert-octagon"></ha-icon>
                   <span>Panic</span>
                 </button>
               </div>
               <div id="readyLine" style="margin-top:35px; text-align:center; font-family:var(--font-tech); font-weight:900; font-size:0.9rem; letter-spacing:3px;"></div>
            </div>

            <div class="grid2">
              <div class="card">
                <div class="scanner-overlay" id="scannerOverlay"><div class="scanner-bar"></div></div>
                <div class="secTitle">System Integrität</div>
                <div id="openSensorsText" style="line-height:1.8; font-family:var(--font-mono); font-size:0.85rem;"></div>
              </div>
              <div class="card" id="camPreviewCard" style="min-height:300px; display:flex; align-items:center; justify-content:center;">
                 <div class="muted" style="opacity:0.3; font-family:var(--font-tech); letter-spacing:3px;">KEINE VIDEO-KNOTEN</div>
              </div>
            </div>
          </div>

          <div id="tab-health" class="tab-view">
             <div class="dash-hero">
                <div class="hero-title">
                  <h1>Knoten-Status</h1>
                  <div class="muted">Überwachung der Hardware-Integrität</div>
                </div>
             </div>
             <div class="node-grid" id="nodeHealthGrid"></div>
          </div>

          <div id="tab-settings" class="tab-view">
             <div class="dash-hero">
                <div class="hero-title">
                  <h1>Architektur</h1>
                  <div class="muted">Systemparameter & Sensor-Mapping</div>
                </div>
             </div>

             <div class="grid2">
                <div class="card">
                  <div class="secTitle">Sensor-Array</div>
                  ${this._pickerHtml("perimeter", "Perimeter-Sensoren (Außenhaut)")}
                  ${this._pickerHtml("motion", "Volumetrische Sensoren (Bewegung)")}
                  ${this._pickerHtml("always", "Kritische Sensoren (Rauch/Wasser)")}
                  
                  <div style="margin-top:30px; border-top:1px solid var(--za-glass-border); padding-top:30px; display:flex; align-items:center; justify-content:space-between;">
                     <div>
                        <div style="font-weight:900; font-size:0.9rem; letter-spacing:1px;">Scharfschalten erzwingen</div>
                        <div style="font-size:0.75rem; opacity:0.5;">Aktive Sensoren beim Schärfen ignorieren</div>
                     </div>
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
                      <div class="muted" style="margin-bottom:15px; font-size:0.7rem; font-family:var(--font-tech); letter-spacing:2px;">Primäre Sirene</div>
                      <button class="pickBtn" id="sirenPick">SIRENE WÄHLEN...</button>
                      <div class="chips" id="sirenChips"></div>

                      <div class="muted" style="margin:25px 0 15px 0; font-size:0.7rem; font-family:var(--font-tech); letter-spacing:2px;">Beleuchtungs-Matrix</div>
                      ${this._pickerHtml("alarmLights", "Alarm-Lichter")}
                      <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-top:15px;">
                         <ha-textfield id="lightColor" label="HEX Farbe (#)"></ha-textfield>
                         <ha-textfield id="lightBrightness" type="number" label="Helligkeit (1-255)"></ha-textfield>
                      </div>
                      <ha-textfield id="lightEffect" label="Lichteffekt"></ha-textfield>
                      <div style="display:flex; gap:15px; align-items:center;">
                         <ha-switch id="lightRestore"></ha-switch>
                         <div style="font-size:0.8rem; font-weight:700; opacity:0.7;">Status nach Alarm wiederherstellen</div>
                      </div>
                   </div>
                </div>
             </div>
             
             <div class="card">
                <div class="secTitle">Visuelle Überwachung</div>
                ${this._pickerHtml("cams", "Video-Feeds (Kamera-Knoten)")}
                <div style="margin-top:25px; display:flex; gap:15px; align-items:center;">
                   <ha-switch id="camOnlyTrig"></ha-switch>
                   <div style="font-size:0.8rem; font-weight:700; opacity:0.7;">Feeds nur bei Alarm anzeigen</div>
                </div>
             </div>

             <div class="card">
                <div class="secTitle">System-Backup</div>
                <div class="muted" style="margin-bottom:20px;">Konfiguration als JSON exportieren oder importieren.</div>
                <div style="display:flex; gap:15px;">
                   <button class="pickBtn" id="exportBtn" style="flex:1;">BACKUP EXPORTIEREN</button>
                   <button class="pickBtn" id="importBtn" style="flex:1;">BACKUP IMPORTIEREN</button>
                </div>
                <textarea id="configJson" style="width:100%; height:150px; margin-top:20px; background:rgba(0,0,0,0.4); border:1px solid var(--za-glass-border); border-radius:15px; color:#fff; font-family:var(--font-mono); font-size:0.7rem; padding:15px; display:none;"></textarea>
             </div>
          </div>

          <div id="tab-info" class="tab-view">
            <div class="card" style="text-align:center; padding:80px 40px;">
              <h1 class="brand" style="justify-content:center; font-size:4rem; margin-bottom:15px;">ZIG<span>ALARM</span></h1>
              <div style="font-family:var(--font-tech); letter-spacing:10px; font-weight:900; color:var(--za-primary);">INFINITY EDITION V2.3</div>
              <div id="hintLine" style="margin: 40px auto; font-family:var(--font-mono); font-size:0.9rem; font-weight:700; color:var(--za-primary);">SYSTEM STATUS: GESICHERT</div>
            </div>

            <div class="grid2">
              <div class="card">
                 <div class="secTitle">Kern-Logik</div>
                 <p style="line-height:1.8; opacity:0.6; font-size:0.95rem;">
                   ZigAlarm Infinity transformiert deine Standard Home Assistant Knoten in eine militärische Sicherheitsmatrix. 
                   Durch Multi-Layer-Sensoranalyse und Echtzeit-Statusüberwachung garantieren wir eine Bedrohungserkennung ohne Latenz.
                 </p>
              </div>

              <div class="card">
                 <div class="secTitle">Knoten-Kategorien</div>
                 <div style="display:flex; flex-direction:column; gap:25px;">
                   <div>
                     <div style="color:var(--za-primary); font-family:var(--font-tech); font-weight:900; letter-spacing:2px; font-size:0.8rem;">PERIMETER</div>
                     <div style="opacity:0.5; font-size:0.85rem; margin-top:5px;">Türen und Fenster. Werden in den Zuständen ZUHAUSE und ABWESEND überwacht.</div>
                   </div>
                   <div>
                     <div style="color:var(--za-primary); font-family:var(--font-tech); font-weight:900; letter-spacing:2px; font-size:0.8rem;">VOLUMETRISCH</div>
                     <div style="opacity:0.5; font-size:0.85rem; margin-top:5px;">Bewegungsmelder. Werden nur im Zustand ABWESEND überwacht für maximale Freiheit.</div>
                   </div>
                   <div>
                     <div style="color:var(--za-danger); font-family:var(--font-tech); font-weight:900; letter-spacing:2px; font-size:0.8rem;">KRITISCH</div>
                     <div style="opacity:0.5; font-size:0.85rem; margin-top:5px;">24/7 Überwachung. Rauch, Wasser, Gas. Immer aktiv.</div>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        </div>

        <div class="save-bar">
           <button class="btn-prime" id="save">Konfig Synchronisieren</button>
        </div>

        <div class="footer">OPERATING SYSTEM: <a href="https://openkairo.de" target="_blank">OPENKAIRO INFINITY</a></div>

        <div class="modalBack" id="pickerBack">
           <div class="modal">
             <div class="modalHead">
               <div class="modalTitle" id="pickerTitle">Auswahl</div>
               <button class="btn-action" id="pickerClose" style="padding:10px; border-radius:15px;"><ha-icon icon="mdi:close"></ha-icon></button>
             </div>
             <div class="modalBody">
                <input class="search" id="pickerSearch" placeholder="KNOTEN SUCHEN..." />
                <div class="list" id="pickerList"></div>
             </div>
             <div class="modalFoot">
               <button class="nav-item" id="pickerClear" style="margin-right:auto; color:var(--za-danger);">AUSWAHL LÖSCHEN</button>
               <button class="btn-prime" id="pickerDone">ÜBERNEHMEN</button>
             </div>
           </div>
        </div>
      </div>
    `;

    // --- Logic for Tabs ---
    this.shadowRoot.querySelectorAll(".nav-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        if (!tab) return;
        this.shadowRoot.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.shadowRoot.querySelectorAll(".tab-view").forEach(v => {
          v.classList.remove("active");
          if (v.id === `tab-${tab}`) v.classList.add("active");
        });
        this._activeTab = tab;
        if (tab === 'health') this._updateHealthGrid();
      });
    });

    this._$("save").addEventListener("click", () => this._save());
    this._$("alarmEntitySel").addEventListener("change", () => { this._panelSelections = {}; this._update(); });

    this._$("btnHome").addEventListener("click", () => this._arm("home"));
    this._$("btnAway").addEventListener("click", () => this._arm("away"));
    this._$("btnDisarm").addEventListener("click", () => this._disarm());
    this._$("btnTrigger").addEventListener("click", () => this._trigger());

    this._hookPicker("perimeter", ["binary_sensor", "sensor", "event"], true, "PERIMETER ARRAY");
    this._hookPicker("motion", ["binary_sensor", "sensor", "event"], true, "VOLUMETRISCHES ARRAY");
    this._hookPicker("always", ["binary_sensor", "sensor", "event"], true, "KRITISCHES ARRAY");
    this._hookPicker("alarmLights", ["light"], true, "LICHT MATRIX");
    this._hookPicker("cams", ["camera"], true, "KAMERA KNOTEN");

    this._$("sirenPick").addEventListener("click", () => this._openPicker({ key: "siren", multi: false, domains: ["siren", "switch", "light"], title: "SIRENEN KNOTEN" }));

    this._$("pickerClose").addEventListener("click", () => this._closePicker());
    this._$("pickerDone").addEventListener("click", () => this._closePicker());
    this._$("pickerSearch").addEventListener("input", () => this._renderPickerList());
    this._$("pickerClear").addEventListener("click", () => {
      const k = this._currentPick?.key; if (!k) return;
      this._panelSelections[k] = [];
      if (k === "siren") this._renderSirenChip(); else this._renderChips(k);
      this._renderPickerList();
    });

    this._$("exportBtn").addEventListener("click", () => this._exportConfig());
    this._$("importBtn").addEventListener("click", () => this._importConfig());
  }

  _pickerHtml(key, title) {
    return `
      <div style="margin-bottom:25px;">
        <div style="font-size:0.7rem; font-family:var(--font-tech); letter-spacing:2px; color:rgba(255,255,255,0.4); margin-bottom:12px;">${title}</div>
        <button class="pickBtn" id="${key}Pick">KNOTEN ZUWEISEN...</button>
        <div class="chips" id="${key}Chips"></div>
      </div>
    `;
  }

  _hookPicker(key, domains, multi, title) {
    const pickBtn = this._$(`${key}Pick`);
    if (!pickBtn) return;
    pickBtn.addEventListener("click", () => this._openPicker({ key, domains, multi, title }));
  }

  _openPicker({ key, domains, multi, title }) {
    this._currentPick = { key, domains, multi, title };
    const back = this._$("pickerBack");
    if (!back) return;
    this._$("pickerTitle").textContent = title;
    this._$("pickerSearch").value = "";
    back.classList.add("open");
    this._renderPickerList();
    setTimeout(() => this._$("pickerSearch")?.focus(), 50);
  }

  _closePicker() { this._$("pickerBack")?.classList.remove("open"); }

  _renderPickerList() {
    const listEl = this._$("pickerList");
    if (!listEl) return;
    const { key, domains, multi } = this._currentPick || {};
    if (!key || !this._hass) return;

    const q = (this._$("pickerSearch")?.value || "").trim().toLowerCase();
    const states = this._hass.states || {};
    const all = Object.keys(states).filter((eid) => domains.includes(byDomain(eid)));
    const filtered = q ? all.filter((eid) => {
      const fn = (states[eid]?.attributes?.friendly_name || "").toString().toLowerCase();
      return eid.toLowerCase().includes(q) || fn.includes(q);
    }) : all;

    const selected = uniq(this._panelSelections?.[key] || []);
    listEl.innerHTML = filtered.slice(0, 100).map((eid) => {
      const fn = (states[eid]?.attributes?.friendly_name || eid).toString();
      const isSel = selected.includes(eid);
      const isOnline = states[eid]?.state !== 'unavailable';
      return `
        <div class="item" data-eid="${eid}" style="${isSel ? 'border-color:var(--za-primary); background:rgba(14, 165, 233, 0.1);' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
             <div>
               <div style="font-weight:700;">${fn}</div>
               <div class="eid">${eid}</div>
             </div>
             <div style="display:flex; align-items:center; gap:10px;">
               <div style="font-size:0.6rem; font-family:var(--font-mono); color:${isOnline ? 'var(--za-success)' : 'var(--za-danger)'}">${isOnline ? 'ONLINE' : 'OFFLINE'}</div>
               ${isSel ? '<ha-icon icon="mdi:check-circle" style="color:var(--za-primary)"></ha-icon>' : ''}
             </div>
          </div>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll(".item[data-eid]").forEach((el) => {
      el.addEventListener("click", () => {
        const eid = el.getAttribute("data-eid");
        if (multi) {
          const cur = uniq(this._panelSelections?.[key] || []);
          if (cur.includes(eid)) this._panelSelections[key] = cur.filter(x => x !== eid);
          else cur.push(eid);
          this._panelSelections[key] = uniq(this._panelSelections[key]);
          this._renderChips(key);
          this._renderPickerList();
        } else {
          this._panelSelections[key] = [eid];
          this._renderSirenChip();
          this._closePicker();
        }
      });
    });
  }

  _renderChips(key) {
    const host = this._$(`${key}Chips`);
    if (!host) return;
    const items = uniq(this._panelSelections?.[key] || []);
    host.innerHTML = items.map((eid) => `
      <div class="chip">
        <span>${this._friendlyName(eid)}</span>
        <span class="sub2">${eid}</span>
        <button data-eid="${eid}">✕</button>
      </div>`).join("");

    host.querySelectorAll("button[data-eid]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const eid = btn.getAttribute("data-eid");
        this._panelSelections[key] = (this._panelSelections[key] || []).filter((x) => x !== eid);
        this._renderChips(key);
      });
    });
  }

  _renderSirenChip() {
    const host = this._$("sirenChips");
    if (!host) return;
    const items = uniq(this._panelSelections?.siren || []);
    const eid = items[0] || null;
    host.innerHTML = eid ? `
      <div class="chip">
        <span>${this._friendlyName(eid)}</span>
        <span class="sub2">${eid}</span>
        <button data-eid="${eid}">✕</button>
      </div>` : "";

    host.querySelectorAll("button[data-eid]").forEach((b) => {
      b.addEventListener("click", () => { this._panelSelections.siren = []; this._renderSirenChip(); });
    });
  }

  _getSelectedAlarmEntity() {
    const sel = this._$("alarmEntitySel");
    return (sel?.value || "").trim() || null;
  }

  _updateAlarmSelect() {
    const sel = this._$("alarmEntitySel");
    if (!sel || !this._hass) return;
    const alarmList = Object.keys(this._hass.states).filter(eid => eid.startsWith("alarm_control_panel.")).sort();
    const listStr = JSON.stringify(alarmList);
    if (this._lastAlarmList === listStr && sel.options.length > 0) return;
    this._lastAlarmList = listStr;
    const current = (sel.value || "").trim();
    if (alarmList.length === 0) {
      sel.innerHTML = `<option value="">KEINE SYSTEME GEFUNDEN</option>`;
      return;
    }
    sel.innerHTML = alarmList.map((eid) => `<option value="${eid}" style="background:#10121a; color:white;">${eid.toUpperCase()}</option>`).join("");
    if (current && alarmList.includes(current)) sel.value = current;
    else if (alarmList.length > 0) sel.value = alarmList[0];
  }

  async _arm(mode) {
    const eid = this._getSelectedAlarmEntity(); if (!eid) return;
    const svc = mode === "home" ? "alarm_arm_home" : "alarm_arm_away";
    await this._hass.callService("alarm_control_panel", svc, { entity_id: eid });
    this._setHint("SCHARFSCHALTUNG INITIERT...");
  }

  async _disarm() {
    const eid = this._getSelectedAlarmEntity(); if (!eid) return;
    await this._hass.callService("alarm_control_panel", "alarm_disarm", { entity_id: eid });
    this._setHint("SYSTEM ENTSCHÄRFT");
  }

  async _trigger() {
    const eid = this._getSelectedAlarmEntity(); if (!eid) return;
    await this._hass.callService("alarm_control_panel", "alarm_trigger", { entity_id: eid });
    this._setHint("PANIK-ALARM AKTIVIERT!");
  }

  _update() {
    if (!this._root || !this._hass) return;
    this._updateAlarmSelect();
    if (!this._panelSelections) this._panelSelections = {};

    const selected = this._getSelectedAlarmEntity();
    const st = selected ? this._hass.states[selected] : null;
    const pill = this._$("statePill");
    const status = this._$("statusLine");
    const readyLine = this._$("readyLine");

    if (!selected || !st) {
      if (pill) pill.textContent = "OFFLINE";
      this._setHint("KEINE ZIGALARM INTEGRATION GEFUNDEN");
      return;
    }

    const a = st.attributes || {};
    if (pill) { pill.textContent = stateToDE(st.state); pill.setAttribute("data-state", st.state); }

    const isReady = a.ready_to_arm_home && a.ready_to_arm_away;
    if (readyLine) {
      readyLine.textContent = isReady ? "SYSTEM BEREIT // PERIMETER GESICHERT" : "WARNUNG // SCHWACHSTELLEN ERKANNT";
      readyLine.style.color = isReady ? "var(--za-success)" : "var(--za-warning)";
    }

    this._setHint("SYSTEM ONLINE // VERSCHLÜSSELTE VERBINDUNG");

    // Countdown logic
    this._updateCountdown(st);

    const ensure = (k, def) => { if (!Array.isArray(this._panelSelections[k]) || this._panelSelections[k].length === 0) this._panelSelections[k] = uniq(def); };
    ensure("perimeter", a.perimeter_sensors || []);
    ensure("motion", a.motion_sensors || []);
    ensure("always", a.always_sensors || []);
    ensure("alarmLights", a.alarm_lights || []);
    ensure("cams", a.camera_entities || []);
    if (!Array.isArray(this._panelSelections.siren) || this._panelSelections.siren.length === 0) this._panelSelections.siren = a.siren_entity ? [a.siren_entity] : [];

    this._renderChips("perimeter");
    this._renderChips("motion");
    this._renderChips("always");
    this._renderChips("alarmLights");
    this._renderChips("cams");
    this._renderSirenChip();

    const setField = (id, val) => { const el = this._$(id); if (el && String(el.value) !== String(val ?? "")) el.value = String(val ?? ""); };
    const setSwitch = (id, val) => { const el = this._$(id); if (el) el.checked = !!val; };

    setField("lightColor", a.alarm_light_color || "#ff0000");
    setField("lightBrightness", a.alarm_light_brightness ?? 255);
    setField("lightEffect", a.alarm_light_effect ?? "");
    setSwitch("lightRestore", a.alarm_light_restore ?? true);
    setSwitch("camOnlyTrig", a.camera_show_only_triggered ?? false);
    setSwitch("forceArm", a.force_arm ?? false);
    setField("exitDelay", a.exit_delay ?? 5);
    setField("entryDelay", a.entry_delay ?? 5);
    setField("triggerTime", a.trigger_time ?? 180);

    const open = a.open_sensors || [];
    const openText = this._$("openSensorsText");
    if (openText) {
      if (open.length > 0) openText.innerHTML = `<span style="color:var(--za-warning); font-weight:900;">AKTIVE KNOTEN:</span><br/>${open.map(s => `> ${s}`).join("<br/>")}`;
      else openText.innerHTML = `<span style="color:var(--za-success); font-weight:900;">ALLE KNOTEN GESICHERT</span>`;
    }

    if (status) status.textContent = `VERBUNDEN MIT ${selected.toUpperCase()}`;
    this._updateCamPreview(a.camera_entities || []);

    if (this._lastState !== st.state) {
      if (st.state === "triggered") this._playSound("alarm");
      else if (st.state === "disarmed" && this._lastState && this._lastState !== "disarmed") this._playSound("disarm");
      else if (st.state.includes("armed")) this._playSound("arm");
      this._lastState = st.state;
    }

    const scanner = this._$("scannerOverlay");
    const matrix = this._$("matrixBg");
    if (scanner) {
      if (st.state.includes("armed")) {
        scanner.classList.add("active");
        matrix?.classList.add("pulse");
      } else {
        scanner.classList.remove("active");
        matrix?.classList.remove("pulse");
      }
    }

    if (this._activeTab === 'health') this._updateHealthGrid();
  }

  _updateCountdown(st) {
    const el = this._$("countdown");
    const circle = this._$("countdownCircle");
    const text = this._$("countdownText");
    if (!el || !circle || !text) return;

    const state = st.state;
    const delay = (state === 'pending') ? st.attributes.entry_delay : (state === 'arming') ? st.attributes.exit_delay : 0;
    
    if (delay > 0) {
      el.classList.add("active");
      text.textContent = delay;
      circle.style.strokeDashoffset = 0; 
    } else {
      el.classList.remove("active");
    }
  }

  _updateHealthGrid() {
    const grid = this._$("nodeHealthGrid");
    if (!grid || !this._hass) return;

    const allSensors = uniq([
      ...(this._panelSelections?.perimeter || []),
      ...(this._panelSelections?.motion || []),
      ...(this._panelSelections?.always || [])
    ]);

    if (allSensors.length === 0) {
      grid.innerHTML = `<div class="card" style="grid-column: 1/-1; text-align:center;">KEINE SENSOREN ZUGEWIESEN</div>`;
      return;
    }

    grid.innerHTML = allSensors.map(eid => {
      const st = this._hass.states[eid];
      if (!st) return "";
      
      const battery = st.attributes.battery_level ?? st.attributes.battery ?? null;
      const lqi = st.attributes.linkquality ?? null;
      const fn = st.attributes.friendly_name || eid;
      const online = st.state !== 'unavailable';

      return `
        <div class="node-card">
          <div class="node-name">${fn}</div>
          <div class="node-meta">
            <span>${eid}</span>
            <span style="color:${online ? 'var(--za-success)' : 'var(--za-danger)'}">${online ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
          <div class="node-stats">
            <ha-icon icon="mdi:battery-high" style="opacity:0.5; --mdc-icon-size:18px;"></ha-icon>
            <div class="stat-bar"><div class="stat-fill ${battery < 20 ? 'low' : battery < 50 ? 'mid' : ''}" style="width:${battery ?? 0}%"></div></div>
            <div class="stat-label">${battery !== null ? battery + '%' : 'N/A'}</div>
          </div>
          <div class="node-stats">
            <ha-icon icon="mdi:wifi" style="opacity:0.5; --mdc-icon-size:18px;"></ha-icon>
            <div class="stat-bar"><div class="stat-fill" style="width:${(lqi / 255) * 100 || 0}%"></div></div>
            <div class="stat-label">${lqi ?? 'N/A'}</div>
          </div>
        </div>
      `;
    }).join("");
  }

  _exportConfig() {
    const area = this._$("configJson");
    if (!area) return;
    const data = {
      perimeter: this._panelSelections?.perimeter || [],
      motion: this._panelSelections?.motion || [],
      always: this._panelSelections?.always || [],
      siren: this._panelSelections?.siren || [],
      alarmLights: this._panelSelections?.alarmLights || [],
      cams: this._panelSelections?.cams || [],
      settings: {
        color: this._$("lightColor")?.value,
        bright: this._$("lightBrightness")?.value,
        effect: this._$("lightEffect")?.value,
        restore: this._$("lightRestore")?.checked,
        camTrig: this._$("camOnlyTrig")?.checked,
        force: this._$("forceArm")?.checked,
        exit: this._$("exitDelay")?.value,
        entry: this._$("entryDelay")?.value,
        time: this._$("triggerTime")?.value,
      }
    };
    area.value = JSON.stringify(data, null, 2);
    area.style.display = 'block';
    this._setHint("KONFIGURATION EXPORTIERT ✅");
  }

  _importConfig() {
    const area = this._$("configJson");
    if (!area || !area.value) {
      if (area) area.style.display = 'block';
      this._setHint("WARNUNG: JSON EINFÜGEN");
      return;
    }
    try {
      const d = JSON.parse(area.value);
      this._panelSelections.perimeter = d.perimeter || [];
      this._panelSelections.motion = d.motion || [];
      this._panelSelections.always = d.always || [];
      this._panelSelections.siren = d.siren || [];
      this._panelSelections.alarmLights = d.alarmLights || [];
      this._panelSelections.cams = d.cams || [];
      
      const s = d.settings || {};
      if (s.color) this._$("lightColor").value = s.color;
      if (s.bright) this._$("lightBrightness").value = s.bright;
      if (s.effect) this._$("lightEffect").value = s.effect;
      if (s.restore !== undefined) this._$("lightRestore").checked = s.restore;
      if (s.camTrig !== undefined) this._$("camOnlyTrig").checked = s.camTrig;
      if (s.force !== undefined) this._$("forceArm").checked = s.force;
      if (s.exit) this._$("exitDelay").value = s.exit;
      if (s.entry) this._$("entryDelay").value = s.entry;
      if (s.time) this._$("triggerTime").value = s.time;

      this._renderChips("perimeter");
      this._renderChips("motion");
      this._renderChips("always");
      this._renderChips("alarmLights");
      this._renderChips("cams");
      this._renderSirenChip();
      
      this._setHint("BACKUP IMPORTIERT ✅ - BITTE SYNCHRONISIEREN");
    } catch(e) {
      this._setHint("FEHLER: UNGÜLTIGES JSON ❌");
    }
  }

  _playSound(type) {
    const msg = { "arm": "System aktiviert.", "disarm": "System deaktiviert. Willkommen zurück.", "alarm": "Achtung! Einbruch erkannt!" }[type];
    if (msg && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(msg); u.lang = "de-DE"; u.rate = 1.0; window.speechSynthesis.speak(u);
    }
  }

  async _getHelpers() { if (this._helpers) return this._helpers; if (window.loadCardHelpers) { this._helpers = await window.loadCardHelpers(); return this._helpers; } return null; }

  async _updateCamPreview(cams) {
    const card = this._$("camPreviewCard"); if (!card) return;
    cams = cams.filter(Boolean); const camStr = JSON.stringify(cams.sort());
    if (this._lastCamStr === camStr && card.children.length > 0) return;
    this._lastCamStr = camStr;
    if (!cams || cams.length === 0) { card.innerHTML = `<div class="muted" style="opacity:0.3; font-family:var(--font-tech); letter-spacing:3px;">KEINE VIDEO-KNOTEN</div>`; return; }
    const helpers = await this._getHelpers(); if (!helpers) return;
    card.innerHTML = "";
    const el = helpers.createCardElement({ type: "vertical-stack", cards: cams.map(eid => ({ type: "picture-entity", entity: eid, show_name: true, show_state: false, camera_view: "auto" })) });
    el.hass = this._hass; card.appendChild(el);
  }

  async _save() {
    const eid = this._getSelectedAlarmEntity(); if (!eid) return;
    const data = {
      alarm_entity: eid,
      perimeter_sensors: uniq(this._panelSelections?.perimeter),
      motion_sensors: uniq(this._panelSelections?.motion),
      always_sensors: uniq(this._panelSelections?.always),
      siren_entity: (uniq(this._panelSelections?.siren)[0] || null),
      alarm_lights: uniq(this._panelSelections?.alarmLights),
      alarm_light_color: String(this._$("lightColor")?.value || "#ff0000"),
      alarm_light_brightness: Number(this._$("lightBrightness")?.value || 255),
      alarm_light_effect: String(this._$("lightEffect")?.value || ""),
      alarm_light_restore: !!this._$("lightRestore")?.checked,
      camera_entities: uniq(this._panelSelections?.cams),
      camera_show_only_triggered: !!this._$("camOnlyTrig")?.checked,
      force_arm: !!this._$("forceArm")?.checked,
      exit_delay: Number(this._$("exitDelay")?.value || 5),
      entry_delay: Number(this._$("entryDelay")?.value || 5),
      trigger_time: Number(this._$("triggerTime")?.value || 180),
    };
    try {
      await this._hass.callService("zigalarm", "set_config", data);
      this._setHint("KONFIGURATION SYNCHRONISIERT ✅");
    } catch (e) { this._setHint("FEHLER BEI DER SYNCHRONISATION ❌"); }
  }
}

if (!customElements.get("zigalarm-panel")) customElements.define("zigalarm-panel", ZigAlarmPanel);
