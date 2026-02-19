/* ZigAlarm Sidebar Panel (modern) — Option 1: echter Entity-Picker als Modal
 * - Kein <datalist> mehr nötig (Firefox/Chrome identisch)
 * - Klick auf "Entität auswählen…" öffnet ein Popup mit Suche + Friendly-Names
 * - Multi-Select über Chips + Entfernen
 *
 * Erwartet:
 * - alarm_control_panel Entität hat Attribute: perimeter_sensors, motion_sensors, always_sensors, alarm_lights, camera_entities, ...
 * - Service: zigalarm.set_config mit payload wie in _save()
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
    case "disarmed":
      return "UNSCHARF";
    case "armed_home":
      return "ZUHAUSE SCHARF";
    case "armed_away":
      return "ABWESEND SCHARF";
    case "arming":
      return "SCHARFSCHALTEN…";
    case "pending":
      return "EINGANGSVERZÖGERUNG…";
    case "triggered":
      return "ALARM";
    default:
      return String(st || "-").toUpperCase();
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
    this._setHint("Lade System…");
  }

  _$(id) {
    return this._root?.getElementById?.(id);
  }

  _setHint(txt) {
    const el = this._$("hintLine");
    if (!el) return;
    el.textContent = txt;
    if (txt.includes("System online")) el.style.color = "var(--za-success)";
    else if (txt.includes("Kein ZigAlarm")) el.style.color = "var(--za-danger)";
    else el.style.color = "var(--za-text-muted)";
  }

  _filterEntities(domains) {
    const states = this._hass?.states || {};
    return Object.keys(states)
      .filter((eid) => domains.includes(byDomain(eid)))
      .sort();
  }

  _findZigAlarmPanels() {
    const states = this._hass?.states || {};
    return Object.keys(states)
      .filter((eid) => eid.startsWith("alarm_control_panel."))
      .filter((eid) => {
        const a = states[eid]?.attributes || {};
        return (
          Array.isArray(a.perimeter_sensors) &&
          Array.isArray(a.motion_sensors) &&
          Array.isArray(a.always_sensors)
        );
      })
      .sort();
  }

  _friendlyName(eid) {
    const st = this._hass?.states?.[eid];
    const n = st?.attributes?.friendly_name;
    return n ? String(n) : eid;
  }

  _render() {
    this._root = this.attachShadow({ mode: "open" });
    // Default tab
    this._activeTab = "dashboard";

    this._root.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          --za-bg-body: #0b0c15; /* Deep dark slate */
          --za-bg-card: rgba(20, 24, 35, 0.7);
          --za-primary: #0ea5e9; /* Cyan 500 */
          --za-accent: #8b5cf6; /* Violet 500 */
          --za-success: #10b981;
          --za-danger: #ef4444; 
          --za-warning: #f59e0b; 
          --za-text: #f8fafc;
          --za-text-muted: #94a3b8;
          --za-border: rgba(255, 255, 255, 0.08);
          font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: var(--za-text);
        }

        /* Animated Grid Background */
        .app-container {
          min-height: 100%;
          position: relative; z-index: 1;
          background: 
            linear-gradient(rgba(11, 12, 21, 0.75), rgba(11, 12, 21, 0.75)),
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 100% 100%, 40px 40px, 40px 40px;
          display: flex;
          flex-direction: column;
        }
        
        /* Cool Background FX */
        .bg-fx {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0;
          pointer-events: none; overflow: hidden;
        }
        .bg-blob {
          position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.5;
          animation: float 20s infinite ease-in-out;
        }
        .blob-1 { top: -10%; left: -10%; width: 50vw; height: 50vw; background: #00d4ff; animation-delay: 0s; }
        .blob-2 { bottom: -10%; right: -10%; width: 60vw; height: 60vw; background: #d946ef; animation-delay: -10s; }
        
        @keyframes float {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, 50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0, 0) scale(1); }
        }

        /* Navbar */
        .navbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 40px;
          height: 80px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          background: rgba(11, 12, 21, 0.8);
          backdrop-filter: blur(10px);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 1.5rem;
          font-weight: 900;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, #fff 0%, #cbd5e1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .brand span {
           background: linear-gradient(to right, var(--za-primary), var(--za-accent));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .nav-tabs {
          display: flex;
          gap: 8px;
          background: rgba(255,255,255,0.03);
          padding: 6px;
          border-radius: 12px;
          border: 1px solid var(--za-border);
        }

        .nav-item {
          padding: 10px 24px;
          border-radius: 8px;
          color: var(--za-text-muted);
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.3s;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: transparent;
          border: none;
        }

        .nav-item:hover { color: #fff; background: rgba(255,255,255,0.05); }
        .nav-item.active {
          background: var(--za-primary);
          color: #fff;
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4), 0 0 20px rgba(14, 165, 233, 0.2);
          border: 1px solid rgba(255,255,255,0.2);
        }

        /* Content Area */
        .main-content {
          flex: 1;
          padding: 40px;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
          box-sizing: border-box;
        }

        /* Tab Views */
        .tab-view { display: none; animation: fadeIn 0.4s ease; }
        .tab-view.active { display: block; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes breathe { 
          0% { opacity: 0.8; } 
          50% { opacity: 1; text-shadow: 0 0 15px currentColor; } 
          100% { opacity: 0.8; } 
        }
        .breathe { animation: breathe 3s infinite ease-in-out; }

        /* Cards */
        .card {
          padding: 32px;
          border-radius: 24px;
          border: 1px solid var(--za-border);
          background: var(--za-bg-card);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          margin-bottom: 24px;
        }
        
        /* Dashboard Specifics */
        .dash-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 32px;
        }
        
        .pill-hero {
          padding: 12px 24px;
          border-radius: 16px;
          font-weight: 800;
          font-size: 1rem;
          text-transform: uppercase;
          border: 1px solid var(--za-border);
          background: rgba(255,255,255,0.05);
          letter-spacing: 0.05em;
        }
        .pill-hero[data-state*="armed"] {
          background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.4); color: #6ee7b7; box-shadow: 0 0 20px rgba(16, 185, 129, 0.4);
        }
        .pill-hero[data-state="triggered"] {
          background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.6); color: #fca5a5; animation: pulse 1s infinite;
        }
        .pill-hero[data-state="triggered"] {
          background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.6); color: #fca5a5; animation: pulse 1s infinite;
        }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 15px transparent; } }

        /* Scanner Animation */
        .scanner-overlay {
            position: absolute; inset: 0; pointer-events: none; overflow: hidden; border-radius: 24px;
            display: none; z-index: 10;
        }
        .scanner-bar {
            width: 100%; height: 2px; background: rgba(14, 165, 233, 0.8);
            box-shadow: 0 0 10px rgba(14, 165, 233, 0.8), 0 0 20px rgba(14, 165, 233, 0.4);
            position: absolute; top: 0; animation: scan 3s linear infinite;
        }
        .scanner-overlay.active { display: block; }
        @keyframes scan { 0% { top: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }

        /* General UI Elements */
        .btn {
          padding: 14px 28px;
          border-radius: 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--za-border);
          color: var(--za-text);
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn:hover { background: rgba(255,255,255,0.1); transform: translateY(-2px); }
        
        .btn.primary {
          background: var(--za-primary);
          border: none;
          color: #fff;
          box-shadow: 0 4px 16px rgba(14, 165, 233, 0.3);
        }
        .btn.primary:hover { box-shadow: 0 8px 24px rgba(14, 165, 233, 0.5); }
        
        .btn.danger {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.5);
          color: #fca5a5;
        }
        .btn.danger:hover { background: rgba(239, 68, 68, 0.2); box-shadow: 0 0 15px rgba(239, 68, 68, 0.3); color: #fff; }

        .secTitle {
          font-size: 1.2rem; font-weight: 800; color: #fff; margin-bottom: 24px;
          padding-left: 16px; border-left: 4px solid var(--za-primary);
        }

        .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 24px; }
        
        ha-textfield, ha-switch { width: 100%; display:block; margin-bottom: 12px; }
        
        .muted { color: var(--za-text-muted); font-size: 0.9rem; line-height: 1.6; }
        
        .footer {
          text-align: center;
          padding: 40px;
          color: var(--za-text-muted);
          font-size: 0.9rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          opacity: 0.6;
        }
        .footer a {
          color: var(--za-primary);
          text-decoration: none;
          font-weight: 800;
          text-shadow: 0 0 10px rgba(14, 165, 233, 0.4);
          transition: all 0.2s;
        }
        .footer a:hover {
          color: #fff;
          text-shadow: 0 0 15px var(--za-primary);
        }
        
        /* Pickers from before */
        .pickRow { display: grid; grid-template-columns: 1fr auto; gap: 12px; margin-top: 12px; }
        .pickBtn {
          width: 100%; text-align: left; padding: 16px; border-radius: 12px;
          border: 1px solid var(--za-border); 
          background: #06070a; /* Darker background */
          color: var(--za-text);
          cursor:pointer; font-weight: 600; transition: all 0.2s;
        }
        .pickBtn:hover { border-color: var(--za-primary); background: #000; }
        .btnAdd {
          padding: 16px 24px; border-radius: 12px; border: 1px solid var(--za-border);
          background: rgba(255,255,255,0.05); color: white; font-weight: 700; cursor: pointer; transition: all 0.2s;
        }
        .btnAdd:hover { background: rgba(255,255,255,0.1); }
        
        ha-textfield {
            --mdc-text-field-fill-color: #06070a;
            --mdc-text-field-ink-color: var(--za-text);
            --mdc-text-field-label-ink-color: var(--za-text-muted);
            --mdc-theme-primary: var(--za-primary);
            margin-bottom: 12px; display: block;
            border-radius: 8px;
        }
        
        .chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
        .chip {
          padding: 8px 16px; border-radius: 99px; background: rgba(14, 165, 233, 0.1);
          border: 1px solid rgba(14, 165, 233, 0.3); color: #bae6fd; font-weight: 600;
          display: flex; align-items: center; gap: 8px; font-size: 0.85rem;
        }
        .chip button { background:none; border:none; color:inherit; cursor:pointer; font-weight:900; }

        /* Modal */
        .modalBack {
          position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px);
          display: none; align-items: center; justify-content: center; z-index: 1000;
        }
        .modalBack.open { display: flex; }
        .modal {
          width: 600px; max-height: 80vh; background: #1a1b23; border: 1px solid var(--za-border);
          border-radius: 24px; display: flex; flex-direction: column; overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
        }
        .modalHead { padding: 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--za-border); }
        .modalBody { padding: 24px; overflow-y: auto; }
        .search {
          width: 100%; padding: 16px; border-radius: 12px; border: 1px solid var(--za-border);
          background: rgba(0,0,0,0.3); color: #fff; font-size: 1rem; outline: none;
        }
        .list { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
        .item { padding: 12px 16px; background: rgba(255,255,255,0.05); border-radius: 12px; cursor: pointer; }
        .item:hover { background: rgba(255,255,255,0.1); }
        .modalFoot { padding: 20px; border-top: 1px solid var(--za-border); display: flex; justify-content: flex-end; gap: 10px; }
      </style>

      <div class="bg-fx">
        <div class="bg-blob blob-1"></div>
        <div class="bg-blob blob-2"></div>
      </div>

      <div class="app-container">
        <!-- Navbar -->
        <div class="navbar">
          <div class="brand">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--za-primary)"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            <div>ZIG<span>ALARM</span></div>
          </div>
          <div class="nav-tabs">
            <button class="nav-item active" data-tab="dashboard">Übersicht</button>
            <button class="nav-item" data-tab="settings">Geräte & Config</button>
            <button class="nav-item" data-tab="info">Info / Hilfe</button>
          </div>
        </div>

        <!-- Main Content -->
        <div class="main-content">
          
          <!-- TAB: Dashboard -->
          <div id="tab-dashboard" class="tab-view active">
            <div class="dash-hero">
              <div>
                <h1 id="dashTitle" style="margin:0; font-size:2rem; font-weight:800;">Mein Dashboard</h1>
                <div class="muted">Live Status & Steuerung</div>
              </div>
              <div class="pill-hero" id="statePill">-</div>
            </div>

            <!-- Alarm Entity Selection (Hidden here but needed for logic, kept minimal) -->
            <div style="margin-bottom: 24px; display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.03); padding:12px; border-radius:12px; width:fit-content;">
               <div style="font-size:0.9rem; color:var(--za-text-muted);">Aktives System:</div>
               <select id="alarmEntitySel" style="background:transparent; border:none; color:#fff; font-weight:700; outline:none; cursor:pointer; min-width:150px;">
                  <option style="background:#1a1b23; color:white;">Lade...</option>
               </select>
            </div>

            <div class="card">
               <div class="secTitle">Steuerung</div>
               <div style="display:flex; gap:16px; flex-wrap:wrap;">
                 <button class="btn" id="btnHome" style="flex:1;">Zuhause</button>
                 <button class="btn" id="btnAway" style="flex:1;">Abwesend</button>
                 <button class="btn" id="btnDisarm" style="flex:1;">Unscharf</button>
                 <button class="btn danger" id="btnTrigger" style="flex:1;">ALARM</button>
               </div>
               <div class="muted" id="readyLine" style="margin-top:16px; text-align:center;"></div>
            </div>

            <div class="grid2">
              <div class="card" style="position:relative;">
                <div class="scanner-overlay" id="scannerOverlay"><div class="scanner-bar"></div></div>
                <div class="secTitle">Status</div>
                <div class="muted" id="statusLine"></div>
                <div class="muted" id="openSensorsText" style="margin-top:12px;"></div>
              </div>
              <!-- Placeholder for camera preview or quick stats -->
              <div class="card" id="camPreviewCard" style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:200px; padding: 16px;">
                 <div class="muted">Keine Kameras ausgewählt</div>
              </div>
            </div>
          </div>

          <!-- TAB: Settings -->
          <div id="tab-settings" class="tab-view">
             <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
                <h1 style="margin:0;">Konfiguration</h1>
                 <div style="display:flex; gap:12px;">
                   <button class="btn" id="reload">Reload</button>
                   <button class="btn success" id="save">SPEICHERN</button>
                 </div>
              </div>

             <div class="grid2">
                <div class="card">
                  <div class="secTitle">Allgemeines</div>
                  <div class="muted" style="margin-bottom:16px;">Grundlegende Einstellungen</div>
                  <ha-textfield label="Titel des Dashboards" id="dashTitleInput" style="width:100%"></ha-textfield>
                </div>
                <!-- Spacer for grid alignment if needed, or just let grid flow -->
                <div></div> 

                <div class="card">
                  <div class="secTitle">Sensoren</div>
                  <div class="muted" style="margin-bottom:16px;">Definiere, welche Sensoren den Alarm auslösen.</div>
                  ${this._pickerHtml("perimeter", "Außen (Tür/Fenster)")}
                  <div style="height:20px;"></div>
                  ${this._pickerHtml("motion", "Bewegung (Innen)")}
                  <div style="height:20px;"></div>
                  ${this._pickerHtml("always", "24/7 (Rauch / Wasser)")}
                  
                  <div style="margin-top:20px; border-top:1px solid var(--za-border); padding-top:16px;">
                     <div style="display:flex; align-items:center; justify-content:space-between;">
                        <span class="muted"><b>Scharfschalten erzwingen</b><br><small>Ignoriere offene Sensoren beim Schärfen</small></span>
                        <ha-switch id="forceArm"></ha-switch>
                     </div>
                  </div>
                </div>

                <div>
                   <div class="card">
                      <div class="secTitle">Zeiten</div>
                      <ha-textfield id="exitDelay" type="number" label="Ausgangsverzögerung (s)"></ha-textfield>
                      <ha-textfield id="entryDelay" type="number" label="Eingangsverzögerung (s)"></ha-textfield>
                      <ha-textfield id="triggerTime" type="number" label="Alarmdauer (s)"></ha-textfield>
                   </div>
                   
                   <div class="card">
                      <div class="secTitle">Ausgänge</div>
                      <div class="pickRow">
                        <button class="pickBtn" id="sirenPick">Sirene wählen...</button>
                        <button class="btnAdd" id="sirenClear">X</button>
                      </div>
                      <div class="chips" id="sirenChips"></div>
                      <div style="height:20px;"></div>
                      ${this._pickerHtml("alarmLights", "Alarm-Lichter")}
                      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px;">
                         <ha-textfield id="lightColor" label="Farbe (#RRGGBB)"></ha-textfield>
                         <ha-textfield id="lightBrightness" type="number" label="Helligkeit (1-255)"></ha-textfield>
                      </div>
                      <ha-textfield id="lightEffect" label="Lichteffekt" style="margin-top:12px;"></ha-textfield>
                      <div style="margin-top:12px; display:flex; gap:12px; align-items:center;">
                         <ha-switch id="lightRestore"></ha-switch>
                         <div class="muted">Licht wiederherstellen</div>
                      </div>
                   </div>
                </div>
             </div>
             
             <div class="card">
               <div class="secTitle">Kameras</div>
               ${this._pickerHtml("cams", "Kameras verknüpfen")}
               <div style="margin-top:16px; display:flex; gap:12px; align-items:center;">
                  <ha-switch id="camOnlyTrig"></ha-switch>
                  <div class="muted">Nur bei Alarm anzeigen</div>
               </div>
             </div>
          </div>

          <!-- TAB: Info -->
          <div id="tab-info" class="tab-view">
            <div class="card" style="text-align:center; padding:40px;">
              <h1 class="brand" style="justify-content:center; font-size:3rem; margin-bottom:10px;">ZIG<span>ALARM</span></h1>
              <div class="muted">Version 2.0.0 • Premium Edition</div>
              <div class="hint" id="hintLine" style="margin: 20px auto; max-width:400px; font-weight:bold;">System bereit.</div>
            </div>

            <div class="grid2">
              <div class="card">
                 <div class="secTitle">Wie funktioniert ZigAlarm?</div>
                 <p class="muted">
                   ZigAlarm verwandelt deine vorhandenen Sensoren (Zigbee, WLAN, etc.) in eine professionelle Alarmanlage.<br><br>
                   Das System überwacht permanent den Zustand aller Sensoren. Bevor du scharf schalten kannst, prüft die 
                   <b>Ready-to-Arm</b> Technologie, ob alle Fenster und Türen geschlossen sind. 
                   Ist ein Sensor offen, wird dies sofort im Dashboard angezeigt.
                 </p>
              </div>

              <div class="card">
                 <div class="secTitle">Sensor-Logik</div>
                 <div style="display:flex; flex-direction:column; gap:16px;">
                   <div>
                     <strong style="color:var(--za-primary)">Außen (Tür/Fenster)</strong>
                     <div class="muted">Sensoren an der Außenhaut des Gebäudes. Diese werden bei <b>Zuhause</b> UND <b>Abwesend</b> überwacht.</div>
                   </div>
                   <div>
                     <strong style="color:var(--za-primary)">Bewegung (Innen)</strong>
                     <div class="muted">Bewegungsmelder im Innenraum. Diese werden NUR bei <b>Abwesend</b> überwacht, damit du dich zuhause frei bewegen kannst.</div>
                   </div>
                   <div>
                     <strong style="color:var(--za-danger)">24/7 (Gefahr)</strong>
                     <div class="muted">Rauch-, Wasser- oder Gasmelder. Diese lösen <b>IMMER</b> Alarm aus, egal ob die Anlage scharf oder unscharf ist.</div>
                   </div>
                 </div>
              </div>
            </div>
            
            <div class="card">
              <div class="secTitle">Alarm-Ablauf</div>
              <p class="muted">
                1. <b>Auslösung:</b> Ein Sensor meldet Aktivität.<br>
                2. <b>Verzögerung:</b> Wenn konfiguriert, läuft erst die Eingangsverzögerung ab (Warnung).<br>
                3. <b>Alarm:</b> Die Sirene und Lichter werden aktiviert. Kameras senden Bilder.<br>
                4. <b>Reset:</b> Nach der Alarmdauer (Standard 180s) setzt sich das System zurück, bleibt aber scharf.
              </p>
            </div>

            <div class="card">
              <div class="secTitle">Premium Features</div>
              <div style="display:flex; flex-direction:column; gap:16px;">
                 <div>
                   <strong style="color:var(--za-primary)">Cyber-Scanner</strong>
                   <div class="muted">Visuelles Feedback beim Scharfschalten. Der Scanner im Dashboard zeigt aktive Überwachung an.</div>
                 </div>
                 <div>
                   <strong style="color:var(--za-accent)">Voice Feedback</strong>
                   <div class="muted">Das System spricht mit dir! Bestätigung bei Scharf/Unscharf ("System Armed") und Alarm.</div>
                 </div>
                  <div>
                   <strong style="color:var(--za-warning)">Erzwungener Modus</strong>
                   <div class="muted">Sensoren ignorieren und trotzdem scharfschalten (konfigurierbar unter Sensoren).</div>
                 </div>
              </div>
            </div>
          </div>

        </div>

        <div class="footer">Powered by <a href="https://openkairo.de" target="_blank">OPENKAIRO</a></div>

        <!-- Modals placed here -->
        <div class="modalBack" id="pickerBack">
           <div class="modal">
             <div class="modalHead">
               <div class="modalTitle" id="pickerTitle">Auswählen</div>
               <div class="rowRight"><button class="btn" id="pickerClose">Schließen</button></div>
             </div>
             <div class="modalBody">
                <input class="search" id="pickerSearch" placeholder="Suche..." />
                <div class="muted" id="pickerHint" style="margin-top:10px;"></div>
                <div class="list" id="pickerList"></div>
             </div>
             <div class="modalFoot">
               <div class="muted" id="pickerCount" style="margin-right:auto;"></div>
               <button class="btn" id="pickerClear">Leeren</button>
               <button class="btn primary" id="pickerDone">Fertig</button>
             </div>
           </div>
        </div>
      </div>
    `;

    // --- Logic for Tabs ---
    this.shadowRoot.querySelectorAll(".nav-item").forEach(btn => {
      btn.addEventListener("click", () => {
        // UI toggle
        this.shadowRoot.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // View toggle
        const tabId = btn.getAttribute("data-tab");
        this.shadowRoot.querySelectorAll(".tab-view").forEach(view => {
          view.classList.remove("active");
          if (view.id === `tab-${tabId}`) view.classList.add("active");
        });
        this._activeTab = tabId;
      });
    });

    // Re-attach existing event listeners for generic elements...
    this._$("reload").addEventListener("click", () => this._update());
    this._$("save").addEventListener("click", () => this._save());

    this._$("alarmEntitySel").addEventListener("change", () => {
      this._panelSelections = {};
      this._update();
    });

    // Alarm action buttons
    this._$("btnHome").addEventListener("click", () => this._arm("home"));
    this._$("btnAway").addEventListener("click", () => this._arm("away"));
    this._$("btnDisarm").addEventListener("click", () => this._disarm());
    this._$("btnTrigger").addEventListener("click", () => this._trigger());

    // Picker hooks
    this._hookPicker("perimeter", ["binary_sensor", "sensor", "event"], true, "Außen (Perimeter)");
    this._hookPicker("motion", ["binary_sensor", "sensor", "event"], true, "Bewegung (Motion)");
    this._hookPicker("always", ["binary_sensor", "sensor", "event"], true, "24/7 Sensoren");
    this._hookPicker("alarmLights", ["light"], true, "Alarm-Lichter");
    this._hookPicker("cams", ["camera"], true, "Kameras");

    // Siren
    this._$("sirenPick").addEventListener("click", () => {
      this._openPicker({
        key: "siren",
        multi: false,
        domains: ["siren", "switch", "light"],
        title: "Sirene auswählen",
      });
    });
    this._$("sirenClear").addEventListener("click", () => {
      this._panelSelections.siren = [];
      this._renderSirenChip();
    });

    // Modal events
    this._$("pickerClose").addEventListener("click", () => this._closePicker());
    this._$("pickerDone").addEventListener("click", () => this._closePicker());
    this._$("pickerBack").addEventListener("click", (e) => {
      if (e.target === this._$("pickerBack")) this._closePicker();
    });
    this._$("pickerSearch").addEventListener("input", () => this._renderPickerList());
    this._$("pickerSearch").addEventListener("keydown", (e) => {
      if (e.key === "Escape") this._closePicker();
      if (e.key === "Enter") {
        const first = this._root.querySelector(".item[data-eid]");
        if (first) first.click();
      }
    });
    this._$("pickerClear").addEventListener("click", () => {
      const k = this._currentPick?.key;
      if (!k) return;
      this._panelSelections[k] = [];
      if (k === "siren") this._renderSirenChip();
      else this._renderChips(k);
      this._renderPickerList();
    });
  }

  _pickerHtml(key, title) {
    return `
      <div>
        <div class="muted">${title}</div>
        <div class="pickRow">
          <button class="pickBtn" id="${key}Pick">Entität auswählen…</button>
          <button class="btnAdd" id="${key}Add">+ Hinzufügen</button>
        </div>
        <div class="chips" id="${key}Chips"></div>
      </div>
    `;
  }

  _hookPicker(key, domains, multi, title) {
    const pickBtn = this._$(`${key}Pick`);
    const addBtn = this._$(`${key}Add`);
    if (!pickBtn || !addBtn) return;

    const open = () => this._openPicker({ key, domains, multi, title });

    pickBtn.addEventListener("click", open);
    addBtn.addEventListener("click", open);
  }

  _openPicker({ key, domains, multi, title }) {
    this._currentPick = { key, domains, multi, title };
    const back = this._$("pickerBack");
    if (!back) return;

    this._$("pickerTitle").textContent = title || "Entität auswählen";
    this._$("pickerHint").textContent = multi ? "Mehrfachauswahl (klicken = hinzufügen)" : "Einzelauswahl (klicken = übernehmen)";
    this._$("pickerSearch").value = "";
    back.classList.add("open");
    back.setAttribute("aria-hidden", "false");

    // Render list
    this._renderPickerList();

    // Focus search
    setTimeout(() => this._$("pickerSearch")?.focus(), 50);
  }

  _closePicker() {
    const back = this._$("pickerBack");
    if (!back) return;
    back.classList.remove("open");
    back.setAttribute("aria-hidden", "true");
  }

  _renderPickerList() {
    const listEl = this._$("pickerList");
    const countEl = this._$("pickerCount");
    if (!listEl) return;

    const { key, domains, multi } = this._currentPick || {};
    if (!key || !this._hass) {
      listEl.innerHTML = "";
      if (countEl) countEl.textContent = "";
      return;
    }

    const q = (this._$("pickerSearch")?.value || "").trim().toLowerCase();

    const states = this._hass.states || {};
    const all = Object.keys(states).filter((eid) => domains.includes(byDomain(eid)));

    // basic search: entity_id or friendly_name contains q
    const filtered = q
      ? all.filter((eid) => {
        const fn = (states[eid]?.attributes?.friendly_name || "").toString().toLowerCase();
        return eid.toLowerCase().includes(q) || fn.includes(q);
      })
      : all;

    // limit for performance
    const limited = filtered.slice(0, 250);

    const selected = uniq(this._panelSelections?.[key] || []);

    listEl.innerHTML = limited
      .map((eid) => {
        const fn = (states[eid]?.attributes?.friendly_name || eid).toString();
        const isSel = selected.includes(eid);
        const mark = isSel ? " ✅" : "";
        return `
          <div class="item" data-eid="${eid}">
            <div class="name">${this._escape(fn)}${mark}</div>
            <div class="eid">${this._escape(eid)}</div>
          </div>
        `;
      })
      .join("");

    listEl.querySelectorAll(".item[data-eid]").forEach((el) => {
      el.addEventListener("click", () => {
        const eid = el.getAttribute("data-eid");
        if (!eid) return;

        if (multi) {
          const cur = uniq(this._panelSelections?.[key] || []);
          if (!cur.includes(eid)) cur.push(eid);
          this._panelSelections[key] = cur;
          this._renderChips(key);
          this._renderPickerList(); // refresh checkmarks
        } else {
          this._panelSelections[key] = [eid];
          this._renderSirenChip();
          this._closePicker();
        }
      });
    });

    if (countEl) {
      const total = filtered.length;
      const shown = limited.length;
      countEl.textContent = total === shown ? `${shown} Treffer` : `${shown} von ${total} Treffern`;
    }
  }

  _escape(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  _renderChips(key) {
    const host = this._$(`${key}Chips`);
    const pickBtn = this._$(`${key}Pick`);
    if (!host) return;

    const items = uniq(this._panelSelections?.[key] || []);
    host.innerHTML = items
      .map((eid) => {
        const fn = this._friendlyName(eid);
        return `
          <div class="chip">
            <span>${this._escape(fn)}</span>
            <span class="sub2">${this._escape(eid)}</span>
            <button title="Entfernen" data-eid="${eid}">✕</button>
          </div > `;
      })
      .join("");

    host.querySelectorAll("button[data-eid]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const eid = btn.getAttribute("data-eid");
        this._panelSelections[key] = (this._panelSelections[key] || []).filter((x) => x !== eid);
        this._renderChips(key);
      });
    });

    if (pickBtn) {
      pickBtn.textContent = items.length ? `${items.length} ausgewählt` : "Entität auswählen…";
    }
  }

  _renderSirenChip() {
    const host = this._$("sirenChips");
    const btn = this._$("sirenPick");
    if (!host) return;

    const items = uniq(this._panelSelections?.siren || []);
    const eid = items[0] || null;
    host.innerHTML = eid
      ? `
          < div class="chip" >
          <span>${this._escape(this._friendlyName(eid))}</span>
          <span class="sub2">${this._escape(eid)}</span>
          <button title="Entfernen" data-eid="${eid}">✕</button>
        </div > `
      : "";

    host.querySelectorAll("button[data-eid]").forEach((b) => {
      b.addEventListener("click", () => {
        this._panelSelections.siren = [];
        this._renderSirenChip();
      });
    });

    if (btn) btn.textContent = eid ? "Sirene ändern…" : "Entität auswählen…";
  }

  _getSelectedAlarmEntity() {
    const sel = this._$("alarmEntitySel");
    const val = (sel?.value || "").trim();
    if (val) return val;

    const list = this._findZigAlarmPanels();
    return list[0] || null;
  }

  _updateAlarmSelect() {
    const sel = this._$("alarmEntitySel");
    if (!sel || !this._hass) return;

    // Filter all alarm control panels
    const alarmList = Object.keys(this._hass.states)
      .filter(eid => eid.startsWith("alarm_control_panel."))
      .sort();

    const listStr = JSON.stringify(alarmList);
    if (this._lastAlarmList === listStr && sel.options.length > 0) {
      // List hasn't changed, but maybe selection is empty?
      if (!sel.value && alarmList.length > 0) sel.value = alarmList[0];
      return;
    }
    this._lastAlarmList = listStr;

    const current = (sel.value || "").trim();

    if (alarmList.length === 0) {
      sel.innerHTML = `<option value="" style="background:#1a1b23; color:white;">Keine Alarme gefunden</option>`;
      return;
    }

    sel.innerHTML = alarmList.map((eid) => `<option value="${eid}" style="background:#1a1b23; color:white;">${eid}</option>`).join("");

    if (current && alarmList.includes(current)) sel.value = current;
    else if (alarmList.length > 0) sel.value = alarmList[0];
  }

  async _arm(mode) {
    const alarm_entity = this._getSelectedAlarmEntity();
    if (!alarm_entity || !this._hass) return;

    const svc =
      mode === "home"
        ? "alarm_arm_home"
        : mode === "away"
          ? "alarm_arm_away"
          : null;
    if (!svc) return;

    try {
      await this._hass.callService("alarm_control_panel", svc, { entity_id: alarm_entity });
      this._setHint(mode === "home" ? "Zuhause scharf…" : "Abwesend scharf…");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("alarm arm failed", e);
      this._setHint("Fehler beim Scharfschalten ❌");
    }
  }

  async _disarm() {
    const alarm_entity = this._getSelectedAlarmEntity();
    if (!alarm_entity || !this._hass) return;

    try {
      await this._hass.callService("alarm_control_panel", "alarm_disarm", { entity_id: alarm_entity });
      this._setHint("Unscharf ✅");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("disarm failed", e);
      this._setHint("Fehler beim Unscharf ❌");
    }
  }

  async _trigger() {
    const alarm_entity = this._getSelectedAlarmEntity();
    if (!alarm_entity || !this._hass) return;

    try {
      await this._hass.callService("alarm_control_panel", "alarm_trigger", { entity_id: alarm_entity });
      this._setHint("Alarm ausgelöst ⚠️");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("trigger failed", e);
      this._setHint("Fehler beim Auslösen ❌");
    }
  }

  _update() {
    if (!this._root) return;
    if (!this._hass) {
      this._setHint("Warte auf Home Assistant…");
      return;
    }
    this._updateAlarmSelect();


    if (!this._panelSelections) this._panelSelections = {};

    const alarmList = this._findZigAlarmPanels();
    this._updateAlarmSelect(alarmList);

    const selected = this._getSelectedAlarmEntity();
    const st = selected ? this._hass.states[selected] : null;

    const pill = this._$("statePill");
    const status = this._$("statusLine");
    const readyLine = this._$("readyLine");

    if (!selected || !st) {
      if (pill) pill.textContent = "OFFLINE";
      this._setHint("Kein ZigAlarm System gefunden.");
      if (status) status.textContent = "Bitte Integration prüfen.";
      if (readyLine) readyLine.textContent = "";
      return;
    }

    const a = st.attributes || {};
    if (pill) {
      pill.textContent = stateToDE(st.state);
      pill.setAttribute("data-state", st.state);
    }

    // Ready indicator (de)
    const ready = (a.ready_to_arm_home && a.ready_to_arm_away)
      ? "SYSTEM BEREIT - ALLES OK"
      : "HINWEIS: SENSOREN GEÖFFNET";

    if (readyLine) {
      readyLine.textContent = ready;
      readyLine.style.color = (a.ready_to_arm_home && a.ready_to_arm_away) ? "var(--za-success)" : "var(--za-warning)";
    }

    this._setHint("System online und verbunden.");
    const hintEl = this._$("hintLine");
    if (hintEl) hintEl.classList.add("breathe");

    // Init selections from entity attributes only once (when empty)
    const ensure = (k, def) => {
      if (!Array.isArray(this._panelSelections[k]) || this._panelSelections[k].length === 0) {
        this._panelSelections[k] = uniq(def);
      }
    };

    ensure("perimeter", a.perimeter_sensors || []);
    ensure("motion", a.motion_sensors || []);
    ensure("always", a.always_sensors || []);
    ensure("alarmLights", a.alarm_lights || []);
    ensure("cams", a.camera_entities || []);
    if (!Array.isArray(this._panelSelections.siren) || this._panelSelections.siren.length === 0) {
      this._panelSelections.siren = a.siren_entity ? [a.siren_entity] : [];
    }


    // Dashboard Title
    const title = a.dashboard_title || "Mein Dashboard";
    const titleEl = this._$("dashTitle");
    if (titleEl) titleEl.textContent = title;
    setField("dashTitleInput", title);

    this._renderChips("perimeter");
    this._renderChips("motion");
    this._renderChips("always");
    this._renderChips("alarmLights");
    this._renderChips("cams");
    this._renderSirenChip();

    // HA fields
    const setField = (id, val) => {
      const el = this._$(id);
      if (!el) return;
      const v = String(val ?? "");
      if (String(el.value) !== v) el.value = v;
    };
    const setSwitch = (id, val) => {
      const el = this._$(id);
      if (!el) return;
      el.checked = !!val;
    };

    setField("lightColor", a.alarm_light_color || "#ff0000");
    setField("lightBrightness", a.alarm_light_brightness ?? 255);
    setField("lightEffect", a.alarm_light_effect ?? "");
    setSwitch("lightRestore", a.alarm_light_restore ?? true);

    setSwitch("camOnlyTrig", a.camera_show_only_triggered ?? false);
    setSwitch("forceArm", a.force_arm ?? false);

    setField("exitDelay", a.exit_delay ?? 5);
    setField("entryDelay", a.entry_delay ?? 5);
    setField("triggerTime", a.trigger_time ?? 180);

    // open sensors
    const open = a.open_sensors || [];
    const openText = this._$("openSensorsText");
    if (openText) {
      if (open.length > 0) {
        openText.innerHTML = `<span style="color:var(--za-warning)">AKTIVE SENSOREN:</span> <br/>${open.join(", ")}`;
      } else {
        openText.innerHTML = `<span style="color:var(--za-success)">ALLE SENSOREN GESCHLOSSEN</span>`;
      }
    }

    if (status) status.textContent = `Verbunden mit ${selected} `;

    // Update Camera Preview
    this._updateCamPreview(a.camera_entities || []);

    // Check for state change to trigger specific sounds
    if (this._lastState !== st.state) {
      if (st.state === "triggered") this._playSound("alarm");
      else if (st.state === "disarmed" && (this._lastState === "armed_home" || this._lastState === "armed_away" || this._lastState === "triggered")) this._playSound("disarm");
      else if (st.state === "armed_home" || st.state === "armed_away") this._playSound("arm");
      this._lastState = st.state;
    }

    // Scanner Activation
    const scanner = this._$("scannerOverlay");
    if (scanner) {
      if (st.state === "armed_home" || st.state === "armed_away") scanner.classList.add("active");
      else scanner.classList.remove("active");
    }
  }

  _playSound(type) {
    // Simple TTS cues
    const msg = {
      "arm": "System wird geschärft.",
      "disarm": "System entschärft. Willkommen.",
      "alarm": "Achtung! Alarm ausgelöst!"
    }[type];

    if (msg && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(msg);
      u.lang = "de-DE";
      u.rate = 1.0;
      window.speechSynthesis.speak(u);
    }
  }

  async _getHelpers() {
    if (this._helpers) return this._helpers;
    if (window.loadCardHelpers) {
      this._helpers = await window.loadCardHelpers();
      return this._helpers;
    }
    return null;
  }

  async _updateCamPreview(cams) {
    const card = this._$("camPreviewCard");
    if (!card) return;

    cams = cams.filter(Boolean);
    const camStr = JSON.stringify(cams.sort());
    if (this._lastCamStr === camStr && card.children.length > 0) return;
    this._lastCamStr = camStr;

    if (!cams || cams.length === 0) {
      card.innerHTML = `< div class="muted" > Keine Kameras ausgewählt</div > `;
      return;
    }

    const helpers = await this._getHelpers();
    if (!helpers) {
      card.innerHTML = `< div class="muted" > Fehler: Karten - Helfer nicht verfügbar</div > `;
      return;
    }

    card.innerHTML = "";

    // Create stack for multiple cameras or single card for one
    const config = {
      type: "vertical-stack",
      cards: cams.map(eid => ({
        type: "picture-entity",
        entity: eid,
        show_name: true,
        show_state: false,
        camera_view: "auto"
      }))
    };

    const el = helpers.createCardElement(config);
    el.hass = this._hass;
    card.appendChild(el);
  }

  async _save() {
    this._playSound("arm"); // Feedback for click
    if (!this._hass) {
      this._setHint("Kein hass verfügbar (bitte Seite neu laden).");
      return;
    }

    const alarm_entity = this._getSelectedAlarmEntity();
    if (!alarm_entity) {
      this._setHint("Keine Alarm-Entität ausgewählt.");
      return;
    }

    const siren_entity = (uniq(this._panelSelections?.siren || [])[0] || null);

    const data = {
      alarm_entity,

      perimeter_sensors: uniq(this._panelSelections?.perimeter || []),
      motion_sensors: uniq(this._panelSelections?.motion || []),
      always_sensors: uniq(this._panelSelections?.always || []),

      siren_entity,

      alarm_lights: uniq(this._panelSelections?.alarmLights || []),
      alarm_light_color: String(this._$("lightColor")?.value || "#ff0000"),
      alarm_light_brightness: Number(this._$("lightBrightness")?.value || 255),
      alarm_light_effect: String(this._$("lightEffect")?.value || ""),
      alarm_light_restore: !!this._$("lightRestore")?.checked,

      camera_entities: uniq(this._panelSelections?.cams || []),
      camera_show_only_triggered: !!this._$("camOnlyTrig")?.checked,
      force_arm: !!this._$("forceArm")?.checked,

      exit_delay: Number(this._$("exitDelay")?.value || 5),
      entry_delay: Number(this._$("entryDelay")?.value || 5),
      trigger_time: Number(this._$("triggerTime")?.value || 180),
      trigger_time: Number(this._$("triggerTime")?.value || 180),
      dashboard_title: String(this._$("dashTitleInput")?.value || "Mein Dashboard"),
    };

    try {
      await this._hass.callService("zigalarm", "set_config", data);
      this._setHint("Gespeichert ✅");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("zigalarm.set_config failed", e, data);
      this._setHint("Fehler beim Speichern ❌ (Konsole)");
      fireEvent(this, "hass-notification", { message: "ZigAlarm: Fehler beim Speichern (Konsole)" });
    }
  }
}

if (!customElements.get("zigalarm-panel")) {
  customElements.define("zigalarm-panel", ZigAlarmPanel);
}
