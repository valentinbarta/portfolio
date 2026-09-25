/**
 * Boecia Talent CRM – Google Sheets data layer (runs in the browser).
 *
 * Talks to the Sheets REST API with the signed-in user's own token, so access is
 * exactly the sheet's sharing settings. There is no server and no secret.
 *
 * Rows are identified by "Submission ID", never by row number: Tally keeps appending
 * and rows get deleted, so every write looks the row up again first.
 * Columns are found by header name, so reordering columns in the sheet is safe.
 */

export const CONFIG = {
  LISTS_SHEET: 'Lists',
  ID_HEADER: 'Submission ID',
  RECEIVED_HEADER: 'Received',
  FORM_HEADER: 'Form',
  READ_ONLY: ['Received', 'Submission ID', 'Form'],
  DATE_FIELDS: ['Next step date'],
  DATE_FORMAT: 'd mmm yyyy',
  RECEIVED_FORMAT: 'd mmm yyyy, hh:mm',
  TABS: {
    Candidates: { sheet: 'Candidates', stageHeader: 'Stage', stageList: 'Candidate stages' },
    Leads: { sheet: 'Leads', stageHeader: 'Stage', stageList: 'Lead stages' },
    Contact: { sheet: 'Contact', stageHeader: 'Status', stageList: 'Contact status' },
  },
};

const API = 'https://sheets.googleapis.com/v4/spreadsheets/';
const DAY_MS = 86400000;
const SERIAL_EPOCH_OFFSET = 25569; // days from 1899-12-30 (Sheets day 0) to 1970-01-01

export class SheetsError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/* ------------------------------------------------------------ small helpers */

export function colLetter(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function quote(title) {
  return "'" + String(title).replace(/'/g, "''") + "'";
}

/** Sheets date serial -> "yyyy-mm-dd" (the sheet's wall-clock date, whatever our time zone). */
export function serialToIso(serial) {
  const d = new Date(Math.round((serial - SERIAL_EPOCH_OFFSET) * DAY_MS));
  return d.toISOString().slice(0, 10);
}

function serialToTs(serial) {
  return Math.round((serial - SERIAL_EPOCH_OFFSET) * DAY_MS);
}

/** Keep typed text from being read as a formula; plain numbers still go through as numbers. */
export function safeText(value) {
  const v = String(value);
  if (/^[=+\-@]/.test(v) && !/^[+-]?\d[\d.,]*$/.test(v)) return "'" + v;
  return v;
}

function isBlankRow(row) {
  return row.every((v) => String(v ?? '').trim() === '');
}

function pad(row, n) {
  const out = (row || []).slice(0, n);
  while (out.length < n) out.push('');
  return out;
}

function stamp(d) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function checkDate(value) {
  const v = String(value ?? '').trim();
  if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new SheetsError('Dates must look like 2026-10-01', 'invalid');
  return v;
}

/* ------------------------------------------------------------------ client */

export function createSheetsClient({
  spreadsheetId,
  getToken,
  onUnauthorized = () => {},
  fetch: fetchImpl = (...a) => globalThis.fetch(...a),
  now = () => new Date(),
  newId = () => 'M-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8),
}) {
  let meta = null; // { url, sheets: { title: sheetId } }

  async function request(method, path, body) {
    const token = await getToken();
    const res = await fetchImpl(API + encodeURIComponent(spreadsheetId) + path, {
      method,
      headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return res.status === 204 ? null : res.json();

    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch { /* not json */ }
    if (res.status === 401) {
      onUnauthorized();
      throw new SheetsError('Your Google session expired. Reconnect to continue.', 'auth', 401);
    }
    if (res.status === 403 && /has not been used|is disabled|SERVICE_DISABLED/i.test(detail)) {
      throw new SheetsError('The Google Sheets API is not enabled in your Google Cloud project yet (README, step 1).', 'setup', 403);
    }
    if (res.status === 403) {
      throw new SheetsError("This Google account doesn't have access to the Boecia CRM sheet. Ask the owner to share it with you.", 'forbidden', 403);
    }
    if (res.status === 404) throw new SheetsError('CRM sheet not found. Check SPREADSHEET_ID in config.js.', 'not_found', 404);
    if (res.status === 429) throw new SheetsError('Google is limiting requests. Wait a minute and try again.', 'rate', 429);
    throw new SheetsError(detail || `Google Sheets error (${res.status})`, 'api', res.status);
  }

  async function getMeta(force) {
    if (meta && !force) return meta;
    const r = await request('GET', '?fields=spreadsheetUrl,sheets.properties(sheetId,title)');
    const sheets = {};
    for (const s of r.sheets || []) sheets[s.properties.title] = s.properties.sheetId;
    meta = { url: r.spreadsheetUrl, sheets };
    return meta;
  }

  function batchGet(ranges, raw) {
    const q = ranges.map((r) => 'ranges=' + encodeURIComponent(r)).join('&');
    const opts = raw
      ? '&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER'
      : '&valueRenderOption=FORMATTED_VALUE';
    return request('GET', '/values:batchGet?' + q + opts + '&majorDimension=ROWS').then((r) =>
      (r.valueRanges || []).map((vr) => vr.values || []));
  }

  function writeCells(data) {
    if (!data.length) return Promise.resolve();
    return request('POST', '/values:batchUpdate', { valueInputOption: 'USER_ENTERED', data });
  }

  function formatCells(sheetId, cells) {
    if (!cells.length) return Promise.resolve();
    return request('POST', ':batchUpdate', {
      requests: cells.map(({ row, col, pattern }) => ({
        repeatCell: {
          range: { sheetId, startRowIndex: row - 1, endRowIndex: row, startColumnIndex: col, endColumnIndex: col + 1 },
          cell: { userEnteredFormat: { numberFormat: { type: /h/.test(pattern) ? 'DATE_TIME' : 'DATE', pattern } } },
          fields: 'userEnteredFormat.numberFormat',
        },
      })),
    });
  }

  function tabConfig(tab) {
    const cfg = CONFIG.TABS[tab];
    if (!cfg) throw new SheetsError(`Unknown tab "${tab}"`, 'invalid');
    return cfg;
  }

  /** Headers, stages and every row (formatted + raw) of one tab. */
  async function readTab(tab) {
    const cfg = tabConfig(tab);
    const m = await getMeta();
    if (!(cfg.sheet in m.sheets)) throw new SheetsError(`Sheet "${cfg.sheet}" not found`, 'not_found');
    const [[shown, lists], [raw]] = await Promise.all([
      batchGet([quote(cfg.sheet), quote(CONFIG.LISTS_SHEET)], false),
      batchGet([quote(cfg.sheet)], true),
    ]);

    const headers = (shown[0] || []).map((h) => String(h).trim());
    while (headers.length && !headers[headers.length - 1]) headers.pop();
    if (!headers.includes(CONFIG.ID_HEADER)) throw new SheetsError(`"${cfg.sheet}" has no "${CONFIG.ID_HEADER}" column`, 'setup');
    if (!headers.includes(cfg.stageHeader)) throw new SheetsError(`"${cfg.sheet}" has no "${cfg.stageHeader}" column`, 'setup');

    const listHead = (lists[0] || []).map((h) => String(h).trim());
    const lc = listHead.indexOf(cfg.stageList);
    const stages = [];
    if (lc !== -1) {
      for (let i = 1; i < lists.length; i++) {
        const v = String((lists[i] || [])[lc] ?? '').trim();
        if (!v) break;
        stages.push(v);
      }
    }

    const n = headers.length;
    const rows = [];
    for (let i = 1; i < Math.max(shown.length, raw.length); i++) {
      rows.push({ rowNum: i + 1, shown: pad(shown[i], n), raw: pad(raw[i], n) });
    }
    return { cfg, meta: m, sheetId: m.sheets[cfg.sheet], headers, stages, rows };
  }

  function serialize(t, r) {
    const values = {};
    let receivedTs = null;
    t.headers.forEach((h, c) => {
      const raw = r.raw[c];
      if (CONFIG.DATE_FIELDS.includes(h) && typeof raw === 'number') values[h] = serialToIso(raw);
      else values[h] = String(r.shown[c] ?? '');
      if (h === CONFIG.RECEIVED_HEADER && typeof raw === 'number') receivedTs = serialToTs(raw);
    });
    return { id: values[CONFIG.ID_HEADER], values, receivedTs };
  }

  async function findRow(tab, id) {
    const t = await readTab(tab);
    const idCol = t.headers.indexOf(CONFIG.ID_HEADER);
    const r = id ? t.rows.find((x) => String(x.shown[idCol]).trim() === String(id)) : null;
    if (!r) throw new SheetsError('Row not found. It may have been deleted. Refresh and try again.', 'not_found');
    return { t, r };
  }

  async function readRow(tab, rowNum) {
    const t = await readTab(tab);
    const r = t.rows.find((x) => x.rowNum === rowNum);
    if (!r) throw new SheetsError('Row not found after saving. Refresh to see it.', 'not_found');
    return serialize(t, r);
  }

  function cellRange(t, rowNum, col) {
    return quote(t.cfg.sheet) + '!' + colLetter(col) + rowNum;
  }

  /* ---------------------------------------------------------- public API */

  async function getData(tab) {
    let t = await readTab(tab);
    const idCol = t.headers.indexOf(CONFIG.ID_HEADER);

    // Rows typed straight into the sheet have no Submission ID; give them one so they can be edited.
    const missing = t.rows.filter((r) => !isBlankRow(r.shown) && !String(r.shown[idCol]).trim());
    if (missing.length) {
      await request('POST', '/values:batchUpdate', {
        valueInputOption: 'RAW',
        data: missing.map((r) => ({ range: cellRange(t, r.rowNum, idCol), values: [[newId()]] })),
      });
      t = await readTab(tab);
    }

    return {
      tab,
      headers: t.headers,
      stageHeader: t.cfg.stageHeader,
      stages: t.stages,
      readOnly: CONFIG.READ_ONLY,
      dateFields: CONFIG.DATE_FIELDS,
      rows: t.rows.filter((r) => !isBlankRow(r.shown)).map((r) => serialize(t, r)),
      sheetUrl: (t.meta.url || 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit') + '#gid=' + t.sheetId,
    };
  }

  /** Write the changed fields of one row. `patch` maps header -> new value (string). */
  async function updateRow(tab, id, patch) {
    const { t, r } = await findRow(tab, id);
    const data = [];
    const dates = [];
    for (const header of Object.keys(patch || {})) {
      const col = t.headers.indexOf(header);
      if (col === -1) throw new SheetsError(`Unknown column "${header}"`, 'invalid');
      if (CONFIG.READ_ONLY.includes(header)) throw new SheetsError(`"${header}" cannot be edited`, 'invalid');
      let value = patch[header] == null ? '' : String(patch[header]);
      if (header === t.cfg.stageHeader && !t.stages.includes(value)) {
        throw new SheetsError(`"${value}" is not a valid ${header.toLowerCase()}`, 'invalid');
      }
      if (CONFIG.DATE_FIELDS.includes(header)) {
        value = checkDate(value);
        if (value) dates.push({ row: r.rowNum, col, pattern: CONFIG.DATE_FORMAT });
      } else {
        value = safeText(value);
      }
      data.push({ range: cellRange(t, r.rowNum, col), values: [[value]] });
    }
    await writeCells(data);
    await formatCells(t.sheetId, dates);
    return readRow(tab, r.rowNum);
  }

  function moveRow(tab, id, stage) {
    return updateRow(tab, id, { [tabConfig(tab).stageHeader]: stage });
  }

  /** Copy the row to "Archive · <tab>" and remove it from the tab. */
  async function deleteRow(tab, id) {
    const { t, r } = await findRow(tab, id);
    const name = 'Archive · ' + t.cfg.sheet;

    if (!(name in t.meta.sheets)) {
      await request('POST', ':batchUpdate', {
        requests: [{ addSheet: { properties: { title: name, gridProperties: { frozenRowCount: 1 } } } }],
      });
      await request('PUT', '/values/' + encodeURIComponent(quote(name) + '!A1') + '?valueInputOption=RAW', {
        values: [['Deleted at', ...t.headers]],
      });
      await getMeta(true);
    }
    await request('POST', '/values/' + encodeURIComponent(quote(name) + '!A1') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {
      values: [[stamp(now()), ...r.shown]],
    });

    // Look the row up again right before removing it, in case rows moved meanwhile.
    const again = await findRow(tab, id);
    await request('POST', ':batchUpdate', {
      requests: [{
        deleteDimension: {
          range: { sheetId: again.t.sheetId, dimension: 'ROWS', startIndex: again.r.rowNum - 1, endIndex: again.r.rowNum },
        },
      }],
    });
    return { id, archivedTo: name };
  }

  /** Add a row by hand (e.g. a LinkedIn contact who replied becomes a Lead). */
  async function createRow(tab, data = {}) {
    const t = await readTab(tab);
    const stage = data[t.cfg.stageHeader] || t.stages[0] || '';
    if (t.stages.length && !t.stages.includes(stage)) {
      throw new SheetsError(`"${stage}" is not a valid ${t.cfg.stageHeader.toLowerCase()}`, 'invalid');
    }

    const id = newId();
    const formats = [];
    const row = t.headers.map((h, col) => {
      if (h === CONFIG.RECEIVED_HEADER) { formats.push({ col, pattern: CONFIG.RECEIVED_FORMAT }); return stamp(now()); }
      if (h === CONFIG.ID_HEADER) return id;
      if (h === CONFIG.FORM_HEADER) return 'Manual';
      if (h === t.cfg.stageHeader) return stage;
      const value = data[h] == null ? '' : String(data[h]);
      if (CONFIG.DATE_FIELDS.includes(h)) {
        const d = checkDate(value);
        if (d) formats.push({ col, pattern: CONFIG.DATE_FORMAT });
        return d;
      }
      return safeText(value);
    });

    const res = await request('POST', '/values/' + encodeURIComponent(quote(t.cfg.sheet) + '!A1') + ':append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS&includeValuesInResponse=false', {
      values: [row],
    });
    const m = /![A-Z]+(\d+)/.exec(res?.updates?.updatedRange || '');
    const rowNum = m ? Number(m[1]) : (await findRow(tab, id)).r.rowNum;
    await formatCells(t.sheetId, formats.map((f) => ({ ...f, row: rowNum })));
    return readRow(tab, rowNum);
  }

  return { getData, updateRow, moveRow, deleteRow, createRow };
}
