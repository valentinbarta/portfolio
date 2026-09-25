import config from './config.js';
import { createAuth } from './auth.js';
import { createSheetsClient } from './sheets.js';

(function () {
  'use strict';

  var auth = createAuth({ clientId: config.GOOGLE_CLIENT_ID });
  var api = createSheetsClient({
    spreadsheetId: config.SPREADSHEET_ID,
    getToken: auth.getToken,
    onUnauthorized: auth.invalidate
  });

  var TABS = ['Candidates', 'Leads', 'Contact'];

  // What each tab shows on a card and in the table (only headers that exist are used).
  var LAYOUT = {
    Candidates: {
      title: 'Full name', sub: 'Main role',
      chips: [['Years exp.', function (v) { return v + ' yrs'; }], ['Country'], ['English'], ['Salary expectation (USD/yr)', function (v) { return '$' + v; }]],
      table: ['Received', 'Stage', 'Full name', 'Main role', 'Years exp.', 'Country', 'English', 'Salary expectation (USD/yr)', 'Owner', 'Next step', 'Next step date']
    },
    Leads: {
      title: 'Company', sub: 'Contact name',
      chips: [['Roles'], ['Hires', function (v) { return v + ' hires'; }], ['Budget (USD/yr)', function (v) { return '$' + v; }]],
      table: ['Received', 'Stage', 'Company', 'Contact name', 'Roles', 'Hires', 'Budget (USD/yr)', 'Timeline', 'Owner', 'Next step', 'Next step date']
    },
    Contact: {
      title: 'Name', sub: 'Topic',
      chips: [['Email']],
      table: ['Received', 'Status', 'Name', 'Email', 'Topic', 'Message']
    }
  };
  var LONG_FIELDS = ['Notes', 'Our notes', 'Their notes', 'Message', 'Main technologies', 'Other answers', 'Roles'];

  var state = {
    tab: 'Candidates',
    view: 'board',
    data: {},          // tab -> getData() result
    search: '',
    owner: '',
    sort: { key: 'Received', dir: -1 },
    drawer: null,      // { mode: 'edit'|'new', row }
    busy: false
  };

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- Google Sheets calls ---------------- */

  function call(fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    return Promise.resolve().then(function () { return api[fn].apply(null, args); }).catch(function (e) {
      if (e && e.code === 'auth') showReconnect();
      throw e;
    });
  }

  function load(tab) {
    return call('getData', tab).then(function (d) { state.data[tab] = d; return d; });
  }

  function loadAll(showErrors) {
    return Promise.all(TABS.map(function (t) {
      return load(t).catch(function (e) { if (showErrors && e.code !== 'auth') toast(t + ': ' + e.message, true); });
    })).then(render);
  }

  /* ---------------- helpers ---------------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function current() { return state.data[state.tab]; }
  function has(d, h) { return d.headers.indexOf(h) !== -1; }
  function stageOf(d, row) { return row.values[d.stageHeader] || ''; }

  function linkFor(value) {
    var v = String(value || '').trim();
    if (/^https?:\/\//i.test(v)) return v;
    if (/^www\./i.test(v) || /^[\w.-]+\.(com|io|dev|app|net|org|co)(\/|$)/i.test(v)) return 'https://' + v;
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return 'mailto:' + v;
    return '';
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function shortDate(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    return m ? Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] : v;
  }

  function isLong(h, v) { return LONG_FIELDS.indexOf(h) !== -1 || String(v || '').length > 70; }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function filtered(d) {
    var q = state.search.toLowerCase();
    return d.rows.filter(function (r) {
      if (state.owner) {
        var o = (r.values.Owner || '').trim();
        if (state.owner === '__none' ? o !== '' : o !== state.owner) return false;
      }
      if (!q) return true;
      return Object.keys(r.values).some(function (k) { return String(r.values[k]).toLowerCase().indexOf(q) !== -1; });
    });
  }

  function toast(msg, isError) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = 'toast' + (isError ? ' error' : ''); }, isError ? 5000 : 2200);
  }

  function replaceRow(tab, row) {
    var d = state.data[tab];
    var i = d.rows.findIndex(function (r) { return r.id === row.id; });
    if (i === -1) d.rows.push(row); else d.rows[i] = row;
  }

  /* ---------------- rendering ---------------- */

  function render() {
    renderTabs();
    renderOwnerFilter();
    var d = current();
    if (!d) { $('main').innerHTML = '<div class="loading">Could not load ' + esc(state.tab) + '.</div>'; return; }
    $('open-sheet').href = d.sheetUrl;
    if (state.view === 'board') renderBoard(d); else renderTable(d);
  }

  function renderTabs() {
    $('tabs').innerHTML = TABS.map(function (t) {
      var d = state.data[t];
      return '<button class="tab" role="tab" data-tab="' + t + '" aria-selected="' + (t === state.tab) + '">' +
        esc(t) + '<span class="count">' + (d ? d.rows.length : '–') + '</span></button>';
    }).join('');
  }

  function renderOwnerFilter() {
    var d = current();
    var owners = {};
    if (d && has(d, 'Owner')) d.rows.forEach(function (r) { var o = (r.values.Owner || '').trim(); if (o) owners[o] = 1; });
    var opts = '<option value="">All owners</option><option value="__none">Unassigned</option>' +
      Object.keys(owners).sort().map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('');
    var sel = $('owner');
    sel.innerHTML = opts;
    sel.style.display = d && has(d, 'Owner') ? '' : 'none';
    if (state.owner && state.owner !== '__none' && !owners[state.owner]) state.owner = '';
    sel.value = state.owner;
  }

  function statusLine(d, rows) {
    var total = d.rows.length;
    var s = rows.length === total ? total + ' ' + (total === 1 ? 'row' : 'rows') : rows.length + ' of ' + total + ' rows';
    return '<p class="status-line">' + s + (total === 0 ? ' · New Tally submissions will appear here automatically, or use “+ Add”.' : '') + '</p>';
  }

  function renderBoard(d) {
    var rows = filtered(d);
    var stages = d.stages.slice();
    // Rows whose stage is blank or not in the Lists tab still need a home.
    var extra = {};
    rows.forEach(function (r) { var s = stageOf(d, r); if (stages.indexOf(s) === -1) extra[s] = 1; });
    Object.keys(extra).forEach(function (s) { stages.push(s); });

    var lay = LAYOUT[state.tab];
    var t = today();
    var html = statusLine(d, rows) + '<div class="board">' + stages.map(function (stage) {
      var inCol = rows.filter(function (r) { return stageOf(d, r) === stage; });
      return '<section class="col" data-stage="' + esc(stage) + '">' +
        '<h3><span>' + esc(stage || 'No ' + d.stageHeader.toLowerCase()) + '</span><span>' + inCol.length + '</span></h3>' +
        '<div class="cards">' + (inCol.length ? inCol.map(function (r) { return cardHtml(d, r, lay, t); }).join('') : '<div class="empty-col">Drop here</div>') +
        '</div></section>';
    }).join('') + '</div>';
    $('main').innerHTML = html;
  }

  function cardHtml(d, r, lay, t) {
    var v = r.values;
    var title = v[lay.title] || v[lay.sub] || '(no name)';
    var chips = lay.chips.filter(function (c) { return v[c[0]]; }).map(function (c) {
      return '<span class="chip">' + esc(c[1] ? c[1](v[c[0]]) : v[c[0]]) + '</span>';
    }).join('');
    var stage = stageOf(d, r);
    var due = v['Next step date'];
    var dueHtml = due ? '<span class="due' + (due < t ? ' late' : '') + '" title="' + esc((v['Next step'] ? v['Next step'] + ' · ' : '') + due) + '">⏱ ' + esc(shortDate(due)) + '</span>' : '<span></span>';
    var opts = d.stages.map(function (s) { return '<option' + (s === stage ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
    if (d.stages.indexOf(stage) === -1) opts = '<option selected disabled>' + esc(stage || '—') + '</option>' + opts;
    return '<article class="card' + (stage === d.stages[0] ? ' new' : '') + '" draggable="true" data-id="' + esc(r.id) + '">' +
      '<div class="title">' + esc(title) + '</div>' +
      (v[lay.sub] && v[lay.title] ? '<div class="sub">' + esc(v[lay.sub]) + '</div>' : '') +
      (chips ? '<div class="chips">' + chips + '</div>' : '') +
      '<div class="foot">' + dueHtml + '<select class="stage-select" aria-label="Move to">' + opts + '</select></div>' +
      '</article>';
  }

  function renderTable(d) {
    var rows = filtered(d);
    var cols = LAYOUT[state.tab].table.filter(function (h) { return has(d, h); });
    var k = state.sort.key, dir = state.sort.dir;
    rows = rows.slice().sort(function (a, b) {
      var x, y;
      if (k === 'Received' && a.receivedTs != null && b.receivedTs != null) { x = a.receivedTs; y = b.receivedTs; }
      else {
        x = a.values[k] || ''; y = b.values[k] || '';
        var nx = parseFloat(String(x).replace(/[^\d.-]/g, '')), ny = parseFloat(String(y).replace(/[^\d.-]/g, ''));
        if (!isNaN(nx) && !isNaN(ny) && /^[\d$.,\s-]+$/.test(x) && /^[\d$.,\s-]+$/.test(y)) { x = nx; y = ny; }
        else { x = String(x).toLowerCase(); y = String(y).toLowerCase(); }
      }
      return x < y ? -dir : x > y ? dir : 0;
    });
    var html = statusLine(d, rows) + '<div class="table-wrap"><table><thead><tr>' + cols.map(function (h) {
      return '<th data-sort="' + esc(h) + '">' + esc(h) + (h === k ? ' <span class="arrow">' + (dir > 0 ? '▲' : '▼') + '</span>' : '') + '</th>';
    }).join('') + '</tr></thead><tbody>' + rows.map(function (r) {
      return '<tr data-id="' + esc(r.id) + '">' + cols.map(function (h) {
        var val = r.values[h] || '';
        if (h === d.stageHeader) return '<td><span class="pill' + (val === d.stages[0] ? ' new' : '') + '">' + esc(val) + '</span></td>';
        return '<td title="' + esc(val) + '">' + esc(val) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>';
    $('main').innerHTML = html;
  }

  /* ---------------- drawer ---------------- */

  function openDrawer(mode, row) {
    var d = current();
    state.drawer = { mode: mode, tab: state.tab, row: row };
    var lay = LAYOUT[state.tab];
    $('drawer-title').textContent = mode === 'new' ? 'New ' + state.tab.replace(/s$/, '').toLowerCase()
      : (row.values[lay.title] || row.values[lay.sub] || 'Row');
    $('delete').style.display = mode === 'new' ? 'none' : '';
    disarmDelete();

    var values = row ? row.values : {};
    $('drawer-form').innerHTML = d.headers.map(function (h, i) {
      var v = values[h] || '';
      var id = 'f' + i;
      var ro = d.readOnly.indexOf(h) !== -1;
      if (mode === 'new' && ro) return '';
      var input;
      if (h === d.stageHeader) {
        var opts = d.stages.slice();
        if (mode === 'new' && !v) v = opts[0] || '';
        if (v && opts.indexOf(v) === -1) opts.unshift(v);
        input = '<select id="' + id + '" data-h="' + esc(h) + '">' + opts.map(function (s) {
          return '<option' + (s === v ? ' selected' : '') + '>' + esc(s) + '</option>';
        }).join('') + '</select>';
      } else if (d.dateFields.indexOf(h) !== -1) {
        input = '<input type="date" id="' + id + '" data-h="' + esc(h) + '" value="' + esc(/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '') + '">';
      } else if (!ro && isLong(h, v)) {
        input = '<textarea id="' + id + '" data-h="' + esc(h) + '">' + esc(v) + '</textarea>';
      } else {
        input = '<input type="text" id="' + id + '" data-h="' + esc(h) + '" value="' + esc(v) + '"' + (ro ? ' disabled' : '') + '>';
      }
      var link = linkFor(v);
      var open = link ? '<a class="open" href="' + esc(link) + '" target="_blank" rel="noopener" title="Open">↗</a>' : '';
      return '<div class="field"><label for="' + id + '">' + esc(h) + '</label><div class="row">' + input + open + '</div></div>';
    }).join('');

    // Compare against what the form showed, so fields the form can't represent (e.g. a
    // non-ISO date string) are never overwritten unless the user actually changes them.
    state.drawer.initial = formValues();
    $('drawer').classList.add('open');
    $('drawer').setAttribute('aria-hidden', 'false');
    $('scrim').classList.add('open');
    var first = $('drawer-form').querySelector('input:not(:disabled), select, textarea');
    if (mode === 'new' && first) first.focus();
  }

  function closeDrawer() {
    state.drawer = null;
    $('drawer').classList.remove('open');
    $('drawer').setAttribute('aria-hidden', 'true');
    $('scrim').classList.remove('open');
  }

  function formValues() {
    var out = {};
    $('drawer-form').querySelectorAll('[data-h]').forEach(function (el) {
      if (!el.disabled) out[el.getAttribute('data-h')] = el.value;
    });
    return out;
  }

  function setBusy(b) {
    state.busy = b;
    ['save', 'delete', 'cancel'].forEach(function (id) { $(id).disabled = b; });
  }

  function save() {
    var dr = state.drawer;
    if (!dr || state.busy) return;
    var vals = formValues();
    setBusy(true);
    var p;
    if (dr.mode === 'new') {
      var data = {};
      Object.keys(vals).forEach(function (h) { if (String(vals[h]).trim()) data[h] = vals[h]; });
      p = call('createRow', dr.tab, data).then(function (row) { replaceRow(dr.tab, row); toast('Added'); });
    } else {
      var patch = {};
      Object.keys(vals).forEach(function (h) { if (dr.initial[h] !== vals[h]) patch[h] = vals[h]; });
      if (!Object.keys(patch).length) { setBusy(false); closeDrawer(); return; }
      p = call('updateRow', dr.tab, dr.row.id, patch).then(function (row) { replaceRow(dr.tab, row); toast('Saved'); });
    }
    p.then(function () { closeDrawer(); render(); })
      .catch(function (e) { toast(e.message, true); })
      .then(function () { setBusy(false); });
  }

  function disarmDelete() {
    clearTimeout(disarmDelete._t);
    var b = $('delete');
    b.classList.remove('armed');
    b.textContent = 'Delete';
  }

  function remove() {
    var dr = state.drawer;
    if (!dr || dr.mode !== 'edit' || state.busy) return;
    var b = $('delete');
    if (!b.classList.contains('armed')) {
      b.classList.add('armed');
      b.textContent = 'Click again to delete';
      disarmDelete._t = setTimeout(disarmDelete, 4000);
      return;
    }
    disarmDelete();
    setBusy(true);
    call('deleteRow', dr.tab, dr.row.id).then(function (res) {
      var d = state.data[dr.tab];
      d.rows = d.rows.filter(function (r) { return r.id !== dr.row.id; });
      closeDrawer();
      render();
      toast('Deleted · copy kept in “' + res.archivedTo + '”');
    }).catch(function (e) { toast(e.message, true); }).then(function () { setBusy(false); });
  }

  /* ---------------- moving between stages ---------------- */

  function move(id, stage) {
    var tab = state.tab, d = state.data[tab];
    var row = d.rows.find(function (r) { return r.id === id; });
    if (!row || stageOf(d, row) === stage) return;
    var before = row.values[d.stageHeader];
    row.values[d.stageHeader] = stage;
    render();
    call('moveRow', tab, id, stage).then(function (fresh) {
      replaceRow(tab, fresh);
      if (state.tab === tab) render();
      toast('Moved to ' + stage);
    }).catch(function (e) {
      row.values[d.stageHeader] = before;
      if (state.tab === tab) render();
      toast(e.message, true);
    });
  }

  /* ---------------- events ---------------- */

  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (!b) return;
    state.tab = b.getAttribute('data-tab');
    state.owner = '';
    state.sort = { key: 'Received', dir: -1 };
    render();
  });

  $('search').addEventListener('input', function (e) { state.search = e.target.value; render(); });
  $('owner').addEventListener('change', function (e) { state.owner = e.target.value; render(); });

  function setView(v) {
    state.view = v;
    $('view-board').setAttribute('aria-pressed', v === 'board');
    $('view-table').setAttribute('aria-pressed', v === 'table');
    try { localStorage.setItem('boecia-crm-view', v); } catch (e) {}
    render();
  }
  $('view-board').addEventListener('click', function () { setView('board'); });
  $('view-table').addEventListener('click', function () { setView('table'); });

  $('refresh').addEventListener('click', function () {
    $('refresh').disabled = true;
    loadAll(true).then(function () { toast('Up to date'); }).then(function () { $('refresh').disabled = false; });
  });
  $('add').addEventListener('click', function () { if (current()) openDrawer('new', null); });

  $('main').addEventListener('click', function (e) {
    if (e.target.closest('select, a')) return;
    var th = e.target.closest('th[data-sort]');
    if (th) {
      var key = th.getAttribute('data-sort');
      state.sort = { key: key, dir: state.sort.key === key ? -state.sort.dir : 1 };
      render();
      return;
    }
    var el = e.target.closest('[data-id]');
    if (!el) return;
    var row = current().rows.find(function (r) { return r.id === el.getAttribute('data-id'); });
    if (row) openDrawer('edit', row);
  });

  $('main').addEventListener('change', function (e) {
    if (!e.target.classList.contains('stage-select')) return;
    move(e.target.closest('[data-id]').getAttribute('data-id'), e.target.value);
  });

  var dragId = null;
  $('main').addEventListener('dragstart', function (e) {
    var card = e.target.closest && e.target.closest('.card');
    if (!card) return;
    dragId = card.getAttribute('data-id');
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });
  $('main').addEventListener('dragend', function (e) {
    var card = e.target.closest && e.target.closest('.card');
    if (card) card.classList.remove('dragging');
    document.querySelectorAll('.col.drop').forEach(function (c) { c.classList.remove('drop'); });
    dragId = null;
  });
  $('main').addEventListener('dragover', function (e) {
    var col = e.target.closest('.col');
    if (!col || !dragId) return;
    e.preventDefault();
    document.querySelectorAll('.col.drop').forEach(function (c) { if (c !== col) c.classList.remove('drop'); });
    col.classList.add('drop');
  });
  $('main').addEventListener('drop', function (e) {
    var col = e.target.closest('.col');
    if (!col || !dragId) return;
    e.preventDefault();
    var id = dragId;
    dragId = null;
    move(id, col.getAttribute('data-stage'));
  });

  $('drawer-close').addEventListener('click', closeDrawer);
  $('cancel').addEventListener('click', closeDrawer);
  $('scrim').addEventListener('click', closeDrawer);
  $('save').addEventListener('click', save);
  $('delete').addEventListener('click', remove);
  $('drawer-form').addEventListener('submit', function (e) { e.preventDefault(); save(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.drawer) closeDrawer();
    if ((e.metaKey || e.ctrlKey) && e.key === 's' && state.drawer) { e.preventDefault(); save(); }
  });

  // Pick up new Tally submissions without a manual refresh.
  setInterval(function () {
    if (document.hidden || state.drawer || dragId || state.busy || !auth.isSignedIn()) return;
    loadAll(false);
  }, 60000);

  /* ---------------- start ---------------- */
  try { var saved = localStorage.getItem('boecia-crm-view'); if (saved === 'table' || saved === 'board') state.view = saved; } catch (e) {}
  $('view-board').setAttribute('aria-pressed', state.view === 'board');
  $('view-table').setAttribute('aria-pressed', state.view === 'table');

  /* ---------------- sign-in ---------------- */

  function showSignin(message, canSwitch) {
    document.body.classList.add('signed-out');
    $('signin').hidden = false;
    $('reconnect').hidden = true;
    $('signin-error').textContent = message || '';
    $('signin-error').hidden = !message;
    $('switch-account').hidden = !canSwitch;
  }

  function showReconnect() {
    if (!document.body.classList.contains('signed-out')) $('reconnect').hidden = false;
  }

  function start() {
    document.body.classList.remove('signed-out');
    $('signin').hidden = true;
    $('reconnect').hidden = true;
    $('account').title = auth.email() ? 'Signed in as ' + auth.email() : 'Sign out';
    $('main').innerHTML = '<div class="loading">Loading…</div>';
    return load(state.tab).then(render).then(function () { return loadAll(false); }).catch(function (e) {
      if (['auth', 'forbidden', 'setup', 'not_found'].indexOf(e.code) !== -1) {
        showSignin(e.message, e.code === 'forbidden');
      } else {
        $('main').innerHTML = '<div class="loading">' + esc(e.message) + '</div>';
      }
    });
  }

  function signIn() {
    $('signin-btn').disabled = true;
    $('signin-error').hidden = true;
    $('switch-account').hidden = true;
    // No await before auth.signIn(): the popup must open inside the click.
    auth.signIn().then(start, function (e) { showSignin(e.message, false); })
      .then(function () { $('signin-btn').disabled = false; });
  }

  $('signin-btn').addEventListener('click', signIn);
  $('switch-account').addEventListener('click', function () { auth.signOut(); signIn(); });
  $('reconnect-btn').addEventListener('click', function () {
    auth.signIn().then(function () { $('reconnect').hidden = true; return loadAll(true); })
      .catch(function (e) { toast(e.message, true); });
  });
  $('account').addEventListener('click', function () {
    auth.signOut();
    state.data = {};
    closeDrawer();
    showSignin('Signed out.', false);
  });

  if (!config.GOOGLE_CLIENT_ID || /^PASTE/.test(config.GOOGLE_CLIENT_ID)) {
    showSignin('Setup is not finished: paste your Google client ID into config.js (README, step 1).', false);
    $('signin-btn').disabled = true;
  } else {
    auth.preload();
    showSignin('', false);
  }
})();
