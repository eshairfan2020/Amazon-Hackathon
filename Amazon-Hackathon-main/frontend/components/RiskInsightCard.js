import EvidencePanel from './EvidencePanel';

export default function RiskInsightCard({ insight }) {
  return (
    <section className="card-ai" aria-label="AI insight">
      <h2 className="mb-1 font-semibold text-ai">✦ AI insight {insight.demo !== false && <span className="text-xs text-muted">(demo content)</span>}</h2>
      <p>{insight.summary}</p>
      <EvidencePanel items={insight.evidence} />
      <p className="mt-3 text-sm"><b>Recommended next action:</b> {insight.next}</p>
    </section>
  );
}
