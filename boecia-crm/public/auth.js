/**
 * Google sign-in (Google Identity Services token model).
 *
 * The access token lives in memory only and lasts about an hour. Google only lets the
 * sign-in popup open from a click, so when the token runs out the app shows a
 * "Reconnect" button instead of renewing silently.
 */

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets email';
const HINT_KEY = 'boecia-crm-login-hint';

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.code = 'auth';
  }
}

function waitForGis(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function check() {
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2) return resolve(oauth2);
      if (Date.now() - start > timeoutMs) return reject(new Error('Could not load Google sign-in. Check your connection or ad blocker.'));
      setTimeout(check, 50);
    })();
  });
}

export function createAuth({ clientId }) {
  let token = null;
  let expiresAt = 0;
  let email = '';
  let client = null;
  let pending = null;

  async function ensureClient() {
    if (client) return client;
    const oauth2 = await waitForGis();
    client = oauth2.initTokenClient({ client_id: clientId, scope: SCOPES, callback: () => {} });
    return client;
  }

  async function fetchEmail() {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) email = (await res.json()).email || '';
    } catch { /* email is only cosmetic */ }
    try { if (email) localStorage.setItem(HINT_KEY, email); } catch { /* storage blocked */ }
  }

  /**
   * Must be called straight from a click, with no await before it, or the browser
   * blocks the popup. Call preload() at startup so the client is ready by then.
   */
  function signIn() {
    if (pending) return pending;
    const c = client;
    if (!c) return Promise.reject(new AuthError('Google sign-in is still loading. Try again in a moment.'));
    let hint = '';
    try { hint = localStorage.getItem(HINT_KEY) || ''; } catch { /* storage blocked */ }
    pending = new Promise((resolve, reject) => {
      c.callback = async (resp) => {
        pending = null;
        if (resp.error) return reject(new AuthError(resp.error_description || 'Sign-in was cancelled.'));
        if (!window.google.accounts.oauth2.hasGrantedAllScopes(resp, 'https://www.googleapis.com/auth/spreadsheets')) {
          return reject(new AuthError('Please allow access to Google Sheets. The CRM needs it to read and edit the sheet.'));
        }
        token = resp.access_token;
        expiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
        await fetchEmail();
        resolve(token);
      };
      c.error_callback = (err) => {
        pending = null;
        reject(new AuthError(err?.type === 'popup_closed' ? 'Sign-in window was closed.' : 'Sign-in failed. Allow pop-ups for this site and try again.'));
      };
      c.requestAccessToken({ prompt: hint ? '' : 'select_account', login_hint: hint || undefined });
    });
    return pending;
  }

  /** Current token, or an AuthError if the user needs to (re)connect. */
  async function getToken() {
    if (token && Date.now() < expiresAt - 60000) return token;
    token = null;
    throw new AuthError('Your Google session expired. Reconnect to continue.');
  }

  function invalidate() {
    token = null;
  }

  function signOut() {
    const t = token;
    token = null;
    email = '';
    try { localStorage.removeItem(HINT_KEY); } catch { /* storage blocked */ }
    if (t && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t, () => {});
  }

  return {
    signIn,
    getToken,
    invalidate,
    signOut,
    isSignedIn: () => !!token && Date.now() < expiresAt - 60000,
    email: () => email,
    preload: () => ensureClient().catch(() => {}),
  };
}
