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
        :host { display:block; height:100%; }
        .wrap { padding: 16px; max-width: 980px; margin: 0 auto; }
        .head { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom: 14px; }
        .title { font-size: 1.3rem; font-weight: 900; letter-spacing:.2px; }
        .sub { opacity:.75; font-size:.95rem; margin-top: 3px; }

        .row { display:flex; gap:12px; flex-wrap:wrap; align-items:center; }
        .rowRight { display:flex; gap:10px; align-items:center; justify-content:flex-end; flex-wrap:wrap; }
        .card { padding: 14px; border-radius: 18px; border: 1px solid var(--divider-color); background: var(--card-background-color); }
        .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        .btn {
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid var(--divider-color);
          background: rgba(0,0,0,.08);
          cursor: pointer;
          font-weight: 900;
        }
        .btn.primary { background: var(--primary-color); border: none; color: var(--text-primary-color); }
        .btn.danger { background: rgba(255,70,70,.18); border: 1px solid rgba(255,70,70,.35); }
        .btn:disabled { opacity:.45; cursor:not-allowed; }

        .pill { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--divider-color); font-weight: 900; font-size: .78rem; text-transform: uppercase; opacity: .95; }
        .muted { opacity:.75; font-size:.9rem; line-height:1.4; }
        .secTitle { font-weight: 900; margin: 6px 0 2px; }

        .hint {
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px dashed var(--divider-color);
          opacity: .9;
        }

        /* "Entität auswählen" Button (ersetzt input/datalist) */
        .pickRow { display:grid; grid-template-columns: 1fr auto; gap: 10px; align-items:center; }
        .pickBtn {
          width: 100%;
          text-align:left;
          padding: 12px 12px;
          border-radius: 12px;
          border: 1px solid var(--divider-color);
          background: rgba(0,0,0,.08);
          color: var(--primary-text-color);
          cursor:pointer;
        }
        .pickBtn:hover { border-color: rgba(255,255,255,.18); }
        .btnAdd {
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid var(--divider-color);
          background: rgba(0,0,0,.08);
          cursor:pointer;
          font-weight: 900;
          white-space: nowrap;
        }

        .chips {
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin-top: 8px;
        }
        .chip {
          display:flex;
          align-items:center;
          gap:8px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--divider-color);
          background: rgba(0,0,0,.08);
          font-weight: 700;
          font-size: .85rem;
        }
        .chip .sub2 { opacity:.75; font-weight:600; font-size:.78rem; }
        .chip button{
          border:none;
          background: transparent;
          cursor:pointer;
          color: var(--primary-text-color);
          opacity: .8;
          font-weight: 900;
          padding: 0 2px;
        }
        .chip button:hover { opacity: 1; }

        /* HA Felder */
        ha-textfield, ha-switch { width: 100%; }

        /* Modal */
        .modalBack {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.55);
          display:none;
          align-items:center;
          justify-content:center;
          z-index: 9999;
        }
        .modalBack.open { display:flex; }
        .modal {
          width: min(760px, calc(100vw - 24px));
          max-height: min(80vh, 760px);
          overflow: hidden;
          border-radius: 18px;
          border: 1px solid var(--divider-color);
          background: var(--card-background-color);
          box-shadow: 0 10px 40px rgba(0,0,0,.55);
          display:flex;
          flex-direction:column;
        }
        .modalHead {
          padding: 12px 14px;
          display:flex;
          gap:10px;
          align-items:center;
          justify-content:space-between;
          border-bottom: 1px solid var(--divider-color);
        }
        .modalTitle { font-weight: 900; }
        .modalBody { padding: 12px 14px; overflow:auto; }
        .modalFoot {
          padding: 12px 14px;
          border-top: 1px solid var(--divider-color);
          display:flex;
          justify-content:space-between;
          gap:10px;
          align-items:center;
        }
        .search {
          width: 100%;
          box-sizing: border-box;
          padding: 12px 12px;
          border-radius: 12px;
          border: 1px solid var(--divider-color);
          background: rgba(0,0,0,.08);
          color: var(--primary-text-color);
          outline: none;
        }
        .search:focus { border-color: var(--primary-color); }
        .list {
          margin-top: 10px;
          display:flex;
          flex-direction:column;
          gap:8px;
        }
        .item {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--divider-color);
          background: rgba(0,0,0,.06);
          cursor:pointer;
          display:flex;
          flex-direction:column;
          gap:2px;
        }
        .item:hover { border-color: rgba(255,255,255,.18); }
        .item .name { font-weight: 900; }
        .item .eid { opacity:.75; font-size:.85rem; }
        .kBadge { opacity:.75; font-size:.85rem; }
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
