export const CLASS_META = {
  healthy: { label: 'Healthy', icon: '✓', tone: 'border-success/50 text-success', fill: 'fill-success' },
  low_stock: { label: 'Low Stock', icon: '▼', tone: 'border-warning/50 text-warning', fill: 'fill-warning' },
  critical: { label: 'Critical Stockout Risk', icon: '⚠', tone: 'border-danger/50 text-danger', fill: 'fill-danger' },
  overstock: { label: 'Overstock', icon: '▲', tone: 'border-secondary/60 text-secondary', fill: 'fill-secondary' },
  slow_moving: { label: 'Slow Moving', icon: '◔', tone: 'border-highlight/50 text-highlight', fill: 'fill-highlight' },
  stranded: { label: 'Stranded Inventory', icon: '⛔', tone: 'border-line text-muted', fill: 'fill-muted' },
};

export const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0);
export const money2 = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);
export const num = (n) => new Intl.NumberFormat('en-US').format(n ?? 0);
export const dash = (v, suffix = '') => (v == null ? '-' : `${v}${suffix}`);
export const shortDate = (d) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '-');
export const STATUSES = ['active', 'inactive', 'stranded'];
