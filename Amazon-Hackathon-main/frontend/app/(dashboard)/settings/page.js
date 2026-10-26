'use client';
import { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import ConnectionCheck from '@/components/ConnectionCheck';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorState from '@/components/ErrorState';
import { useToast } from '@/components/Toast';
import { useAsync } from '@/lib/useAsync';
import * as api from '@/lib/api';

const ROLE_HELP = {
  admin: 'Admin: read, create, edit, import, delete SKUs and view the audit log.',
  manager: 'Manager: read, create, edit, import and export SKUs.',
  viewer: 'Viewer: read and export only.',
};

export default function SettingsPage() {
  const me = useAsync(api.getMe);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, show] = useToast();
  const [copied, setCopied] = useState(false);
  const canWrite = ['admin', 'manager'].includes(me.data?.role);
  async function copyId() {
    try { await navigator.clipboard.writeText(me.data.userId); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { show('Copy failed. Select the ID and copy it manually.', 'border-danger'); }
  }

  async function loadDemo() {
    setBusy(true);
    try { const r = await api.loadDemoData(); show(`Loaded ${r.loaded} synthetic demo SKUs`); } catch (e) { show(e.message, 'border-danger'); } finally { setBusy(false); setConfirm(false); }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Your account and demo data" />
      <div className="mb-4 max-w-2xl"><ConnectionCheck /></div>
      {me.loading && <LoadingSkeleton rows={2} />}
      {me.error && <ErrorState message={me.error} onRetry={me.reload} />}
      {me.data && (
        <div className="grid max-w-2xl gap-4">
          <section className="card">
            <h2 className="mb-2 font-semibold">Account</h2>
            <p>{me.data.displayName}</p>
            {me.data.email && <p className="text-sm text-muted">{me.data.email}</p>}
            <p className="mt-2 text-sm text-muted">{ROLE_HELP[me.data.role]}</p>
          </section>
          <section className="card">
            <h2 className="mb-1 font-semibold">Demo data</h2>
            <p className="mb-3 text-sm text-muted">Loads 30 synthetic Amazon-style SKUs with 90 days of sales. Only works on an empty catalog. No Amazon credentials are used.</p>
            <button className="btn-primary" disabled={!canWrite || busy} onClick={() => setConfirm(true)}>Load demo data</button>
            {!canWrite && <p className="mt-2 text-sm text-muted">Your role cannot load demo data.</p>}
          </section>
          <section className="card" aria-label="Alexa link">
            <h2 className="mb-1 font-semibold">Alexa link</h2>
            <p className="mb-2 text-sm text-muted">Needed to connect the Anchor Inventory Alexa skill to this account (demo linking). Use this ID in the backend setting ALEXA_LINKS as <code>&lt;alexa link id&gt;:&lt;this id&gt;</code>.</p>
            <p className="break-all rounded-xl border border-line p-2 text-sm">{me.data.userId}</p>
            <button className="btn mt-2" onClick={copyId}>{copied ? 'Copied' : 'Copy my Anchor user ID'}</button>
          </section>
        </div>
      )}
      {confirm && <ConfirmDialog title="Load demo data?" message="This adds 30 synthetic SKUs to your empty catalog." confirmLabel="Load demo data" busy={busy} onConfirm={loadDemo} onCancel={() => setConfirm(false)} />}
      {toast}
    </>
  );
}