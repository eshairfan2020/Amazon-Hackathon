export const ORDER_STATUS_META = {
  pending: { label: 'Waiting to ship', icon: '…', tone: 'border-warning/50 text-warning' },
  shipped: { label: 'In transit', icon: '➜', tone: 'border-secondary/60 text-secondary' },
  delivered: { label: 'Delivered', icon: '✓', tone: 'border-success/50 text-success' },
  returned: { label: 'Returned', icon: '↩', tone: 'border-highlight/50 text-highlight' },
  cancelled: { label: 'Cancelled', icon: '✕', tone: 'border-line text-muted' },
};
export const STATUS_OPTIONS = Object.keys(ORDER_STATUS_META);
export const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');
export const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
export const itemsSummary = (o) => `${o.lines[0].name}${o.lines.length > 1 ? ` +${o.lines.length - 1} more` : ''}`;