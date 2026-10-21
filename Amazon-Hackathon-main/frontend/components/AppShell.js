'use client';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { SearchContext } from '@/lib/SearchContext';
import { USE_MOCK } from '@/lib/api';

export default function AppShell({ children }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  return (
    <SearchContext.Provider value={query}>
      <div className="flex min-h-screen">
        <Sidebar open={open} collapsed={collapsed} onClose={() => setOpen(false)} onToggle={() => setCollapsed((c) => !c)} />
        {open && <button aria-label="Close menu" className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setOpen(false)} />}
        <div className="min-w-0 flex-1">
          <Topbar query={query} onQuery={setQuery} onMenu={() => setOpen(true)} />
          {USE_MOCK && (
            <div role="status" className="border-b border-line bg-warning/10 px-4 py-1.5 text-sm text-warning md:px-6">
              Demo mode: all data is simulated and nothing is saved to a server. Approvals cannot succeed until the backend is connected.
            </div>
          )}
          <main id="main" tabIndex={-1} className="mx-auto max-w-6xl p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SearchContext.Provider>
  );
}
