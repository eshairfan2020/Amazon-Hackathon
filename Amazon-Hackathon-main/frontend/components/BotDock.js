'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AnchorBot from './AnchorBot';
import * as api from '@/lib/api';
import { greet } from '@/lib/botGreeting';
import { speechSupported, useWakeWord } from '@/lib/useWakeWord';

const KEY = 'anchor-hands-free';
const CHIPS = ['What is running low?', 'What should I reorder today?', 'Add 20 body lotions to my inventory'];
const store = {
  get: () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } },
  set: (on) => { try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* storage unavailable */ } },
};

/**
 * Floating Anchor Bot on the right of the dashboard. Click it to open the chat card.
 * With hands-free on it also answers "Hi Alexa" / "Hi Anchor" without any click.
 */
export default function BotDock({ totals, filtered = false }) {
  const base = useMemo(() => greet(totals, filtered), [totals, filtered]);
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState([]);
  const [pending, setPending] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [awake, setAwake] = useState(false);
  const [bubble, setBubble] = useState(null); // { text, error?, confirm?, tapNote? }
  const [text, setText] = useState('');
  const [voiceOn, setVoiceOn] = useState(true);
  const [supported, setSupported] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState('off'); // off | listening | blocked | error
  const [note, setNote] = useState('');
  const pendingRef = useRef(null);
  const busy = useRef(false);
  const activated = useRef(false);
  const awakeTimer = useRef(null);
  const wakeApi = useRef(null);
  const sendRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);

  // Browsers only allow the bot to talk after the visitor has interacted with the page once.
  useEffect(() => {
    const mark = () => { activated.current = true; };
    window.addEventListener('pointerdown', mark, { once: true });
    window.addEventListener('keydown', mark, { once: true });
    return () => { window.removeEventListener('pointerdown', mark); window.removeEventListener('keydown', mark); window.speechSynthesis?.cancel(); };
  }, []);

  // Resume hands-free automatically if the visitor enabled it before and the browser still allows the microphone.
  useEffect(() => {
    const ok = speechSupported();
    setSupported(ok);
    if (!ok || !store.get()) return;
    navigator.permissions?.query({ name: 'microphone' }).then((p) => { if (p.state === 'granted') setHandsFree(true); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!bubble || bubble.confirm) return undefined;
    const t = setTimeout(() => setBubble(null), 10000);
    return () => clearTimeout(t);
  }, [bubble]);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ block: 'end' }); }, [open, log, thinking]);

  const say = useCallback((line) => {
    if (!voiceOn || !('speechSynthesis' in window)) return false;
    const canTalk = activated.current || navigator.userActivation?.hasBeenActive;
    if (!canTalk) return false;
    const u = new SpeechSynthesisUtterance(line);
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setTimeout(() => setSpeaking(false), Math.min(15000, 3000 + line.length * 80)); // never stay deaf if the browser misses an event
    return true;
  }, [voiceOn]);

  const wake = useWakeWord({
    enabled: handsFree,
    suspended: speaking,
    onWake: () => {
      const hello = "Yes? I'm listening.";
      setAwake(true);
      clearTimeout(awakeTimer.current);
      awakeTimer.current = setTimeout(() => setAwake(false), 12000);
      const talked = say(hello);
      setBubble({ text: hello, tapNote: !talked && voiceOn });
    },
    onSleep: () => { setAwake(false); setBubble({ text: 'Okay, I will be here if you need me.' }); },
    onCommand: (cmd) => sendRef.current?.(cmd, true),
    onStatus: (s) => {
      setStatus(s.state);
      if (s.state === 'blocked') { setHandsFree(false); store.set(false); setNote('The microphone is blocked. Allow it in the browser address bar to use "Hi Alexa".'); }
      if (s.state === 'error') { setHandsFree(false); setNote('Hands-free listening stopped because the browser kept ending it. You can turn it on again.'); }
    },
  });
  wakeApi.current = wake;

  const send = useCallback(async (raw, viaVoice = false) => {
    const t = raw.trim();
    if (!t || busy.current) return;
    busy.current = true;
    setThinking(true); setNote(''); setText('');
    setLog((l) => [...l, { who: 'you', text: t, voice: viaVoice }]);
    try {
      const r = await api.voiceCommand(t, pendingRef.current);
      pendingRef.current = r.pending;
      setPending(r.pending);
      setLog((l) => [...l, { who: 'bot', text: r.speech, action: r.action }]);
      const talked = say(r.speech);
      const confirm = Boolean(r.pending && ['create', 'receive'].includes(r.pending.type));
      setBubble({ text: r.speech, confirm, tapNote: !talked && voiceOn });
      wakeApi.current?.extendAwake(r.pending ? 15000 : 0);
      setAwake(Boolean(r.pending));
    } catch (e) {
      setLog((l) => [...l, { who: 'bot', text: e.message, error: true }]);
      setBubble({ text: e.message, error: true });
      setAwake(false);
    } finally {
      busy.current = false;
      setThinking(false);
    }
  }, [say, voiceOn]);
  sendRef.current = send;

  const enable = () => { setConsent(false); setNote(''); setHandsFree(true); store.set(true); };
  const disable = () => { setHandsFree(false); setAwake(false); setStatus('off'); store.set(false); };

  const mood = speaking ? 'speaking' : thinking ? 'thinking' : awake ? 'listening' : base.mood;
  const confirming = pending && ['create', 'receive'].includes(pending.type);
  const listeningNow = handsFree && status === 'listening';

  return (
    <div className="fixed bottom-4 right-4 z-30 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 md:bottom-6 md:right-6">
      {open && (
        <section id="bot-chat" role="region" aria-label="Anchor Bot chat" className="card-ai flex max-h-[70vh] w-[22rem] max-w-full flex-col shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-ai">Anchor Bot</h2>
            <button className="btn px-2 py-1" onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" role="log" aria-live="polite" aria-label="Conversation">
            <p className="max-w-[92%] rounded-2xl border border-ai px-3 py-1.5 text-sm"><span className="text-ai">✦ </span>{base.text}</p>
            {log.map((m, i) => (
              <p key={i} className={m.who === 'you' ? 'ml-auto max-w-[88%] rounded-2xl bg-surfaceHover px-3 py-1.5 text-sm' : `max-w-[92%] rounded-2xl border px-3 py-1.5 text-sm ${m.error ? 'border-danger/60 text-danger' : 'border-ai'}`}>
                {m.who === 'bot' && <span className="text-ai">✦ </span>}{m.voice && <span aria-label="said aloud">🎙 </span>}{m.text}
                {m.action && <span className="ml-2 pill border-success/50 text-success">{m.action.type === 'created' ? 'Draft created' : 'Stock updated'}</span>}
              </p>
            ))}
            {thinking && <p className="text-sm text-ai" role="status">Let me check…</p>}
            <div ref={endRef} />
          </div>
          {confirming && (
            <div className="mt-2 flex gap-2" role="group" aria-label="Confirm change">
              <button className="btn-primary" disabled={thinking} onClick={() => send('yes')}>Yes, do it</button>
              <button className="btn" disabled={thinking} onClick={() => send('no')}>No, cancel</button>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">{CHIPS.map((c) => <button key={c} className="chip" disabled={thinking} onClick={() => send(c)}>{c}</button>)}</div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <label htmlFor="bot-input" className="sr-only">Type a message for Anchor Bot</label>
            <input id="bot-input" ref={inputRef} className="input" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" autoComplete="off" />
            <button className="btn-primary" disabled={thinking || !text.trim()}>Send</button>
          </form>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-ai" checked={voiceOn} onChange={(e) => { setVoiceOn(e.target.checked); if (!e.target.checked) window.speechSynthesis?.cancel(); }} /> Speak replies</label>
            {supported && (handsFree
              ? <button className="underline" onClick={disable}>Turn off hands-free</button>
              : <button className="underline" onClick={() => setConsent(true)}>Turn on hands-free</button>)}
          </div>
          {note && <p role="alert" className="err mt-1">{note}</p>}
        </section>
      )}

      {!open && bubble && (
        <div role="status" aria-live="polite" className="card-ai max-w-xs text-sm shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <p className={bubble.error ? 'text-danger' : ''}>{bubble.text}</p>
            <button className="text-muted hover:text-ink" aria-label="Dismiss message" onClick={() => setBubble(null)}>✕</button>
          </div>
          {bubble.confirm && (
            <div className="mt-2 flex gap-2" role="group" aria-label="Confirm change">
              <button className="btn-primary px-3 py-1" disabled={thinking} onClick={() => { setBubble(null); send('yes'); }}>Yes</button>
              <button className="btn px-3 py-1" disabled={thinking} onClick={() => { setBubble(null); send('no'); }}>No</button>
              <span className="self-center text-xs text-muted">or say yes / no</span>
            </div>
          )}
          {bubble.tapNote && <p className="mt-1 text-xs text-warning">Click anywhere on the page once so I can talk back.</p>}
        </div>
      )}

      {consent && !handsFree && (
        <div role="dialog" aria-label="Turn on hands-free" className="card-ai max-w-xs text-sm shadow-xl">
          <p className="mb-1 font-semibold">Turn on hands-free?</p>
          <p className="mb-2 text-muted">I will listen for &ldquo;Hi Alexa&rdquo; or &ldquo;Hi Anchor&rdquo;. While this is on, your browser&apos;s speech service (in Chrome, a cloud service) processes microphone audio. Nothing is sent to Anchor until you say the wake word. You can turn it off any time.</p>
          <div className="flex gap-2"><button className="btn-primary px-3 py-1" onClick={enable}>Turn on</button><button className="btn px-3 py-1" onClick={() => setConsent(false)}>Not now</button></div>
        </div>
      )}

      {supported && !handsFree && !consent && !open && !bubble && (
        <button className="chip shadow-lg" onClick={() => setConsent(true)}>🎙 Say “Hi Alexa”: tap to enable</button>
      )}
      {listeningNow && <p role="status" className="rounded-full border border-success/50 bg-sidebar px-3 py-1 text-xs text-success">🎙 Listening for “Hi Alexa”</p>}
      {!open && note && <p role="alert" className="max-w-xs rounded-xl border border-danger/60 bg-sidebar px-3 py-1 text-xs text-danger">{note}</p>}

      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="bot-chat" aria-label={open ? 'Close Anchor Bot chat' : 'Open Anchor Bot chat'} className="rounded-full">
        <AnchorBot mood={mood} wave={!log.length && !handsFree} className="h-28 w-24 drop-shadow-lg md:h-36 md:w-32" />
      </button>
    </div>
  );
}