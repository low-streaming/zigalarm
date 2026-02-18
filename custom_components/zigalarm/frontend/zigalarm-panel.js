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
    this._setHint("Panel initialisiert…");
  }

  _$(id) {
    return this._root?.getElementById?.(id);
  }

  _setHint(txt) {
    const el = this._$("hintLine");
    if (el) el.textContent = txt;
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
    this._root.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          --za-primary: #3b82f6; /* Modern Blue */
          --za-primary-hover: #2563eb;
          --za-danger: #ef4444; 
          --za-bg-card: rgba(30, 30, 35, 0.6);
          --za-border: rgba(255, 255, 255, 0.08);
          --za-text: #e2e8f0;
          --za-text-muted: #94a3b8;
          --za-subtle-bg: rgba(255, 255, 255, 0.03);
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: var(--za-text);
          --card-background-color: var(--za-bg-card); /* Override HA default */
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

        .wrap {
          padding: 32px 24px;
          max-width: 1100px;
          margin: 0 auto;
          box-sizing: border-box;
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 32px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--za-border);
        }

        .title {
          font-size: 2rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          background: linear-gradient(135deg, #fff 0%, #cbd5e1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 4px;
        }

        .sub {
          color: var(--za-text-muted);
          font-size: 1rem;
          font-weight: 500;
        }

        .row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
        }

        .rowRight {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .card {
          padding: 28px;
          border-radius: 24px;
          border: 1px solid var(--za-border);
          background: var(--za-bg-card);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .card:hover {
          box-shadow: 0 12px 40px rgba(0,0,0,0.3);
          border-color: rgba(255,255,255,0.12);
        }

        .grid2 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 24px;
        }

        .btn {
          padding: 12px 24px;
          border-radius: 14px;
          border: 1px solid var(--za-border);
          background: var(--za-subtle-bg);
          color: var(--za-text);
          cursor: pointer;
          font-weight: 600;
          font-family: inherit;
          font-size: 0.95rem;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .btn.primary {
          background: linear-gradient(135deg, var(--za-primary) 0%, #2563eb 100%);
          border: none;
          color: white;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        .btn.primary:hover {
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.4);
        }

        .btn.danger {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #fca5a5;
          box-shadow: none;
        }

        .btn.danger:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.4);
          color: #fff;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
        }

        .pill {
          padding: 6px 14px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid var(--za-border);
          font-weight: 700;
          font-size: 0.8rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .muted { color: var(--za-text-muted); font-size: 0.9rem; line-height: 1.6; }

        .secTitle {
          font-weight: 700;
          font-size: 1.25rem;
          margin-bottom: 8px;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .secTitle::before {
          content: '';
          display: block;
          width: 4px;
          height: 20px;
          background: var(--za-primary);
          border-radius: 4px;
          box-shadow: 0 0 12px var(--za-primary);
        }

        .hint {
          margin-top: 16px;
          padding: 16px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px dashed var(--za-border);
          color: var(--za-text-muted);
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .pickRow {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
        }

        .pickBtn {
          width: 100%;
          text-align: left;
          padding: 14px 18px;
          border-radius: 14px;
          border: 1px solid var(--za-border);
          background: rgba(0, 0, 0, 0.2);
          color: var(--za-text);
          cursor: pointer;
          font-family: inherit;
          font-size: 0.95rem;
          transition: all 0.2s;
        }

        .pickBtn:hover {
          background: rgba(0, 0, 0, 0.3);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }

        .btnAdd {
          padding: 14px 20px;
          border-radius: 14px;
          border: 1px solid var(--za-border);
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          cursor: pointer;
          font-weight: 600;
          white-space: nowrap;
          transition: all 0.2s;
        }
        .btnAdd:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-1px);
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .chip {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          border-radius: 99px;
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #bfdbfe;
          font-weight: 600;
          font-size: 0.85rem;
          transition: all 0.2s;
        }

        .chip:hover {
          background: rgba(59, 130, 246, 0.25);
          border-color: rgba(59, 130, 246, 0.5);
          transform: scale(1.02);
        }

        .chip .sub2 {
          opacity: 0.6;
          font-size: 0.75rem;
          font-weight: 400;
        }

        .chip button {
          border: none;
          background: rgba(0,0,0,0.2);
          cursor: pointer;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          width: 20px;
          height: 20px;
          font-size: 12px;
          transition: all 0.2s;
        }
        .chip button:hover {
          background: rgba(255,255,255,0.3);
          transform: scale(1.1);
        }

        ha-textfield, ha-switch { width: 100%; }

        /* Modal */
        .modalBack {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .modalBack.open { display: flex; opacity: 1; }

        .modal {
          width: min(760px, calc(100vw - 32px));
          max-height: min(85vh, 800px);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: #1a1b20; /* Solid dark background to prevent bleed */
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          transform: scale(0.95) translateY(10px);
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          overflow: hidden;
        }
        
        .modalBack.open .modal { transform: scale(1) translateY(0); }

        .modalHead {
          padding: 20px 24px;
          display: flex;
          gap: 16px;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--za-border);
          background: rgba(255,255,255,0.02);
        }

        .modalTitle { font-weight: 800; font-size: 1.25rem; color: #fff; }

        .modalBody {
          padding: 24px;
          overflow-y: auto;
          background: var(--za-bg-card); /* Inner bg */
        }

        .modalFoot {
          padding: 20px 24px;
          border-top: 1px solid var(--za-border);
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          background: rgba(255,255,255,0.02);
        }

        .search {
          width: 100%;
          box-sizing: border-box;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid var(--za-border);
          background: rgba(0, 0, 0, 0.2);
          color: #fff;
          font-size: 1rem;
          outline: none;
          transition: all 0.2s;
        }
        .search:focus {
          border-color: var(--za-primary);
          background: rgba(0, 0, 0, 0.3);
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }

        .list {
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .item {
          padding: 14px 18px;
          border-radius: 12px;
          border: 1px solid transparent;
          background: rgba(255, 255, 255, 0.03);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 2px;
          transition: all 0.2s;
        }

        .item:hover {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.1);
          transform: translateX(4px);
        }

        .item .name { font-weight: 600; color: #f1f5f9; }
        .item .eid { opacity: 0.6; font-size: 0.85rem; font-family: monospace; color: #94a3b8; }
        .kBadge {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 8px;
          background: rgba(255,255,255,0.05);
          font-size: 0.8rem;
          color: #94a3b8;
        }
      </style>

      <div class="wrap">
        <div class="head">
          <div>
            <div class="title">ZigAlarm</div>
            <div class="sub">Konfiguration</div>
          </div>
          <div class="pill" id="statePill">-</div>
        </div>

        <div class="card">
          <div class="row" style="justify-content:space-between;">
            <div style="min-width: 320px; flex: 1;">
              <div class="muted" style="margin-bottom: 6px;">ZigAlarm Alarm-Entität (alarm_control_panel.*)</div>
              <select id="alarmEntitySel" class="search"></select>
              <div class="muted" style="margin-top:6px;">
                Wähle dein ZigAlarm-Panel aus. Danach kannst du alles hier konfigurieren.
              </div>
            </div>

            <div class="rowRight">
              <button class="btn" id="reload">Aktualisieren</button>
              <button class="btn primary" id="save">Speichern</button>
            </div>
          </div>

          <div style="height: 10px;"></div>

          <div class="row" style="justify-content:space-between;">
            <div class="row" style="gap:10px;">
              <button class="btn" id="btnHome">Zuhause scharf</button>
              <button class="btn" id="btnAway">Abwesend scharf</button>
              <button class="btn" id="btnDisarm">Unscharf</button>
              <button class="btn danger" id="btnTrigger">Alarm auslösen</button>
            </div>
            <div class="muted" id="readyLine"></div>
          </div>

          <div class="hint" id="hintLine">Panel lädt…</div>
        </div>

        <div style="height: 12px;"></div>

        <div class="grid2">
          <div class="card">
            <div class="secTitle">Sensoren</div>
            <div class="muted">Außen/Bewegung/24-7. Leere Auswahl löscht die Liste.</div>

            <div style="margin-top: 12px;">
              ${this._pickerHtml("perimeter", "Außen(Tür/Fenster / Perimeter)")}
              <div style="height: 12px;"></div>
              ${this._pickerHtml("motion", "Bewegung (PIR / Motion)")}
              <div style="height: 12px;"></div>
              ${this._pickerHtml("always", "24/7 (Rauch/Wasser/Tamper)")}
            </div>
          </div>

          <div class="card">
            <div class="secTitle">Zeiten</div>
            <div class="muted">Ein-/Ausgangsverzögerung und Alarmdauer.</div>
            <div class="grid2" style="margin-top: 10px;">
              <ha-textfield id="exitDelay" type="number" label="Ausgangsverzögerung (s)"></ha-textfield>
              <ha-textfield id="entryDelay" type="number" label="Eingangsverzögerung (s)"></ha-textfield>
            </div>
            <div style="margin-top: 10px;">
              <ha-textfield id="triggerTime" type="number" label="Alarmdauer (s)"></ha-textfield>
            </div>
          </div>
        </div>

        <div style="height: 12px;"></div>

        <div class="grid2">
          <div class="card">
            <div class="secTitle">Ausgänge</div>
            <div class="muted">Sirene und Alarm-Lichter.</div>

            <div style="margin-top: 10px;">
              <div class="muted">Sirene (optional)</div>
              <div class="pickRow">
                <button class="pickBtn" id="sirenPick">Entität auswählen…</button>
                <button class="btnAdd" id="sirenClear">Leeren</button>
              </div>
              <div class="chips" id="sirenChips"></div>

              <div style="height: 12px;"></div>
              ${this._pickerHtml("alarmLights", "Alarm-Lichter (light.*)")}

              <div style="height: 12px;"></div>
              <div class="grid2">
                <ha-textfield id="lightColor" label="Farbe (Hex, z.B. #ff0000)"></ha-textfield>
                <ha-textfield id="lightBrightness" type="number" label="Helligkeit (1..255)"></ha-textfield>
              </div>
              <div style="height: 10px;"></div>
              <ha-textfield id="lightEffect" label="Effekt (optional)"></ha-textfield>
              <div style="height: 10px;"></div>
              <ha-switch id="lightRestore"></ha-switch>
              <div class="muted">Lichtzustände bei Unscharf wiederherstellen</div>
            </div>
          </div>

          <div class="card">
            <div class="secTitle">Kameras</div>
            <div class="muted">Optional: Kameras verknüpfen.</div>

            <div style="margin-top: 12px;">
              ${this._pickerHtml("cams", "Kameras (camera.*)")}

              <div style="height: 10px;"></div>
              <ha-switch id="camOnlyTrig"></ha-switch>
              <div class="muted">Nur bei Alarm (Trigger) anzeigen</div>

              <div class="muted" id="openSensorsText" style="margin-top: 8px;"></div>
            </div>
          </div>
        </div>

        <div style="height: 14px;"></div>
        <div class="muted" id="statusLine"></div>
      </div>

      <!-- Modal Picker -->
      <div class="modalBack" id="pickerBack" aria-hidden="true">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modalHead">
            <div>
              <div class="modalTitle" id="pickerTitle">Entität auswählen</div>
              <div class="kBadge" id="pickerHint"></div>
            </div>
            <div class="rowRight">
              <button class="btn" id="pickerClose">Schließen</button>
            </div>
          </div>
          <div class="modalBody">
            <input id="pickerSearch" class="search" type="text" placeholder="Suchen (Name oder entity_id)…" />
            <div class="list" id="pickerList"></div>
          </div>
          <div class="modalFoot">
            <div class="muted" id="pickerCount"></div>
            <div class="rowRight">
              <button class="btn" id="pickerClear">Leeren</button>
              <button class="btn primary" id="pickerDone">Fertig</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Defaults
    if (!this._panelSelections) this._panelSelections = {};
    this._currentPick = { key: null, multi: true, domains: [], title: "" };

    // Buttons
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
    this._hookPicker("perimeter", ["binary_sensor", "sensor", "event"], true, "Außenhaut (Perimeter) – Entität auswählen");
    this._hookPicker("motion", ["binary_sensor", "sensor", "event"], true, "Bewegung (Motion) – Entität auswählen");
    this._hookPicker("always", ["binary_sensor", "sensor", "event"], true, "24/7 – Entität auswählen");
    this._hookPicker("alarmLights", ["light"], true, "Alarm-Lichter – Entität auswählen");
    this._hookPicker("cams", ["camera"], true, "Kameras – Entität auswählen");

    // Siren is single
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
        // select first visible item
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
          </div>`;
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
        <div class="chip">
          <span>${this._escape(this._friendlyName(eid))}</span>
          <span class="sub2">${this._escape(eid)}</span>
          <button title="Entfernen" data-eid="${eid}">✕</button>
        </div>`
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

  _updateAlarmSelect(alarmList) {
    const sel = this._$("alarmEntitySel");
    if (!sel) return;

    const current = (sel.value || "").trim();
    sel.innerHTML = alarmList.map((eid) => `<option value="${eid}">${eid}</option>`).join("");

    if (current && alarmList.includes(current)) sel.value = current;
    else if (alarmList[0]) sel.value = alarmList[0];
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

    if (!this._panelSelections) this._panelSelections = {};

    const alarmList = this._findZigAlarmPanels();
    this._updateAlarmSelect(alarmList);

    const selected = this._getSelectedAlarmEntity();
    const st = selected ? this._hass.states[selected] : null;

    const pill = this._$("statePill");
    const status = this._$("statusLine");
    const readyLine = this._$("readyLine");

    if (!selected || !st) {
      if (pill) pill.textContent = "KEINE ENTITÄT";
      this._setHint("Kein ZigAlarm alarm_control_panel gefunden. Integration/Entity prüfen.");
      if (status) status.textContent = "Tipp: Entwicklerwerkzeuge → Zustände → alarm_control_panel.zigalarm";
      if (readyLine) readyLine.textContent = "";
      return;
    }

    const a = st.attributes || {};
    if (pill) pill.textContent = stateToDE(st.state);

    // Ready indicator (de)
    const ready = (a.ready_to_arm_home && a.ready_to_arm_away) ? "Bereit zum Scharfschalten ✅" : "Nicht bereit ⚠️";
    if (readyLine) readyLine.textContent = ready;

    this._setHint("Entität gefunden ✅");

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

    setField("exitDelay", a.exit_delay ?? 30);
    setField("entryDelay", a.entry_delay ?? 30);
    setField("triggerTime", a.trigger_time ?? 180);

    // open sensors
    const open = a.open_sensors || [];
    const openText = this._$("openSensorsText");
    if (openText) openText.textContent = open.length ? `Offen gerade: ${open.join(", ")}` : "Offen gerade: keine";

    if (status) status.textContent = `Aktiv: ${selected} | gefunden: ${alarmList.length}`;
  }

  async _save() {
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

      exit_delay: Number(this._$("exitDelay")?.value || 30),
      entry_delay: Number(this._$("entryDelay")?.value || 30),
      trigger_time: Number(this._$("triggerTime")?.value || 180),
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
