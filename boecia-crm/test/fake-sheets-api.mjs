// In-memory stand-in for the parts of the Google Sheets REST API (v4) that sheets.js uses.
// Values are stored the way Sheets stores them: text as strings, numbers and dates as numbers
// (dates as serial days since 1899-12-30).

const SERIAL_EPOCH_OFFSET = 25569;

function parseA1(range) {
  const m = /^'((?:[^']|'')+)'(?:!([A-Z]+)(\d+))?$/.exec(range) || /^([^!]+)(?:!([A-Z]+)(\d+))?$/.exec(range);
  if (!m) throw new Error('Bad range ' + range);
  const title = m[1].replace(/''/g, "'");
  let col = 0;
  if (m[2]) for (const ch of m[2]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { title, row: m[3] ? Number(m[3]) : 1, col: m[2] ? col - 1 : 0 };
}

function isoToSerial(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  return ms / 86400000 + SERIAL_EPOCH_OFFSET;
}

function userEntered(v) {
  if (typeof v !== 'string') return v;
  if (v.startsWith("'")) return v.slice(1);
  if (v.startsWith('=')) return { formula: v };
  const serial = isoToSerial(v);
  if (serial != null) return serial;
  if (/^[+-]?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function trimRows(rows) {
  const out = rows.map((r) => {
    const x = r.slice();
    while (x.length && (x[x.length - 1] === '' || x[x.length - 1] == null)) x.pop();
    return x;
  });
  while (out.length && out[out.length - 1].length === 0) out.pop();
  return out;
}

export class FakeSheetsApi {
  constructor(sheets) {
    this.sheets = sheets.map(([title, rows], i) => ({ title, sheetId: i * 10, data: rows.map((r) => r.slice()), formats: {} }));
    this.calls = [];
    this.failNext = null; // { status, message }
    this.fetch = this.fetch.bind(this);
  }

  sheet(title) {
    const s = this.sheets.find((x) => x.title === title);
    if (!s) throw Object.assign(new Error('Unable to parse range: ' + title), { status: 400 });
    return s;
  }

  get(title, row, col) { return (this.sheet(title).data[row - 1] || [])[col - 1] ?? ''; }

  display(sheet, v, row, col) {
    const fmt = sheet.formats[`${row}:${col}`];
    if (typeof v === 'number' && fmt) {
      const d = new Date(Math.round((v - SERIAL_EPOCH_OFFSET) * 86400000));
      return fmt.type === 'DATE' ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 16).replace('T', ' ');
    }
    if (v && typeof v === 'object' && v.formula) return '#FORMULA';
    return v == null ? '' : String(v);
  }

  write(sheet, row, col, value) {
    while (sheet.data.length < row) sheet.data.push([]);
    const r = sheet.data[row - 1];
    while (r.length < col) r.push('');
    r[col] = value;
  }

  async fetch(url, init = {}) {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname.replace(/^\/v4\/spreadsheets\/[^/:]+/, ''));
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    this.calls.push({ method, path, search: u.search, body, auth: init.headers?.Authorization });

    if (this.failNext) {
      const { status, message } = this.failNext;
      this.failNext = null;
      return json(status, { error: { code: status, message: message || 'error' } });
    }
    try {
      return json(200, this.handle(method, path, u.searchParams, body));
    } catch (e) {
      return json(e.status || 500, { error: { message: e.message } });
    }
  }

  handle(method, path, q, body) {
    if (method === 'GET' && path === '') {
      return {
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/TEST/edit',
        sheets: this.sheets.map((s) => ({ properties: { sheetId: s.sheetId, title: s.title } })),
      };
    }
    if (method === 'GET' && path === '/values:batchGet') {
      const raw = q.get('valueRenderOption') === 'UNFORMATTED_VALUE';
      return {
        valueRanges: q.getAll('ranges').map((range) => {
          const s = this.sheet(parseA1(range).title);
          const values = trimRows(s.data.map((r, ri) => r.map((v, ci) =>
            raw ? (v && typeof v === 'object' ? '#FORMULA' : v) : this.display(s, v, ri + 1, ci))));
          return { range, values };
        }),
      };
    }
    if (method === 'POST' && path === '/values:batchUpdate') {
      for (const d of body.data) {
        const a = parseA1(d.range);
        const v = d.values[0][0];
        this.write(this.sheet(a.title), a.row, a.col, body.valueInputOption === 'RAW' ? v : userEntered(v));
      }
      return {};
    }
    if (method === 'PUT' && path.startsWith('/values/')) {
      const a = parseA1(path.slice('/values/'.length));
      const s = this.sheet(a.title);
      body.values.forEach((row, i) => row.forEach((v, c) => this.write(s, a.row + i, a.col + c, v)));
      return {};
    }
    if (method === 'POST' && path.startsWith('/values/') && path.endsWith(':append')) {
      const a = parseA1(path.slice('/values/'.length, -':append'.length));
      const s = this.sheet(a.title);
      const rowNum = trimRows(s.data).length + 1;
      const userEnt = q.get('valueInputOption') === 'USER_ENTERED';
      body.values[0].forEach((v, c) => this.write(s, rowNum, c, userEnt ? userEntered(v) : v));
      return { updates: { updatedRange: `'${s.title}'!A${rowNum}:Z${rowNum}` } };
    }
    if (method === 'POST' && path === ':batchUpdate') {
      for (const r of body.requests) {
        if (r.addSheet) {
          this.sheets.push({ title: r.addSheet.properties.title, sheetId: 1000 + this.sheets.length, data: [], formats: {} });
        } else if (r.deleteDimension) {
          const { sheetId, startIndex, endIndex } = r.deleteDimension.range;
          this.sheets.find((s) => s.sheetId === sheetId).data.splice(startIndex, endIndex - startIndex);
        } else if (r.repeatCell) {
          const { sheetId, startRowIndex, startColumnIndex } = r.repeatCell.range;
          const s = this.sheets.find((x) => x.sheetId === sheetId);
          s.formats[`${startRowIndex + 1}:${startColumnIndex}`] = r.repeatCell.cell.userEnteredFormat.numberFormat;
        } else {
          throw new Error('Unsupported request ' + Object.keys(r));
        }
      }
      return {};
    }
    throw Object.assign(new Error(`Unhandled ${method} ${path}`), { status: 400 });
  }
}

function json(status, obj) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => obj,
  };
}
