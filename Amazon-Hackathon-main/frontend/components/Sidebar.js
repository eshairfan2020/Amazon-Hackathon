'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [['Dashboard', '/overview'], ['SKUs', '/skus'], ['Settings', '/settings']];

export default function Sidebar({ open, collapsed, onClose, onToggle }) {
  const path = usePathname();
  return (
    <aside aria-label="Primary" className={`fixed inset-y-0 left-0 z-40 w-64 bg-sidebar p-3 transition-transform duration-200 md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'md:w-16' : 'md:w-60'}`}>
      <div className="mb-4 flex items-center justify-between px-2 py-2 text-lg font-bold">
        <span><span className="text-ai">⚓</span>{!collapsed && ' Anchor AI'}</span>
        <button className="hidden rounded-lg px-2 text-muted hover:bg-surfaceHover md:block" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? '»' : '«'}</button>
      </div>
      <nav className="space-y-1">
        {NAV.map(([label, href]) => {
          const active = path === href;
          return (
            <Link key={href} href={href} onClick={onClose} title={label} aria-current={active ? 'page' : undefined} className={`nav-link ${active ? 'nav-link-active' : ''}`}>
              <span className="w-5 text-center font-semibold">{label[0]}</span>
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
