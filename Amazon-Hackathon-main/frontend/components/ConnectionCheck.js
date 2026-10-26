'use client';
import { useCallback, useEffect, useState } from 'react';
import * as api from '@/lib/api';

const mark = (ok) => (ok === true ? '✓' : ok === false ? '✕' : '…');
const tone = (ok) => (ok === true ? 'text-success' : ok === false ? 'text-danger' : 'text-muted');

/** Shows exactly where a deployment is broken: wrong API address, API unreachable, signed out, or token rejected. */
export default function ConnectionCheck() {
  const [rows, setRows] = useState([]);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    const out = [];
    const add = (label, ok, detail, fix) => { out.push({ label, ok, detail, fix }); setRows([...out]); };
    setRows([]);

    const base = api.API_BASE;
    const here = typeof window !== 'undefined' ? window.location : null;
    const onLocal = here && /^(localhost|127\.0\.0\.1)$/.test(here.hostname);
    const pointsLocal = /localhost|127\.0\.0\.1/.test(base);
    const pointsAtSelf = here && base === here.origin;
    add('API address built into this site', !(pointsLocal && !onLocal) && !pointsAtSelf, base,
      pointsLocal && !onLocal ? 'This deployed site is calling a local address. In the frontend project set NEXT_PUBLIC_API_URL to your backend URL, then redeploy without build cache.'
        : pointsAtSelf ? 'NEXT_PUBLIC_API_URL points at the frontend itself. It must be the backend project URL.' : null);

    let health = null;
    try {
      health = await api.getHealth();
      const good = health.status === 200 && health.json?.status === 'ok';
      add('Backend reachable (/health)', good, good ? `authMode: ${health.json.authMode}, store: ${health.json.repository}` : `HTTP ${health.status}${health.isJson ? '' : ' (not the backend: got a web page instead of JSON)'}`,
        good ? null : 'Open the backend URL + /health in a new tab. It must show {"status":"ok"}. Also check CORS_ORIGINS on the backend equals this site address exactly.');
      if (good && health.json.authMode !== 'supabase') add('Backend login mode', false, `authMode is "${health.json.authMode}"`, 'Set AUTH_MODE=supabase (plus SUPABASE_URL and SUPABASE_ANON_KEY) on the backend project and redeploy.');
    } catch (e) {
      add('Backend reachable (/health)', false, e.message, 'The browser could not reach the backend or it blocked the request (CORS). Set CORS_ORIGINS on the backend to this site address and redeploy.');
    }

    const session = await api.getSessionInfo();
    add('Signed in on this site', session.signedIn, session.signedIn ? `${session.email} (token expires ${session.expiresAt})` : 'No session found', session.signedIn ? null : 'Sign out and sign in again from the login page on THIS address.');

    if (session.signedIn) {
      try {
        const me = await api.getMe();
        add('API accepts your login', true, `Signed in as ${me.displayName}, role ${me.role}`, null);
      } catch (e) {
        add('API accepts your login', false, `${e.status ?? ''} ${e.message}`.trim(), 'If this says the session was rejected, the frontend and backend use different Supabase projects (compare the Supabase URL and anon key in both Vercel projects).');
      }
    }
    setRunning(false);
  }, []);

  useEffect(() => { run(); }, [run]);

  return (
    <section className="card" aria-label="Connection check">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Connection check</h2>
        <button className="btn px-3 py-1" onClick={run} disabled={running}>{running ? 'Checking…' : 'Run again'}</button>
      </div>
      <ul className="space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.label}>
            <p><span aria-hidden="true" className={`mr-2 font-bold ${tone(r.ok)}`}>{mark(r.ok)}</span><span className="font-medium">{r.label}:</span> <span className="break-all text-muted">{r.detail}</span></p>
            {r.fix && <p className="ml-6 text-warning">{r.fix}</p>}
          </li>
        ))}
        {rows.length === 0 && <li className="text-muted">Running checks…</li>}
      </ul>
    </section>
  );
}