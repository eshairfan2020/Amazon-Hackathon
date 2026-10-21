'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NotificationPanel from './NotificationPanel';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';

export default function Topbar({ query, onQuery, onMenu }) {
  const router = useRouter();
  const { user, displayName, loading } = useAuth();

  const initials = displayName
    ? displayName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase()
    : '?';

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Sign-out failed:', error.message);
      return;
    }

    router.replace('/login');
  }

  return (
    <header className="flex items-center gap-3 border-b border-line bg-bg px-4 py-3 md:px-6">
      <button
        type="button"
        className="btn md:hidden"
        onClick={onMenu}
        aria-label="Open menu"
      >
        ☰
      </button>

      <span className="hidden text-sm text-muted lg:block">
        Workspace: Anchor Inventory
      </span>

      <input
        type="search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Search SKUs, ASINs, products"
        aria-label="Search SKUs, ASINs, products"
        className="input max-w-sm flex-1"
      />

      <div className="ml-auto flex items-center gap-2">
        <NotificationPanel />

        <div className="flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <p className="max-w-36 truncate text-sm font-medium text-ink">
              {loading ? 'Loading…' : displayName || 'Not signed in'}
            </p>
            {user?.email && (
              <p className="max-w-36 truncate text-xs text-muted">
                {user.email}
              </p>
            )}
          </div>

          <Link
            href="/settings"
            aria-label="Profile and settings"
            title={displayName || 'Profile and settings'}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-ai/40 bg-ai/10 p-0 text-sm font-semibold text-ai"
          >
            {initials}
          </Link>

          {user && (
            <button
              type="button"
              onClick={handleSignOut}
              className="btn text-sm"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}