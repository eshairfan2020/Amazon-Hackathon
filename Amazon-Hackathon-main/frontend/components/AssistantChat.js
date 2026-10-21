
'use client';

import { useEffect, useRef, useState } from 'react';
import * as api from '@/lib/api';
import ContextChip from './ContextChip';
import EvidencePanel from './EvidencePanel';

const PROMPTS = [
  'What is at risk this week?',
  'Draft an update for Marcus',
  'Plan my week',
];

const CONTEXT = [
  'Week of 13 Oct',
  'Task T1',
  'Teammate: Marcus',
];

function ToolActivityTrace({ trace = [], demo }) {
  const validTrace = (Array.isArray(trace) ? trace : []).filter(
    (item) =>
      item &&
      (String(item.tool || '').trim() ||
        String(item.summary || '').trim())
  );

  if (validTrace.length === 0) return null;

  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-ai">
        Tool activity ({validTrace.length})
        {demo && ' · illustrative demo, no real tools were called'}
      </summary>

      <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
        {validTrace.map((item, index) => (
          <li key={`${item.tool || 'tool'}-${index}`}>
            {item.tool && (
              <code className="text-ink">{item.tool}</code>
            )}
            {item.tool && item.summary && ' · '}
            {item.summary || ''}
          </li>
        ))}
      </ol>
    </details>
  );
}

function ChatMessage({ m, onRetry }) {
  if (m.role === 'user') {
    return (
      <div className="ml-auto max-w-[90%] rounded-2xl bg-surfaceHover px-4 py-2">
        {m.text}
      </div>
    );
  }

  if (m.role === 'error') {
    return (
      <div
        role="alert"
        className="max-w-[90%] rounded-2xl border border-danger/60 px-4 py-2 text-sm"
      >
        <p className="text-danger">{m.text}</p>
        <button
          className="btn mt-2"
          onClick={() => onRetry(m.retry)}
        >
          Retry
        </button>
      </div>
    );
  }

  const plan = (Array.isArray(m.plan) ? m.plan : []).filter(
    (item) => typeof item === 'string' && item.trim().length > 0
  );

  const evidence = (
    Array.isArray(m.evidence) ? m.evidence : []
  ).filter(
    (item) =>
      item != null &&
      String(
        typeof item === 'object'
          ? item.summary || item.text || item.label || ''
          : item
      ).trim().length > 0
  );

  return (
    <div className="max-w-[90%] rounded-2xl border border-ai bg-surface px-4 py-3">
      <p className="text-sm text-ai">
        ✦ Anchor {m.demo && '(demo reply)'}
      </p>

      <p className="whitespace-pre-wrap">{m.text}</p>

      {plan.length > 0 && (
        <div className="mt-2 rounded-xl border border-line p-3 text-sm">
          <p className="font-medium">
            Plan preview{' '}
            <span className="text-muted">
              (nothing has been created)
            </span>
          </p>

          <ol className="list-decimal pl-5 text-muted">
            {plan.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ol>
        </div>
      )}

      {evidence.length > 0 && (
        <EvidencePanel items={evidence} />
      )}

      {m.trace && (
        <ToolActivityTrace trace={m.trace} demo={m.demo} />
      )}

      {m.next && (
        <p className="mt-2 text-sm">
          <b>Suggested next:</b> {m.next}
        </p>
      )}
    </div>
  );
}

export default function AssistantChat() {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [ctx, setCtx] = useState([CONTEXT[0]]);
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [msgs, busy]);

  async function send(t, isRetry = false) {
    const clean = t.trim();

    if (!clean || busy) return;

    if (!isRetry) {
      setMsgs((messages) => [
        ...messages,
        { role: 'user', text: clean },
      ]);
    }

    setText('');
    setBusy(true);

    try {
      const result = await api.sendMessage(clean, ctx);

      setMsgs((messages) => [
        ...messages.filter((message) => message.role !== 'error'),
        result,
      ]);
    } catch (error) {
      setMsgs((messages) => [
        ...messages,
        {
          role: 'error',
          text: error.message || 'Something went wrong.',
          retry: clean,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" aria-label="Context">
        {CONTEXT.map((context) => (
          <ContextChip
            key={context}
            label={context}
            active={ctx.includes(context)}
            onToggle={() =>
              setCtx((current) =>
                current.includes(context)
                  ? current.filter((item) => item !== context)
                  : [...current, context]
              )
            }
          />
        ))}
      </div>

      <div
        className="flex min-h-[40vh] flex-col gap-3"
        aria-live="polite"
      >
        {msgs.length === 0 && (
          <p className="text-muted">
            Ask about deadlines, conflicts or recovery plans.
            Replies in demo mode are illustrative.
          </p>
        )}

        {msgs.map((message, index) => (
          <ChatMessage
            key={index}
            m={message}
            onRetry={(retryText) => send(retryText, true)}
          />
        ))}

        {busy && (
          <p className="text-sm text-ai">Anchor is thinking…</p>
        )}

        <div ref={end} />
      </div>

      <div className="flex flex-wrap gap-2">
        {PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="chip"
            disabled={busy}
            onClick={() => send(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send(text);
        }}
      >
        <label htmlFor="composer" className="sr-only">
          Message
        </label>

        <input
          id="composer"
          className="input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ask Anchor…"
          maxLength={500}
        />

        <button
          type="submit"
          className="btn-primary"
          disabled={busy || !text.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}
