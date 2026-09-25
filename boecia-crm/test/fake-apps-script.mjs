// Minimal in-memory stand-ins for the Apps Script services Code.gs uses.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const CODE = readFileSync(fileURLToPath(new URL('../Code.gs', import.meta.url)), 'utf8');

function display(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return v.toISOString();
  return v == null ? '' : String(v);
}

class FakeRange {
  constructor(sheet, row, col, rows, cols) {
    Object.assign(this, { sheet, row, col, rows, cols });
  }
  cells(fn) {
    const out = [];
    for (let r = 0; r < this.rows; r++) {
      const line = [];
      for (let c = 0; c < this.cols; c++) line.push(fn(this.row + r, this.col + c));
      out.push(line);
    }
    return out;
  }
  getValues() { return this.cells((r, c) => this.sheet.get(r, c)); }
  getDisplayValues() { return this.cells((r, c) => display(this.sheet.get(r, c))); }
  getValue() { return this.sheet.get(this.row, this.col); }
  setValue(v) {
    // Like Sheets: a leading apostrophe forces text and is not shown.
    this.sheet.set(this.row, this.col, typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v);
    this.sheet.writes.push({ row: this.row, col: this.col, value: v });
    return this;
  }
  setNumberFormat(f) { this.sheet.formats[`${this.row}:${this.col}`] = f; return this; }
}

export class FakeSheet {
  constructor(name, rows, id) {
    this.name = name;
    this.data = rows.map((r) => r.slice());
    this.id = id;
    this.writes = [];
    this.formats = {};
  }
  get(r, c) { return (this.data[r - 1] || [])[c - 1] ?? ''; }
  set(r, c, v) {
    while (this.data.length < r) this.data.push([]);
    this.data[r - 1][c - 1] = v;
  }
  getName() { return this.name; }
  getSheetId() { return this.id; }
  getLastRow() { return this.data.length; }
  getLastColumn() { return Math.max(0, ...this.data.map((r) => r.length)); }
  getRange(row, col, rows = 1, cols = 1) { return new FakeRange(this, row, col, rows, cols); }
  appendRow(values) { this.data.push(values.slice()); return this; }
  deleteRow(n) { this.data.splice(n - 1, 1); return this; }
  setFrozenRows() { return this; }
}

export class FakeSpreadsheet {
  constructor(sheets) {
    this.sheets = sheets;
  }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
  insertSheet(n) { const s = new FakeSheet(n, [], this.sheets.length + 100); this.sheets.push(s); return s; }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/TEST/edit'; }
  getSpreadsheetTimeZone() { return 'UTC'; }
}

export function load({ spreadsheet, activeEmail = 'owner@example.com', ownerEmail = 'owner@example.com' }) {
  let uuid = 0;
  const ctx = {
    SpreadsheetApp: { openById: () => spreadsheet, flush: () => {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Session: {
      getActiveUser: () => ({ getEmail: () => activeEmail }),
      getEffectiveUser: () => ({ getEmail: () => ownerEmail }),
    },
    Utilities: {
      getUuid: () => `0000000${++uuid}-aaaa-bbbb-cccc-dddddddddddd`,
      formatDate: (d, _tz, _fmt) => d.toISOString().slice(0, 10),
    },
    HtmlService: {},
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  return ctx;
}
