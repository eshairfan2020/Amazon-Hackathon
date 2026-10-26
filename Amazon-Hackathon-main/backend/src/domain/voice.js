/** Natural-language helpers shared by the web voice simulator and the Alexa skill. Pure functions. */
const UNITS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const UNIT_WORDS = new Set(['unit', 'units', 'piece', 'pieces', 'pcs', 'bottle', 'bottles', 'box', 'boxes', 'pack', 'packs', 'carton', 'cartons']);

/** "20", "twenty five", "a hundred" -> integer, otherwise null. */
export function parseQuantity(raw) {
  const t = String(raw ?? '').toLowerCase().trim().split(/[\s-]+/).filter(Boolean);
  if (!t.length) return null;
  if (t.length === 1 && /^\d{1,6}$/.test(t[0])) return Number(t[0]);
  let total = 0;
  for (const w of t) {
    if (w === 'hundred') total = (total || 1) * 100;
    else if (w in TENS) total += TENS[w];
    else if (w in UNITS) total += UNITS[w];
    else if (w === 'and') continue;
    else return null;
  }
  return total > 0 ? total : null;
}

/** "body lotions" -> "Body Lotion". Keeps letters, digits and a few safe symbols. */
export function cleanProductName(raw) {
  let s = String(raw ?? '').toLowerCase().replace(/[^a-z0-9 &'./-]+/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^(?:the|some|my)\s+/, '');
  const words = s.split(' ').filter(Boolean);
  if (words.length && words[words.length - 1].length > 3 && words[words.length - 1].endsWith('s') && !words[words.length - 1].endsWith('ss')) words[words.length - 1] = words[words.length - 1].slice(0, -1);
  const name = words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  return name.length >= 2 && name.length <= 80 ? name : '';
}

const lead = /^(?:hey |ok |okay )?(?:alexa|anchor)[, ]*(?:inventory[, ]*)?|^(?:please|can you|could you|i want to|i would like to)\s+/;

/** Free text (typed or from browser speech recognition) -> { intent, slots }. */
export function parseCommand(text, pending = null) {
  let t = String(text ?? '').toLowerCase().replace(/[.!?,]+$/g, '').trim();
  for (let i = 0; i < 2; i += 1) t = t.replace(lead, '').replace(/^(?:tell|ask) anchor(?: inventory)?(?: to)?\s+/, '').trim();

  if (pending?.type === 'ask_quantity') {
    const q = parseQuantity(t);
    if (q) return { intent: 'add', slots: { product: pending.name, quantity: q } };
  }
  if (/^(yes|yeah|yep|yup|sure|confirm|go ahead|do it|ok|okay|correct|please do)$/.test(t)) return { intent: 'yes', slots: {} };
  if (/^(no|nope|cancel|stop|never ?mind|don't|do not)$/.test(t)) return { intent: 'no', slots: {} };
  if (/\b(help|what can you do)\b/.test(t)) return { intent: 'help', slots: {} };

  const add = /^(?:add|put|insert|include|i (?:got|received)|received|got)\s+(.+)$/.exec(t);
  if (add) {
    let rest = add[1].replace(/\s+(?:to|in|into|on)\s+(?:my\s+|the\s+)?(?:inventory|stock|store|list)$/, '').trim();
    const words = rest.split(' ');
    let n = 0;
    while (n < Math.min(3, words.length) && parseQuantity(words.slice(0, n + 1).join(' ')) != null) n += 1;
    const quantity = n ? parseQuantity(words.slice(0, n).join(' ')) : null;
    rest = words.slice(n).join(' ').replace(/^(?:of\s+)/, '');
    const parts = rest.split(' ');
    if (UNIT_WORDS.has(parts[0]) && parts[1] === 'of') rest = parts.slice(2).join(' ');
    else if (UNIT_WORDS.has(parts[0]) && parts.length > 1) rest = parts.slice(1).join(' ').replace(/^of\s+/, '');
    return { intent: 'add', slots: { quantity, product: rest } };
  }
  if (/\b(reorder|restock|order more)\b|what should i (?:order|buy)/.test(t)) return { intent: 'reorder', slots: {} };
  if (/\b(low|running out|run out|running low|short on|out of stock|stock ?out)\b/.test(t)) return { intent: 'low', slots: {} };
  const stock = /how (?:many|much) (.+?) (?:do i have|have i got|are (?:left|there|in stock)|is (?:left|in stock)|in stock|left)$/.exec(t)
    || /(?:stock|quantity|count|level) (?:of|for) (.+)$/.exec(t);
  if (stock) return { intent: 'stock', slots: { product: stock[1] } };
  return { intent: 'unknown', slots: {} };
}