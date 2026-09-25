/**
 * Boecia Talent CRM – web interface.
 *
 * A standalone Apps Script web app that reads and edits the "Boecia Talent CRM"
 * spreadsheet. It lives in its own project so it can never interfere with the
 * Tally webhook script that appends new rows.
 *
 * Rows are identified by their "Submission ID", never by row number: Tally keeps
 * appending and rows get deleted, so every write looks the row up again under a lock.
 * Columns are found by header name, so reordering columns in the sheet is safe.
 */

var CONFIG = {
  SPREADSHEET_ID: '1klSjWy5PG1a2KPCytiUfIgqDrLhgwU-aBoaJhDy_9d0',

  // Leave empty for a private "Only myself" deployment. To let others in, list every email that
  // may use the app (yours included) and deploy as "User accessing the web app" (see README).
  ALLOWED_EMAILS: [],

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
    Contact: { sheet: 'Contact', stageHeader: 'Status', stageList: 'Contact status' }
  }
};

/* ------------------------------------------------------------------ web app */

function doGet() {
  assertAllowed_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Boecia Talent CRM')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ------------------------------------------------------- client-callable API */

/** Everything the UI needs for one tab. */
function getData(tab) {
  assertAllowed_();
  var ctx = context_(tab);
  var stages = readStages_(ctx);
  ensureIds_(ctx);

  var rows = [];
  var n = ctx.sheet.getLastRow() - 1;
  if (n > 0) {
    var range = ctx.sheet.getRange(2, 1, n, ctx.headers.length);
    var raw = range.getValues();
    var shown = range.getDisplayValues();
    for (var i = 0; i < n; i++) {
      if (isBlankRow_(raw[i])) continue;
      rows.push(serializeRow_(ctx, raw[i], shown[i]));
    }
  }

  return {
    tab: tab,
    headers: ctx.headers,
    stageHeader: ctx.cfg.stageHeader,
    stages: stages,
    readOnly: CONFIG.READ_ONLY,
    dateFields: CONFIG.DATE_FIELDS,
    rows: rows,
    sheetUrl: ctx.ss.getUrl() + '#gid=' + ctx.sheet.getSheetId()
  };
}

/** Write the changed fields of one row. `patch` maps header -> new value (string). */
function updateRow(tab, id, patch) {
  assertAllowed_();
  return withLock_(function () {
    var ctx = context_(tab);
    var rowNum = findRow_(ctx, id);
    var stages = readStages_(ctx);

    Object.keys(patch || {}).forEach(function (header) {
      var col = ctx.headers.indexOf(header);
      if (col === -1) throw new Error('Unknown column "' + header + '"');
      if (CONFIG.READ_ONLY.indexOf(header) !== -1) throw new Error('"' + header + '" cannot be edited');
      var value = patch[header] == null ? '' : String(patch[header]);
      if (header === ctx.cfg.stageHeader && stages.indexOf(value) === -1) {
        throw new Error('"' + value + '" is not a valid ' + header.toLowerCase());
      }
      writeCell_(ctx, rowNum, col, header, value);
    });

    return readRow_(ctx, rowNum);
  });
}

/** Move a row to another stage/status. */
function moveRow(tab, id, stage) {
  assertAllowed_();
  var patch = {};
  patch[context_(tab).cfg.stageHeader] = stage;
  return updateRow(tab, id, patch);
}

/** Copy the row to "Archive · <tab>" and remove it from the tab. */
function deleteRow(tab, id) {
  assertAllowed_();
  return withLock_(function () {
    var ctx = context_(tab);
    var rowNum = findRow_(ctx, id);
    var values = ctx.sheet.getRange(rowNum, 1, 1, ctx.headers.length).getValues()[0];

    var archive = archiveSheet_(ctx);
    archive.appendRow([new Date()].concat(values));
    archive.getRange(archive.getLastRow(), 1).setNumberFormat(CONFIG.RECEIVED_FORMAT);

    ctx.sheet.deleteRow(rowNum);
    return { id: id, archivedTo: archive.getName() };
  });
}

/** Add a row by hand (e.g. a LinkedIn contact who replied becomes a Lead). */
function createRow(tab, data) {
  assertAllowed_();
  return withLock_(function () {
    var ctx = context_(tab);
    var stages = readStages_(ctx);
    data = data || {};

    var stage = data[ctx.cfg.stageHeader] || stages[0] || '';
    if (stages.length && stages.indexOf(stage) === -1) {
      throw new Error('"' + stage + '" is not a valid ' + ctx.cfg.stageHeader.toLowerCase());
    }

    var id = newId_();
    var row = ctx.headers.map(function (header) {
      if (header === CONFIG.RECEIVED_HEADER) return new Date();
      if (header === CONFIG.ID_HEADER) return id;
      if (header === CONFIG.FORM_HEADER) return 'Manual';
      if (header === ctx.cfg.stageHeader) return stage;
      var value = data[header] == null ? '' : String(data[header]);
      if (CONFIG.DATE_FIELDS.indexOf(header) !== -1) return parseDate_(value);
      return safeText_(value);
    });

    ctx.sheet.appendRow(row);
    var rowNum = findRow_(ctx, id);
    formatRow_(ctx, rowNum);
    return readRow_(ctx, rowNum);
  });
}

/* ------------------------------------------------------------------ helpers */

function assertAllowed_() {
  var active = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  var owner = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  var allowed = CONFIG.ALLOWED_EMAILS.map(function (e) { return String(e).trim().toLowerCase(); });
  if (!allowed.length && owner) allowed = [owner];
  if (!active || allowed.indexOf(active) === -1) {
    throw new Error('Not authorized. Ask the owner to add your Google account.');
  }
}

function context_(tab) {
  var cfg = CONFIG.TABS[tab];
  if (!cfg) throw new Error('Unknown tab "' + tab + '"');
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(cfg.sheet);
  if (!sheet) throw new Error('Sheet "' + cfg.sheet + '" not found');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
    .map(function (h) { return String(h).trim(); });
  while (headers.length && !headers[headers.length - 1]) headers.pop();
  if (headers.indexOf(CONFIG.ID_HEADER) === -1) throw new Error('"' + cfg.sheet + '" has no "' + CONFIG.ID_HEADER + '" column');
  if (headers.indexOf(cfg.stageHeader) === -1) throw new Error('"' + cfg.sheet + '" has no "' + cfg.stageHeader + '" column');
  return { ss: ss, sheet: sheet, cfg: cfg, headers: headers, tz: ss.getSpreadsheetTimeZone() };
}

/** Allowed stage values, read live from the Lists tab. */
function readStages_(ctx) {
  var lists = ctx.ss.getSheetByName(CONFIG.LISTS_SHEET);
  if (!lists) return [];
  var lastRow = lists.getLastRow();
  var head = lists.getRange(1, 1, 1, lists.getLastColumn()).getDisplayValues()[0]
    .map(function (h) { return String(h).trim(); });
  var col = head.indexOf(ctx.cfg.stageList);
  if (col === -1 || lastRow < 2) return [];
  var out = [];
  var values = lists.getRange(2, col + 1, lastRow - 1, 1).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    var v = String(values[i][0]).trim();
    if (!v) break;
    out.push(v);
  }
  return out;
}

/** Rows typed straight into the sheet have no Submission ID; give them one so they can be edited. */
function ensureIds_(ctx) {
  var n = ctx.sheet.getLastRow() - 1;
  if (n < 1) return;
  var idCol = ctx.headers.indexOf(CONFIG.ID_HEADER) + 1;
  var raw = ctx.sheet.getRange(2, 1, n, ctx.headers.length).getValues();
  var missing = [];
  for (var i = 0; i < n; i++) {
    if (!isBlankRow_(raw[i]) && !String(raw[i][idCol - 1]).trim()) missing.push(i + 2);
  }
  if (!missing.length) return;
  withLock_(function () {
    missing.forEach(function (rowNum) {
      var cell = ctx.sheet.getRange(rowNum, idCol);
      if (!String(cell.getValue()).trim()) cell.setValue(newId_());
    });
  });
}

function findRow_(ctx, id) {
  var n = ctx.sheet.getLastRow() - 1;
  var idCol = ctx.headers.indexOf(CONFIG.ID_HEADER) + 1;
  if (n > 0 && id) {
    var ids = ctx.sheet.getRange(2, idCol, n, 1).getDisplayValues();
    for (var i = 0; i < n; i++) {
      if (String(ids[i][0]).trim() === String(id)) return i + 2;
    }
  }
  throw new Error('Row not found. It may have been deleted. Refresh and try again.');
}

function readRow_(ctx, rowNum) {
  var range = ctx.sheet.getRange(rowNum, 1, 1, ctx.headers.length);
  return serializeRow_(ctx, range.getValues()[0], range.getDisplayValues()[0]);
}

/** google.script.run cannot carry Date objects, so everything goes out as strings. */
function serializeRow_(ctx, raw, shown) {
  var values = {};
  var receivedTs = null;
  ctx.headers.forEach(function (header, c) {
    var v = raw[c];
    if (CONFIG.DATE_FIELDS.indexOf(header) !== -1 && isDate_(v)) {
      values[header] = Utilities.formatDate(v, ctx.tz, 'yyyy-MM-dd');
    } else {
      values[header] = String(shown[c]);
    }
    if (header === CONFIG.RECEIVED_HEADER && isDate_(v)) receivedTs = v.getTime();
  });
  return { id: values[CONFIG.ID_HEADER], values: values, receivedTs: receivedTs };
}

function writeCell_(ctx, rowNum, col, header, value) {
  var cell = ctx.sheet.getRange(rowNum, col + 1);
  if (CONFIG.DATE_FIELDS.indexOf(header) !== -1) {
    var date = parseDate_(value);
    cell.setValue(date);
    if (date !== '') cell.setNumberFormat(CONFIG.DATE_FORMAT);
    return;
  }
  cell.setValue(safeText_(value));
}

function formatRow_(ctx, rowNum) {
  var received = ctx.headers.indexOf(CONFIG.RECEIVED_HEADER);
  if (received !== -1) ctx.sheet.getRange(rowNum, received + 1).setNumberFormat(CONFIG.RECEIVED_FORMAT);
  CONFIG.DATE_FIELDS.forEach(function (header) {
    var col = ctx.headers.indexOf(header);
    if (col !== -1) ctx.sheet.getRange(rowNum, col + 1).setNumberFormat(CONFIG.DATE_FORMAT);
  });
}

function archiveSheet_(ctx) {
  var name = 'Archive · ' + ctx.cfg.sheet;
  var sheet = ctx.ss.getSheetByName(name);
  if (!sheet) {
    sheet = ctx.ss.insertSheet(name);
    sheet.appendRow(['Deleted at'].concat(ctx.headers));
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** "yyyy-mm-dd" -> Date at noon (noon keeps the day stable across time zones); "" -> "". */
function parseDate_(value) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!m) {
    if (String(value).trim()) throw new Error('Dates must look like 2026-10-01');
    return '';
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

/** Stop typed text from being evaluated as a formula. */
function safeText_(value) {
  return /^=/.test(value) ? "'" + value : value;
}

function isDate_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
}

function isBlankRow_(row) {
  for (var i = 0; i < row.length; i++) {
    if (String(row[i]).trim() !== '') return false;
  }
  return true;
}

function newId_() {
  return 'M-' + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var result = fn();
    SpreadsheetApp.flush();
    return result;
  } finally {
    lock.releaseLock();
  }
}
