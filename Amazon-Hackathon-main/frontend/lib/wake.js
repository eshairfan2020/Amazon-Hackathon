// Wake-word parsing. Pure function so it can be tested without a browser.
// Only an utterance that STARTS with the wake phrase (or follows one within the awake window) is acted on.
const WAKE = /^\s*(?:(?:hi|hey|hello|ok|okay)[\s,]+)?(?:alexa|alexia|alexis|anchor(?: bot)?)\b[\s,.!?]*(.*)$/i;
const SLEEP = /^(?:stop|stop listening|goodbye|bye|that'?s all|never ?mind|thanks|thank you)[.!]?$/i;

/** @returns {{kind:'ignore'}|{kind:'wake'}|{kind:'sleep'}|{kind:'command', text:string}} */
export function parseWake(transcript, awake = false) {
  const t = String(transcript ?? '').trim();
  if (!t) return { kind: 'ignore' };
  const m = WAKE.exec(t);
  if (m) {
    const rest = m[1].trim();
    return rest ? { kind: 'command', text: rest } : { kind: 'wake' };
  }
  if (!awake) return { kind: 'ignore' };
  if (SLEEP.test(t)) return { kind: 'sleep' };
  return { kind: 'command', text: t };
}