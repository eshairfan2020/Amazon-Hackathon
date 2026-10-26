'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import AnchorBot from './AnchorBot';
import * as api from '@/lib/api';

const CHIPS = ['What is running low?', 'What should I reorder today?', 'Add 20 body lotions to my inventory'];
const Recognition = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);

/** Greeting and mood come from the dashboard numbers, never from guesses. */
export function greet(t, filtered = false) {
  const scope = filtered ? 'In this view, ' : '';
  if (!t || t.totalSkus === 0) {
    return { mood: 'happy', text: filtered ? 'No products match these filters. Try clearing one.' : "Hi, I'm Anchor Bot! Add your products or load the demo data, and I'll start watching your stock." };
  }
  if (t.criticalStock > 0) {
    const n = t.criticalStock;
    return { mood: 'worried', text: `${scope}${n} ${n === 1 ? 'product could' : 'products could'} run out soon. Ask me below and I'll tell you what to reorder.` };
  }
  if (t.lowStock > 0) return { mood: 'happy', text: `${scope}${t.lowStock} ${t.lowStock === 1 ? 'product is' : 'products are'} getting low, but nothing is urgent yet.` };
  if (t.overstock + t.slowMoving > 0) return { mood: 'happy', text: `${scope}Stock levels look safe. ${t.overstock + t.slowMoving} products sit on the shelf longer than needed, so a promo could free up cash.` };
  return { mood: 'happy', text: `${scope}Everything looks healthy. Nothing needs your attention right now!` };
}

export default function BotCard({ totals, filtered = false }) {
  const base = useMemo(() => greet(totals, filtered), [totals, filtered]);
  const [mode, setMode] = useState('idle'); // idle | listening | thinking | speaking
  const [reply, setReply] = useState(null); // { you, text, mood, action }
  const [pending, setPending] = useState(null);
  const [text, setText] = useState('');
  const [voiceOn, setVoiceOn] = useState(true);
  const [canListen, setCanListen] = useState(false);
  const [note, setNote] = useState('');
  const rec = useRef(null);
  const heard = useRef(false);

  useEffect(() => {
    setCanListen(Boolean(Recognition()));
    return () => { rec.current?.abort?.(); window.speechSynthesis?.cancel(); };
  }, []);

  const busy = mode === 'thinking';
  const mood = mode !== 'idle' ? mode : reply?.mood ?? base.mood;
  const bubble = reply ? reply.text : base.text;
  const confirming = pending && ['create', 'receive'].includes(pending.type);

  async function send(raw) {
    const t = raw.trim();
    if (!t || busy) return;
    window.speechSynthesis?.cancel();
    setMode('thinking'); setNote(''); setText('');
    try {
      const r = await api.voiceCommand(t, pending);
      setPending(r.pending);
      setReply({ you: t, text: r.speech, mood: 'happy', action: r.action });
      if (voiceOn && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(r.speech);
        u.onstart = () => setMode('speaking');
        u.onend = () => setMode('idle');
        u.onerror = () => setMode('idle');
        window.speechSynthesis.speak(u);
      } else setMode('idle');
    } catch (e) {
      setReply({ you: t, text: e.message, mood: 'worried', error: true });
      setMode('idle');
    }
  }

  function listen() {
    const SR = Recognition();
    if (!SR) return;
    window.speechSynthesis?.cancel();
    const r = new SR();
    r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 1;
    heard.current = false;
    r.onresult = (e) => { heard.current = true; send(e.results[0][0].transcript); };
    r.onerror = (e) => { setNote(e.error === 'not-allowed' ? 'Microphone permission was denied. Allow it in the browser address bar, or type instead.' : `I could not hear that (${e.error}). You can type instead.`); setMode('idle'); };
    r.onend = () => { if (!heard.current) setMode((m) => (m === 'listening' ? 'idle' : m)); };
    rec.current = r;
    setNote(''); setMode('listening');
    r.start();
  }

  return (
    <section className="card-ai mb-4" aria-label="Anchor Bot">
      <div className="flex flex-col items-center gap-4 md:flex-row md:items-start">
        <AnchorBot mood={mood} wave={!reply} className="h-36 w-32 shrink-0" />
        <div className="w-full min-w-0 flex-1">
          <div className="relative rounded-2xl border border-line bg-bg px-4 py-3">
            <span aria-hidden="true" className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l border-t border-line bg-bg md:-left-2 md:top-6 md:translate-x-0 md:border-b md:border-t-0" />
            <p className="text-sm font-semibold text-ai">Anchor Bot</p>
            {reply && <p className="mb-1 text-xs text-muted">You: {reply.you}</p>}
            <p role="status" aria-live="polite" className={reply?.error ? 'text-danger' : ''}>{mode === 'listening' ? 'I am listening…' : mode === 'thinking' ? 'Let me check…' : bubble}</p>
            {reply?.action && <span className="pill mt-2 border-success/50 text-success">{reply.action.type === 'created' ? 'Draft created' : 'Stock updated'}</span>}
          </div>

          {confirming && (
            <div className="mt-3 flex gap-2" role="group" aria-label="Confirm change">
              <button className="btn-primary" disabled={busy} onClick={() => send('yes')}>Yes, do it</button>
              <button className="btn" disabled={busy} onClick={() => send('no')}>No, cancel</button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className={mode === 'listening' ? 'btn-primary' : 'btn-secondary'} onClick={listen} disabled={!canListen || busy || mode === 'listening'} aria-pressed={mode === 'listening'}>{mode === 'listening' ? 'Listening…' : '🎙 Talk to me'}</button>
            {CHIPS.map((c) => <button key={c} className="chip" disabled={busy} onClick={() => send(c)}>{c}</button>)}
            {reply && <button className="text-sm text-secondary underline" onClick={() => { setReply(null); setPending(null); window.speechSynthesis?.cancel(); setMode('idle'); }}>Back to summary</button>}
          </div>

          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <label htmlFor="bot-input" className="sr-only">Type a message for Anchor Bot</label>
            <input id="bot-input" className="input" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="Or type to me, e.g. how many yoga mats do I have?" autoComplete="off" />
            <button className="btn" disabled={busy || !text.trim()}>Send</button>
          </form>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-ai" checked={voiceOn} onChange={(e) => { setVoiceOn(e.target.checked); if (!e.target.checked) window.speechSynthesis?.cancel(); }} /> Speak replies</label>
            <span>Same brain as our Alexa skill. {!canListen && 'Voice input needs Chrome or Edge.'}</span>
          </div>
          {note && <p role="alert" className="err mt-1">{note}</p>}
        </div>
      </div>
    </section>
  );
}