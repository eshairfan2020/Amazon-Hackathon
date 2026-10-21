import StatusBadge from './StatusBadge';

export default function ApprovalCard({ item, onApprove, onEdit, onReject }) {
  const actionable = item.status === 'pending' || item.status === 'failed';
  return (
    <article className={item.status === 'pending' ? 'card-ai' : 'card'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{item.type}</h3>
        <StatusBadge status={item.status} />
      </div>
      {item.teammate && <p className="text-sm text-muted">To {item.teammate} · Communication style: {item.style}</p>}
      <p className="my-2 rounded-xl border border-line p-3 text-sm">{item.body}</p>
      {item.error && <p role="alert" className="text-sm text-danger">{item.error}</p>}
      {actionable && (
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => onApprove(item)}>Approve</button>
          {item.teammate && <button className="btn" onClick={() => onEdit(item)}>Edit</button>}
          <button className="btn" onClick={() => onReject(item)}>Reject</button>
        </div>
      )}
    </article>
  );
}
