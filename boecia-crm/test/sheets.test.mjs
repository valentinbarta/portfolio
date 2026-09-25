// Run with: node --test boecia-crm/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSheetsClient, colLetter, serialToIso, safeText } from '../public/sheets.js';
import { FakeSheetsApi } from './fake-sheets-api.mjs';

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

function setup({ token = 'tok' } = {}) {
  const fake = new FakeSheetsApi([
    ['Dashboard', [['x']]],
    ['Candidates', [
      CANDIDATE_HEADERS,
      candidate('Ana', 'rDWzE4R'),
      candidate('Bruno', 'WJdyjVa', { 'Main role': 'Backend engineer' }),
      candidate('Carla', 'RWlpM5J'),
    ]],
    ['Leads', [LEAD_HEADERS]],
    ['Contact', [CONTACT_HEADERS]],
    ['Lists', LISTS],
  ]);
  let ids = 0;
  const events = { unauthorized: 0 };
  const api = createSheetsClient({
    spreadsheetId: 'SHEET',
    getToken: async () => token,
    onUnauthorized: () => { events.unauthorized++; },
    fetch: fake.fetch,
    now: () => new Date(2026, 8, 25, 21, 5, 0),
    newId: () => 'M-' + String(++ids).padStart(8, '0'),
  });
  return { api, fake, events };
}

const col = (h) => CANDIDATE_HEADERS.indexOf(h);
const cell = (fake, row, h) => fake.get('Candidates', row, col(h) + 1);

test('helpers', () => {
  assert.equal(colLetter(0), 'A');
  assert.equal(colLetter(25), 'Z');
  assert.equal(colLetter(26), 'AA');
  assert.equal(serialToIso(46296), '2026-10-01');
  assert.equal(safeText('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(safeText('+57 300 1234567'), "'+57 300 1234567");
  assert.equal(safeText('-5'), '-5');
  assert.equal(safeText('Hello'), 'Hello');
});

test('getData returns headers, live stages and rows keyed by Submission ID', async () => {
  const { api, fake } = setup();
  const d = await api.getData('Candidates');
  assert.deepEqual(d.headers, CANDIDATE_HEADERS);
  assert.equal(d.stageHeader, 'Stage');
  assert.deepEqual(d.stages, ['New', 'Contacted', 'Screening', 'Interviewing', 'Presented to company', 'Offer', 'Placed', 'On hold', 'Not a fit']);
  assert.deepEqual(d.rows.map((r) => r.id), ['rDWzE4R', 'WJdyjVa', 'RWlpM5J']);
  assert.equal(d.rows[1].values['Main role'], 'Backend engineer');
  assert.equal(d.rows[1].values.Notes, '', 'trailing empty cells are padded');
  assert.match(d.sheetUrl, /#gid=10$/);
  assert.ok(fake.calls.every((c) => c.auth === 'Bearer tok'), 'every call sends the token');
});

test('each tab reads its own stage list and stage column', async () => {
  const { api } = setup();
  assert.deepEqual((await api.getData('Leads')).stages.slice(0, 3), ['New', 'Replied', 'Call booked']);
  const contact = await api.getData('Contact');
  assert.equal(contact.stageHeader, 'Status');
  assert.deepEqual(contact.stages, ['New', 'Replied', 'Closed']);
  assert.deepEqual(contact.rows, []);
});

test('unknown tab is rejected', async () => {
  const { api } = setup();
  await assert.rejects(api.getData('Dashboard'), /Unknown tab/);
});

test('moveRow changes only the stage cell of the right row', async () => {
  const { api, fake } = setup();
  const row = await api.moveRow('Candidates', 'WJdyjVa', 'Screening');
  assert.equal(row.values.Stage, 'Screening');
  assert.equal(cell(fake, 3, 'Stage'), 'Screening');
  assert.equal(cell(fake, 2, 'Stage'), 'New');
  const writes = fake.calls.filter((c) => c.path === '/values:batchUpdate');
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].body.data, [{ range: "'Candidates'!B3", values: [['Screening']] }]);
});

test('stage must be one of the Lists values', async () => {
  const { api, fake } = setup();
  await assert.rejects(api.moveRow('Candidates', 'WJdyjVa', 'Hired!!'), /not a valid stage/);
  assert.equal(fake.calls.filter((c) => c.method !== 'GET').length, 0);
});

test('updateRow writes whitelisted fields and refuses read-only ones', async () => {
  const { api, fake } = setup();
  const row = await api.updateRow('Candidates', 'rDWzE4R', { Owner: 'Valentin', Notes: 'Strong React' });
  assert.equal(row.values.Owner, 'Valentin');
  assert.equal(cell(fake, 2, 'Notes'), 'Strong React');
  for (const h of ['Received', 'Submission ID', 'Form']) {
    await assert.rejects(api.updateRow('Candidates', 'rDWzE4R', { [h]: 'x' }), /cannot be edited/);
  }
  await assert.rejects(api.updateRow('Candidates', 'rDWzE4R', { Nope: 'x' }), /Unknown column/);
});

test('rows are found by id even after rows shift', async () => {
  const { api, fake } = setup();
  fake.sheet('Candidates').data.splice(1, 1); // someone removes Ana directly in the sheet
  const row = await api.updateRow('Candidates', 'RWlpM5J', { Owner: 'Ana María' });
  assert.equal(row.values['Full name'], 'Carla');
  assert.equal(cell(fake, 3, 'Owner'), 'Ana María');
  await assert.rejects(api.updateRow('Candidates', 'rDWzE4R', { Owner: 'x' }), /Row not found/);
});

test('next step date is stored as a real date and read back as yyyy-mm-dd', async () => {
  const { api, fake } = setup();
  const row = await api.updateRow('Candidates', 'rDWzE4R', { 'Next step date': '2026-10-01' });
  assert.equal(typeof cell(fake, 2, 'Next step date'), 'number', 'stored as a date serial');
  assert.equal(row.values['Next step date'], '2026-10-01');
  assert.deepEqual(fake.sheet('Candidates').formats[`2:${col('Next step date')}`], { type: 'DATE', pattern: 'd mmm yyyy' });
  await api.updateRow('Candidates', 'rDWzE4R', { 'Next step date': '' });
  assert.equal(cell(fake, 2, 'Next step date'), '');
  await assert.rejects(api.updateRow('Candidates', 'rDWzE4R', { 'Next step date': 'tomorrow' }), /Dates must look like/);
});

test('text starting with = is stored as text, not a formula', async () => {
  const { api, fake } = setup();
  await api.updateRow('Candidates', 'rDWzE4R', { Notes: '=IMPORTXML("x")' });
  assert.equal(cell(fake, 2, 'Notes'), '=IMPORTXML("x")');
});

test('deleteRow archives the row then removes it', async () => {
  const { api, fake } = setup();
  const res = await api.deleteRow('Candidates', 'WJdyjVa');
  assert.equal(res.archivedTo, 'Archive · Candidates');
  assert.deepEqual(fake.sheet('Candidates').data.map((r) => r[col('Submission ID')]), ['Submission ID', 'rDWzE4R', 'RWlpM5J']);
  const archive = fake.sheet('Archive · Candidates');
  assert.deepEqual(archive.data[0], ['Deleted at', ...CANDIDATE_HEADERS]);
  assert.equal(archive.data[1][0], '2026-09-25 21:05:00');
  assert.equal(archive.data[1][1 + col('Full name')], 'Bruno');
  await api.deleteRow('Candidates', 'rDWzE4R');
  assert.equal(archive.data.length, 3, 'second delete reuses the archive sheet');
  assert.equal(fake.calls.filter((c) => c.body?.requests?.[0]?.addSheet).length, 1);
});

test('createRow appends a manual row with id, stage and received date', async () => {
  const { api, fake } = setup();
  const row = await api.createRow('Leads', { Company: 'Ediphi', 'Contact name': 'Zach Azar', 'Next step date': '2026-10-02', Roles: '=hack' });
  assert.equal(row.id, 'M-00000001');
  assert.equal(row.values.Stage, 'New');
  assert.equal(row.values.Form, 'Manual');
  assert.equal(row.values['Next step date'], '2026-10-02');
  assert.equal(row.values.Roles, '=hack');
  const leads = fake.sheet('Leads');
  assert.equal(leads.data.length, 2);
  assert.equal(typeof leads.data[1][0], 'number', 'Received stored as a date');
  assert.ok(row.receivedTs > 0);
  await assert.rejects(api.createRow('Leads', { Stage: 'Bogus' }), /not a valid stage/);
});

test('rows typed into the sheet without an id get one', async () => {
  const { api, fake } = setup();
  fake.sheet('Candidates').data.push(candidate('Manual Person', ''));
  fake.sheet('Candidates').data.push(CANDIDATE_HEADERS.map(() => '')); // blank row is ignored
  const d = await api.getData('Candidates');
  assert.equal(d.rows.length, 4);
  assert.equal(d.rows[3].id, 'M-00000001');
  assert.equal(cell(fake, 5, 'Submission ID'), 'M-00000001');
});

test('403 means this account has no access to the sheet', async () => {
  const { api, fake } = setup();
  fake.failNext = { status: 403, message: 'The caller does not have permission' };
  await assert.rejects(api.getData('Candidates'), (e) => e.code === 'forbidden' && /doesn't have access/.test(e.message));
});

test('403 with the API disabled points to setup', async () => {
  const { api, fake } = setup();
  fake.failNext = { status: 403, message: 'Google Sheets API has not been used in project 123 before or it is disabled.' };
  await assert.rejects(api.getData('Candidates'), (e) => e.code === 'setup');
});

test('401 invalidates the session and asks to reconnect', async () => {
  const { api, fake, events } = setup();
  fake.failNext = { status: 401, message: 'Invalid Credentials' };
  await assert.rejects(api.getData('Candidates'), (e) => e.code === 'auth');
  assert.equal(events.unauthorized, 1);
});

test('an expired token never reaches Google', async () => {
  const fake = new FakeSheetsApi([]);
  const expired = Object.assign(new Error('expired'), { code: 'auth' });
  const api = createSheetsClient({ spreadsheetId: 'S', getToken: async () => { throw expired; }, fetch: fake.fetch });
  await assert.rejects(api.getData('Candidates'), (e) => e.code === 'auth');
  assert.equal(fake.calls.length, 0);
});

test('404 means the spreadsheet id is wrong', async () => {
  const { api, fake } = setup();
  fake.failNext = { status: 404, message: 'Requested entity was not found.' };
  await assert.rejects(api.getData('Candidates'), (e) => e.code === 'not_found' && /SPREADSHEET_ID/.test(e.message));
});
