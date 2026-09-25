// Run with: node --test boecia-crm/test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeSheet, FakeSpreadsheet, load } from './fake-apps-script.mjs';

// Header rows copied from the real "Boecia Talent CRM" spreadsheet.
const CANDIDATE_HEADERS = ['Received', 'Stage', 'Full name', 'Email', 'Main role', 'Years exp.', 'Main technologies', 'English', 'Country', 'City', 'Salary expectation (USD/yr)', 'Open to', 'Notice period', 'LinkedIn', 'GitHub / portfolio', 'CV', 'Owner', 'Next step', 'Next step date', 'Notes', 'Form', 'Other answers', 'Submission ID'];
const LEAD_HEADERS = ['Received', 'Stage', 'Company', 'Contact name', 'Work email', 'Website', 'Roles', 'Seniority', 'Hires', 'Location / time zone', 'Budget (USD/yr)', 'Timeline', 'Their notes', 'Owner', 'Next step', 'Next step date', 'Our notes', 'Form', 'Other answers', 'Submission ID'];
const CONTACT_HEADERS = ['Received', 'Status', 'Name', 'Email', 'Topic', 'Message', 'Our notes', 'Form', 'Other answers', 'Submission ID'];
const LISTS = [
  ['Candidate stages', 'Lead stages', 'Contact status', 'How it works'],
  ['New', 'New', 'New', 'x'],
  ['Contacted', 'Replied', 'Replied', 'x'],
  ['Screening', 'Call booked', 'Closed', 'x'],
  ['Interviewing', 'Proposal sent', '', 'x'],
  ['Presented to company', 'Active search', '', 'x'],
  ['Offer', 'Won', '', ''],
  ['Placed', 'Lost', '', ''],
  ['On hold', 'On hold', '', ''],
  ['Not a fit', '', '', ''],
];

function candidate(name, id, extra = {}) {
  return CANDIDATE_HEADERS.map((h) => {
    if (h === 'Received') return '25 Sep 2026, 09:22';
    if (h === 'Stage') return 'New';
    if (h === 'Full name') return name;
    if (h === 'Submission ID') return id;
    if (h === 'Form') return 'EN';
    return extra[h] ?? '';
  });
}

function setup(opts = {}) {
  const candidates = new FakeSheet('Candidates', [
    CANDIDATE_HEADERS,
    candidate('Ana', 'rDWzE4R'),
    candidate('Bruno', 'WJdyjVa', { 'Main role': 'Backend engineer' }),
    candidate('Carla', 'RWlpM5J'),
  ], 11);
  const ss = new FakeSpreadsheet([
    new FakeSheet('Dashboard', [['x']], 0),
    candidates,
    new FakeSheet('Leads', [LEAD_HEADERS], 12),
    new FakeSheet('Contact', [CONTACT_HEADERS], 13),
    new FakeSheet('Lists', LISTS, 14),
  ]);
  const app = load({ spreadsheet: ss, ...opts });
  return { app, ss, candidates };
}

const col = (h) => CANDIDATE_HEADERS.indexOf(h);
// Arrays built inside the vm sandbox have another realm's prototype; compare plain copies.
const plain = (x) => JSON.parse(JSON.stringify(x));

test('getData returns headers, live stages and rows keyed by Submission ID', () => {
  const { app } = setup();
  const d = app.getData('Candidates');
  assert.deepEqual(plain(d.headers), CANDIDATE_HEADERS);
  assert.equal(d.stageHeader, 'Stage');
  assert.deepEqual(plain(d.stages), ['New', 'Contacted', 'Screening', 'Interviewing', 'Presented to company', 'Offer', 'Placed', 'On hold', 'Not a fit']);
  assert.deepEqual(plain(d.rows.map((r) => r.id)), ['rDWzE4R', 'WJdyjVa', 'RWlpM5J']);
  assert.equal(d.rows[1].values['Main role'], 'Backend engineer');
  assert.match(d.sheetUrl, /#gid=11$/);
});

test('each tab reads its own stage list and stage column', () => {
  const { app } = setup();
  assert.deepEqual(plain(app.getData('Leads').stages.slice(0, 3)), ['New', 'Replied', 'Call booked']);
  const contact = app.getData('Contact');
  assert.equal(contact.stageHeader, 'Status');
  assert.deepEqual(plain(contact.stages), ['New', 'Replied', 'Closed']);
  assert.deepEqual(plain(contact.rows), []);
});

test('unknown tab is rejected', () => {
  const { app } = setup();
  assert.throws(() => app.getData('Dashboard'), /Unknown tab/);
});

test('moveRow changes only the stage cell of the right row', () => {
  const { app, candidates } = setup();
  const row = app.moveRow('Candidates', 'WJdyjVa', 'Screening');
  assert.equal(row.values.Stage, 'Screening');
  assert.equal(candidates.get(3, col('Stage') + 1), 'Screening');
  assert.equal(candidates.get(2, col('Stage') + 1), 'New');
  assert.equal(candidates.writes.length, 1);
});

test('stage must be one of the Lists values', () => {
  const { app, candidates } = setup();
  assert.throws(() => app.moveRow('Candidates', 'WJdyjVa', 'Hired!!'), /not a valid stage/);
  assert.equal(candidates.writes.length, 0);
});

test('updateRow writes whitelisted fields and refuses read-only ones', () => {
  const { app, candidates } = setup();
  const row = app.updateRow('Candidates', 'rDWzE4R', { Owner: 'Valentin', Notes: 'Strong React' });
  assert.equal(row.values.Owner, 'Valentin');
  assert.equal(candidates.get(2, col('Notes') + 1), 'Strong React');
  for (const h of ['Received', 'Submission ID', 'Form']) {
    assert.throws(() => app.updateRow('Candidates', 'rDWzE4R', { [h]: 'x' }), /cannot be edited/);
  }
  assert.throws(() => app.updateRow('Candidates', 'rDWzE4R', { Nope: 'x' }), /Unknown column/);
});

test('rows are found by id even after rows shift', () => {
  const { app, candidates } = setup();
  candidates.deleteRow(2); // someone removes Ana directly in the sheet
  const row = app.updateRow('Candidates', 'RWlpM5J', { Owner: 'Ana María' });
  assert.equal(row.values['Full name'], 'Carla');
  assert.equal(candidates.get(3, col('Owner') + 1), 'Ana María');
  assert.throws(() => app.updateRow('Candidates', 'rDWzE4R', { Owner: 'x' }), /Row not found/);
});

test('next step date is stored as a real date and read back as yyyy-mm-dd', () => {
  const { app, candidates } = setup();
  const row = app.updateRow('Candidates', 'rDWzE4R', { 'Next step date': '2026-10-01' });
  const stored = candidates.get(2, col('Next step date') + 1);
  assert.equal(Object.prototype.toString.call(stored), '[object Date]');
  assert.equal(row.values['Next step date'], '2026-10-01');
  assert.equal(candidates.formats[`2:${col('Next step date') + 1}`], 'd mmm yyyy');
  app.updateRow('Candidates', 'rDWzE4R', { 'Next step date': '' });
  assert.equal(candidates.get(2, col('Next step date') + 1), '');
  assert.throws(() => app.updateRow('Candidates', 'rDWzE4R', { 'Next step date': 'tomorrow' }), /Dates must look like/);
});

test('text starting with = is stored as text, not a formula', () => {
  const { app, candidates } = setup();
  app.updateRow('Candidates', 'rDWzE4R', { Notes: '=IMPORTXML("x")' });
  assert.equal(candidates.writes.at(-1).value, '\'=IMPORTXML("x")');
});

test('deleteRow archives the row then removes it', () => {
  const { app, ss, candidates } = setup();
  const res = app.deleteRow('Candidates', 'WJdyjVa');
  assert.equal(res.archivedTo, 'Archive · Candidates');
  assert.deepEqual(candidates.data.map((r) => r[col('Submission ID')]), ['Submission ID', 'rDWzE4R', 'RWlpM5J']);
  const archive = ss.getSheetByName('Archive · Candidates');
  assert.deepEqual(plain(archive.data[0]), ['Deleted at', ...CANDIDATE_HEADERS]);
  assert.equal(archive.data[1][1 + col('Full name')], 'Bruno');
  app.deleteRow('Candidates', 'rDWzE4R');
  assert.equal(archive.data.length, 3, 'second delete reuses the archive sheet');
});

test('createRow appends a manual row with id, stage and received date', () => {
  const { app, ss } = setup();
  const row = app.createRow('Leads', { Company: 'Ediphi', 'Contact name': 'Zach Azar', 'Next step date': '2026-10-02' });
  assert.match(row.id, /^M-[0-9a-f]{8}$/);
  assert.equal(row.values.Stage, 'New');
  assert.equal(row.values.Form, 'Manual');
  assert.equal(row.values['Next step date'], '2026-10-02');
  const leads = ss.getSheetByName('Leads');
  assert.equal(leads.data.length, 2);
  assert.equal(Object.prototype.toString.call(leads.data[1][0]), '[object Date]');
  assert.throws(() => app.createRow('Leads', { Stage: 'Bogus' }), /not a valid stage/);
});

test('rows typed into the sheet without an id get one', () => {
  const { app, candidates } = setup();
  const r = candidate('Manual Person', '');
  candidates.appendRow(r);
  candidates.appendRow(CANDIDATE_HEADERS.map(() => '')); // blank row is ignored
  const d = app.getData('Candidates');
  assert.equal(d.rows.length, 4);
  assert.match(d.rows[3].id, /^M-/);
  assert.equal(candidates.get(5, col('Submission ID') + 1), d.rows[3].id);
});

test('only the owner (or allow-listed emails) may use it', () => {
  const stranger = setup({ activeEmail: 'someone@else.com' }).app;
  assert.throws(() => stranger.getData('Candidates'), /Not authorized/);
  assert.throws(() => stranger.moveRow('Candidates', 'rDWzE4R', 'Contacted'), /Not authorized/);
  const anon = setup({ activeEmail: '' }).app;
  assert.throws(() => anon.deleteRow('Candidates', 'rDWzE4R'), /Not authorized/);
});

test('with an allow-list, listed people get in and others do not', () => {
  const run = (activeEmail) => {
    const { app } = setup({ activeEmail, ownerEmail: activeEmail }); // USER_ACCESSING: effective = active
    return app;
  };
  const withList = (email) => {
    const app = run(email);
    app.CONFIG.ALLOWED_EMAILS = ['owner@example.com', 'Partner@Example.com '];
    return app;
  };
  assert.equal(withList('partner@example.com').getData('Candidates').rows.length, 3);
  assert.equal(withList('owner@example.com').getData('Candidates').rows.length, 3);
  assert.throws(() => withList('stranger@example.com').getData('Candidates'), /Not authorized/);
});

