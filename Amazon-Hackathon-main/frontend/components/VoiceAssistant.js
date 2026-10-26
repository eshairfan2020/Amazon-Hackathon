'use client';
import { useEffect, useRef, useState } from 'react';
import * as api from '@/lib/api';

const EXAMPLES = ['Add 20 body lotions to my inventory', 'How many yoga mats do I have?', 'What is running low?', 'What should I reorder today?'];
const Recognition = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);

/**
 * In-app voice simulator. It sends what you say to the same command engine as the Alexa skill, so judges can try it
 * without an Echo. Changes always need a confirmation ("yes"), exactly like the Alexa flow.
 */
export default function VoiceAssistant() {
  const [log, setLog] = useState([]);
  const [pending, setPending] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(true);
  const [canListen, setCanListen] = useState(false);
  const [note, setNote] = useState('');
  const rec = useRef(null);
  const end = useRef(null);

  useEffect(() => {
    setCanListen(Boolean(Recognition()));
    return () => { rec.current?.abort?.(); window.speechSynthesis?.cancel(); };
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [log, busy]);

  async function send(raw) {
    const t = raw.trim();
    if (!t || busy) return;
    setLog((l) => [...l, { who: 'you', text: t }]);
    setText(''); setBusy(true); setNote('');
    try {
      const r = await api.voiceCommand(t, pending);
      setPending(r.pending);
      setLog((l) => [...l, { who: 'anchor', text: r.speech, action: r.action }]);
      if (speak && 'speechSynthesis' in window) { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(r.speech)); }
    } catch (e) {
      setLog((l) => [...l, { who: 'anchor', text: e.message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  function listen() {
    const SR = Recognition();
    if (!SR) return;
    const r = new SR();
    r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e) => send(e.results[0][0].transcript);
    r.onerror = (e) => { setNote(e.error === 'not-allowed' ? 'Microphone permission was denied. Allow it in the browser address bar, or type your command.' : `Speech recognition stopped (${e.error}). You can type instead.`); setListening(false); };
    r.onend = () => setListening(false);
    rec.current = r;
    setNote(''); setListening(true);
    r.start();
  }

  const confirming = pending && ['create', 'receive'].includes(pending.type);
  return (
    <section className="card-ai mb-4" aria-label="Voice commands">
      <h2 className="font-semibold text-ai">🎙 Voice commands</h2>
      <p className="mb-3 text-xs text-muted">Browser voice simulator: the same command engine as our Alexa skill, so you can try it without an Echo. Changes always ask you to confirm first.</p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className={listening ? 'btn-primary' : 'btn-secondary'} onClick={listen} disabled={!canListen || listening || busy} aria-pressed={listening}>{listening ? 'Listening…' : '🎙 Tap and speak'}</button>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-ai" checked={speak} onChange={(e) => setSpeak(e.target.checked)} /> Speak replies</label>
        {!canListen && <span className="text-xs text-warning">Voice input needs Chrome or Edge. You can still type a command.</span>}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">{EXAMPLES.map((x) => <button key={x} className="chip" disabled={busy} onClick={() => send(x)}>{x}</button>)}</div>
      <div className="max-h-64 space-y-2 overflow-y-auto" role="log" aria-live="polite" aria-label="Voice conversation">
        {log.length === 0 && <p className="text-sm text-muted">Try: &ldquo;Add 20 body lotions to my inventory&rdquo;.</p>}
        {log.map((m, i) => (
          <div key={i} className={m.who === 'you' ? 'ml-auto max-w-[90%] rounded-2xl bg-surfaceHover px-3 py-1.5 text-sm' : `max-w-[95%] rounded-2xl border px-3 py-1.5 text-sm ${m.error ? 'border-danger/60 text-danger' : 'border-ai'}`}>
            {m.who === 'anchor' && <span className="text-ai">✦ </span>}{m.text}
            {m.action && <span className="ml-2 pill border-success/50 text-success">{m.action.type === 'created' ? 'Draft created' : 'Stock updated'}</span>}
          </div>
        ))}
        {busy && <p className="text-sm text-ai" role="status">Anchor is working…</p>}
        <div ref={end} />
      </div>
      {confirming && (
        <div className="mt-3 flex gap-2" role="group" aria-label="Confirm change">
          <button className="btn-primary" disabled={busy} onClick={() => send('yes')}>Yes, do it</button>
          <button className="btn" disabled={busy} onClick={() => send('no')}>No, cancel</button>
        </div>
      )}
      {note && <p role="alert" className="err mt-2">{note}</p>}
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <label htmlFor="voice-input" className="sr-only">Type a voice command</label>
        <input id="voice-input" className="input" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder='Type a command, e.g. "add 20 body lotions"' autoComplete="off" />
        <button className="btn" disabled={busy || !text.trim()}>Send</button>
      </form>
    </section>
  );
}