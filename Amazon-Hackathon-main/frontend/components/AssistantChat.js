'use client';
import { useEffect, useRef, useState } from 'react';
import * as api from '@/lib/api';
import { money2 } from '@/lib/inventory';

const STARTERS = ['How is my inventory doing?', 'What should I reorder today?', 'Which products are overstocked?', 'Which products have the lowest margin?'];
const WELCOME = 'Hi! I am your inventory and pricing partner. I use your real stock and sales numbers to help you decide what to do next: what to reorder, what is tying up cash, and how to price for a healthy profit. I can only read your data, never change it. Where would you like to start?';

// Minimal safe formatter: **bold** and "- " bullets. No HTML is ever injected.
const inline = (t) => t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p));
function RichText({ text }) {
  return (
    <div className="space-y-2">
      {text.split(/\n{2,}/).map((block, i) => {
        const lines = block.split('\n');
        if (lines.every((l) => l.startsWith('- '))) return <ul key={i} className="list-disc space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>;
        return <p key={i} className="whitespace-pre-line">{inline(block)}</p>;
      })}
    </div>
  );
}

function PricingCard({ card }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[460px] text-left text-sm">
        <caption className="px-3 py-2 text-left font-medium">{card.title} <span className="text-xs text-muted">(fees assumed at {card.feePct}%)</span></caption>
        <thead className="text-muted"><tr><th scope="col" className="px-3 py-1 font-medium">Option</th><th scope="col" className="px-3 font-medium">Price</th><th scope="col" className="px-3 font-medium">Fees</th><th scope="col" className="px-3 font-medium">Profit/unit</th><th scope="col" className="px-3 font-medium">Margin</th></tr></thead>
        <tbody>
          {card.options.map((o) => (
            <tr key={o.key} className="border-t border-line">
              <th scope="row" className="px-3 py-1 text-left font-normal">{o.label}</th>
              <td className="px-3">{money2(o.price)}</td>
              <td className="px-3">{money2(o.fees)}</td>
              <td className={`px-3 ${o.unitProfit <= 0 ? 'text-danger' : ''}`}>{money2(o.unitProfit)}</td>
              <td className="px-3">{o.marginPct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-1 text-xs text-muted">Break-even price: {money2(card.breakEven)}. Estimates only; no competitor or demand data is used.</p>
    </div>
  );
}

const sourceLabel = (m) => (m.source === 'bedrock' ? 'Written by Amazon Bedrock from your data' : m.fallback ? 'AI model unavailable, answered by the built-in analyst' : 'Built-in analyst using your inventory data');

export default function AssistantChat() {
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: WELCOME, suggestions: STARTERS, welcome: true }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy, error]);

  async function send(raw, base = msgs) {
    const message = raw.trim();
    if (!message || busy) return;
    const next = [...base, { role: 'user', content: message }];
    setMsgs(next); setText(''); setError(null); setBusy(true);
    const history = base.filter((m) => !m.welcome).slice(-10).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
    try {
      const r = await api.chat(message, history);
      setMsgs([...next, { role: 'assistant', content: r.reply, suggestions: r.suggestions, card: r.card, source: r.source, fallback: r.fallback }]);
    } catch (e) {
      setError({ message: e.message, retry: message, base });
    } finally {
      setBusy(false);
    }
  }

  const lastIdx = msgs.length - 1;
  return (
    <div className="card flex min-h-[60vh] flex-col">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-muted">Read-only: I explain and recommend, I never change your inventory.</p>
        <button className="btn px-3 py-1" disabled={busy} onClick={() => { setMsgs([msgs[0]]); setError(null); }}>Clear chat</button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto" role="log" aria-live="polite" aria-label="Conversation">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'ml-auto max-w-[90%] rounded-2xl bg-surfaceHover px-4 py-2' : 'max-w-[95%] rounded-2xl border border-ai bg-surface px-4 py-3'}>
            {m.role === 'assistant' && <p className="mb-1 text-sm text-ai">✦ Anchor</p>}
            {m.role === 'user' ? <p>{m.content}</p> : <RichText text={m.content} />}
            {m.card && <PricingCard card={m.card} />}
            {m.role === 'assistant' && !m.welcome && <p className="mt-2 text-xs text-muted">{sourceLabel(m)}</p>}
            {i === lastIdx && m.suggestions?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {m.suggestions.map((s) => <button key={s} className="chip" disabled={busy} onClick={() => send(s)}>{s}</button>)}
              </div>
            )}
          </div>
        ))}
        {busy && <p className="text-sm text-ai" role="status">Anchor is checking your numbers…</p>}
        {error && (
          <div role="alert" className="max-w-[95%] rounded-2xl border border-danger/60 px-4 py-2 text-sm">
            <p className="text-danger">{error.message}</p>
            <button className="btn mt-2" onClick={() => send(error.retry, error.base)}>Try again</button>
          </div>
        )}
        <div ref={end} />
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <label htmlFor="chat-input" className="sr-only">Ask Anchor</label>
        <input id="chat-input" className="input" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder='Ask about stock, reorders or prices, e.g. "cost 10, sell at 25, what is my profit?"' autoComplete="off" />
        <button className="btn-primary" disabled={busy || !text.trim()}>Send</button>
      </form>
    </div>
  );
}