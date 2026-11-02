// Spotify OAuth (Authorization Code flow) for "My Little Playlist".
// Tokens never reach the browser's JavaScript: they are AES-GCM encrypted and kept in an
// httpOnly, Secure cookie scoped to /api/spotify. Needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.
const COOKIE = 'pw_sp', STATE = 'pw_sp_state';
const SCOPES = 'playlist-read-private playlist-read-collaborative';
const env = (k) => process.env[k];

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
const cookieHeader = (name, value, maxAge) =>
  `${name}=${encodeURIComponent(value)}; Path=/api/spotify; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const readCookies = (req) =>
  Object.fromEntries((req.headers.get('cookie') || '').split(/;\s*/).filter(Boolean).map((c) => {
    const i = c.indexOf('=');
    return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
  }));

async function aesKey() {
  const secret = env('SPOTIFY_COOKIE_SECRET') || env('SPOTIFY_CLIENT_SECRET');
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('primpaii-way:' + secret));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(), new TextEncoder().encode(JSON.stringify(obj)));
  return Buffer.from(iv).toString('base64url') + '.' + Buffer.from(ct).toString('base64url');
}
async function unseal(value) {
  try {
    const [iv, ct] = value.split('.');
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(iv, 'base64url') }, await aesKey(), Buffer.from(ct, 'base64url'));
    return JSON.parse(new TextDecoder().decode(pt));
  } catch {
    return null;
  }
}

async function tokenRequest(params) {
  const basic = Buffer.from(`${env('SPOTIFY_CLIENT_ID')}:${env('SPOTIFY_CLIENT_SECRET')}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${basic}` },
    body: new URLSearchParams(params),
  });
  if (!res.ok) throw new Error(`Spotify token request failed (${res.status})`);
  return res.json();
}

// Returns the decrypted session, refreshing the access token when it is about to expire.
async function getSession(req) {
  const raw = readCookies(req)[COOKIE];
  const sess = raw && (await unseal(raw));
  if (!sess) return { sess: null, headers: {} };
  if (Date.now() < sess.e - 60_000) return { sess, headers: {} };
  try {
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: sess.r });
    const next = { a: t.access_token, r: t.refresh_token || sess.r, e: Date.now() + t.expires_in * 1000 };
    return { sess: next, headers: { 'set-cookie': cookieHeader(COOKIE, await seal(next), 60 * 60 * 24 * 30) } };
  } catch {
    return { sess: null, headers: { 'set-cookie': cookieHeader(COOKIE, '', 0) } };
  }
}

const redirect = (location, cookies = []) => {
  const headers = new Headers({ location, 'cache-control': 'no-store' });
  cookies.forEach((c) => headers.append('set-cookie', c));
  return new Response(null, { status: 302, headers });
};

export default async (req, context) => {
  const action = context.params?.action;
  const url = new URL(req.url);
  const configured = Boolean(env('SPOTIFY_CLIENT_ID') && env('SPOTIFY_CLIENT_SECRET'));
  if (!configured) return json(action === 'status' ? { configured: false, connected: false } : { error: 'not_configured' }, action === 'status' ? 200 : 503);
  const redirectUri = env('SPOTIFY_REDIRECT_URI') || `${url.origin}/api/spotify/callback`;

  switch (action) {
    case 'login': {
      const state = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url');
      const q = new URLSearchParams({ client_id: env('SPOTIFY_CLIENT_ID'), response_type: 'code', redirect_uri: redirectUri, scope: SCOPES, state });
      return redirect(`https://accounts.spotify.com/authorize?${q}`, [cookieHeader(STATE, state, 600)]);
    }
    case 'callback': {
      const clearState = cookieHeader(STATE, '', 0);
      if (url.searchParams.get('error')) return redirect('/?spotify=denied#settings', [clearState]);
      const code = url.searchParams.get('code'), state = url.searchParams.get('state');
      if (!code || !state || state !== readCookies(req)[STATE]) return redirect('/?spotify=error#settings', [clearState]);
      try {
        const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
        const sess = await seal({ a: t.access_token, r: t.refresh_token, e: Date.now() + t.expires_in * 1000 });
        return redirect('/?spotify=connected#settings', [clearState, cookieHeader(COOKIE, sess, 60 * 60 * 24 * 30)]);
      } catch {
        return redirect('/?spotify=error#settings', [clearState]);
      }
    }
    case 'status': {
      const { sess, headers } = await getSession(req);
      if (!sess) return json({ configured: true, connected: false }, 200, headers);
      const res = await fetch('https://api.spotify.com/v1/me', { headers: { authorization: `Bearer ${sess.a}` } });
      if (!res.ok) return json({ configured: true, connected: false }, 200, { 'set-cookie': cookieHeader(COOKIE, '', 0) });
      const me = await res.json();
      return json({ configured: true, connected: true, name: me.display_name || me.id }, 200, headers);
    }
    case 'playlists': {
      const { sess, headers } = await getSession(req);
      if (!sess) return json({ error: 'not_connected' }, 401, headers);
      const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', { headers: { authorization: `Bearer ${sess.a}` } });
      if (res.status === 401) return json({ error: 'not_connected' }, 401, { 'set-cookie': cookieHeader(COOKIE, '', 0) });
      if (!res.ok) return json({ error: 'spotify_unavailable' }, 502, headers);
      const data = await res.json();
      const items = (data.items || []).filter(Boolean).map((p) => ({ name: p.name, url: p.external_urls?.spotify, owner: p.owner?.display_name || '' })).filter((p) => p.url);
      return json({ items }, 200, headers);
    }
    case 'logout': {
      if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      return json({ ok: true }, 200, { 'set-cookie': cookieHeader(COOKIE, '', 0) });
    }
    default:
      return json({ error: 'not_found' }, 404);
  }
};

export const config = { path: '/api/spotify/:action' };
