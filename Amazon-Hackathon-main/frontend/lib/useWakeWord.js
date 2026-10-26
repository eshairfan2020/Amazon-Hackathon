'use client';
import { useEffect, useRef } from 'react';
import { parseWake } from '@/lib/wake';

export const speechSupported = () => typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
const AWAKE_MS = 12000;

/**
 * Always-listening wake word ("Hi Alexa" / "Hi Anchor") using the browser's speech recognition.
 * Audio is processed by the browser's speech service; nothing reaches our server unless the wake word was heard.
 * `suspended` pauses listening (for example while the bot is speaking, so it does not hear itself).
 */
export function useWakeWord({ enabled, suspended, onWake, onCommand, onSleep, onStatus }) {
  const cbs = useRef({});
  cbs.current = { onWake, onCommand, onSleep, onStatus };
  const awakeUntil = useRef(0);

  useEffect(() => {
    const SR = typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!enabled || suspended || !SR) return undefined;
    let stopped = false;
    let rec = null;
    let restarts = [];

    const start = () => {
      if (stopped) return;
      rec = new SR();
      rec.lang = 'en-US';
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i += 1) {
          const r = e.results[i];
          if (!r.isFinal) continue;
          const p = parseWake(r[0].transcript, Date.now() < awakeUntil.current);
          if (p.kind === 'wake') { awakeUntil.current = Date.now() + AWAKE_MS; cbs.current.onWake?.(); }
          else if (p.kind === 'sleep') { awakeUntil.current = 0; cbs.current.onSleep?.(); }
          else if (p.kind === 'command') { awakeUntil.current = 0; cbs.current.onCommand?.(p.text); }
        }
      };
      rec.onerror = (e) => {
        if (['not-allowed', 'service-not-allowed'].includes(e.error)) { stopped = true; cbs.current.onStatus?.({ state: 'blocked' }); }
      };
      rec.onend = () => {
        if (stopped) return;
        const now = Date.now();
        restarts = restarts.filter((t) => now - t < 10000);
        restarts.push(now);
        if (restarts.length > 8) { stopped = true; cbs.current.onStatus?.({ state: 'error' }); return; }
        setTimeout(start, 400);
      };
      try { rec.start(); cbs.current.onStatus?.({ state: 'listening' }); } catch { setTimeout(start, 1000); }
    };
    start();
    return () => { stopped = true; try { rec?.abort(); } catch { /* already stopped */ } };
  }, [enabled, suspended]);

  return {
    /** Keep the "no wake word needed" window open, e.g. while waiting for a spoken yes/no. */
    extendAwake: (ms) => { awakeUntil.current = ms > 0 ? Date.now() + ms : 0; },
  };
}