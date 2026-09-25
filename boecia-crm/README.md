# Boecia Talent CRM: web interface

This is a small web app for working the **Boecia Talent CRM** Google Sheet without editing the grid by hand. You can:

- see Candidates, Leads and Contact messages as a board, one column per stage
- drag cards between stages, or use the dropdown on each card on a phone
- open any row to edit Owner, Next step, Next step date, Notes or any other field
- add rows by hand, e.g. a LinkedIn contact who replied becomes a Lead
- delete rows (a copy goes to an `Archive · <tab>` sheet first, so nothing is lost)
- search, filter by owner, and switch to a sortable table view

![Board view](screenshot.png)

It is a standalone **Google Apps Script** web app that reads and writes the sheet directly. It runs under your Google account, needs no servers or API keys, and is private to you.

It is a **separate project** from the script that receives Tally submissions, so it can't break that webhook. New Tally rows appear in the app automatically (it refreshes every minute).

## Setup (about 5 minutes)

1. Go to <https://script.google.com> → **New project**. Rename it `Boecia CRM UI`.
2. Replace the contents of `Code.gs` with [`Code.gs`](Code.gs) from this folder.
3. Click **+** next to *Files* → **HTML**, name it `Index` (no extension), and paste [`Index.html`](Index.html).
4. Open **Project Settings** (gear icon) and tick **Show "appsscript.json" manifest file in editor**. Go back to the editor and replace `appsscript.json` with [`appsscript.json`](appsscript.json).
5. Click **Deploy → New deployment**, pick type **Web app**, and set:
   - *Execute as*: **Me**
   - *Who has access*: **Only myself**
6. Click **Deploy** and authorize. Google will warn that the app is unverified; that's expected for your own script. Click *Advanced → Go to Boecia CRM UI*.
7. Open the **Web app URL** (ends in `/exec`) and bookmark it. On a phone, use *Add to Home Screen*.

### Updating after a code change
Paste the new files, then **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The URL stays the same.

### Optional: push with clasp
If you use [clasp](https://github.com/google/clasp), create a standalone project with `boecia-crm` as its root directory and `clasp push`. The included `.claspignore` keeps the tests, README and screenshot out of the push. Deploy as in step 5.

## Giving someone else access (e.g. a partner doing screening)
1. Share the spreadsheet with them as **Editor**.
2. At the top of `Code.gs`, list everyone who may use the app, **yourself included**:
   `ALLOWED_EMAILS: ['you@gmail.com', 'partner@gmail.com'],`
3. In `appsscript.json`, change `"executeAs": "USER_DEPLOYING"` to `"USER_ACCESSING"` and `"access": "MYSELF"` to `"ANYONE"`.
4. Deploy a new version with *Execute as*: **User accessing the web app** and *Who has access*: **Anyone with a Google account**.

Each person authorizes the app once, and it then works with their own access to the sheet. Anyone not on the list gets "Not authorized", and anyone the sheet isn't shared with can't read it at all.

## How it treats the sheet
- **Rows are matched by `Submission ID`,** not row number, so Tally appending rows while you work is safe. Rows typed straight into the sheet with no ID get an `M-xxxxxxxx` ID the first time the app loads them.
- **Columns are found by header name.** You can reorder or add columns in the sheet, but don't rename `Stage`, `Status` or `Submission ID`.
- **Stages come live from the `Lists` tab.** Add or rename a stage there and the board follows.
- **`Received`, `Submission ID` and `Form` are read-only** (same rule as the Lists tab).
- **`Next step date` is saved as a real date,** so the Dashboard's "Next steps due" keeps working.
- **Text starting with `=` is saved as plain text,** never as a formula.

## Tests
```bash
node --test boecia-crm/test/*.test.mjs
```
The tests run `Code.gs` against an in-memory fake of the spreadsheet that uses the real header rows.
