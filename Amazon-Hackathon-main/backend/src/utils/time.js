export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** @param {number|string|Date} v */
export const toIso = (v) => new Date(v).toISOString();

/** Parse an ISO string to epoch ms; throws on garbage. */
export function parseIso(s) {
  const t = Date.parse(s);
  if (Number.isNaN(t)) throw new TypeError(`Invalid ISO timestamp: ${String(s).slice(0, 40)}`);
  return t;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Fri 16 Oct, 12:00 UTC" */
export function formatWhen(iso) {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${hh}:${mm} UTC`;
}

/** Default clock; tests and the demo inject their own. */
export const systemClock = () => Date.now();
