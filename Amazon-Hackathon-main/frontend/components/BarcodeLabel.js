// EAN-13 / UPC-A label drawn as SVG (no libraries). White background + quiet zones so phone cameras can scan it from a screen.
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const R = L.map((c) => [...c].map((b) => (b === '1' ? '0' : '1')).join(''));
const G = R.map((c) => [...c].reverse().join(''));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** Returns a valid 13-digit EAN (UPC-A gets a leading 0) or null. */
export function normalizeEan(code) {
  let c = String(code || '').trim();
  if (/^\d{12}$/.test(c)) c = `0${c}`;
  if (!/^\d{13}$/.test(c)) return null;
  const d = [...c].map(Number);
  const sum = d.slice(0, 12).reduce((t, n, i) => t + n * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === d[12] ? c : null;
}

export function ean13Bits(ean) {
  const d = [...ean].map(Number);
  const parity = PARITY[d[0]];
  let bits = '101';
  for (let i = 0; i < 6; i += 1) bits += (parity[i] === 'L' ? L : G)[d[i + 1]];
  bits += '01010';
  for (let i = 7; i < 13; i += 1) bits += R[d[i]];
  return `${bits}101`;
}

export default function BarcodeLabel({ code }) {
  const ean = normalizeEan(code);
  if (!ean) {
    return <p className="text-sm text-muted">{code ? `Barcode ${code} (label preview supports valid EAN-13 / UPC-A codes).` : 'No barcode on this SKU yet. Add one with Edit.'}</p>;
  }
  const bits = ean13Bits(ean);
  const quiet = 9;
  const bars = [];
  for (let i = 0; i < bits.length; i += 1) {
    if (bits[i] !== '1') continue;
    let j = i;
    while (j < bits.length && bits[j] === '1') j += 1;
    bars.push(<rect key={i} x={quiet + i} y="4" width={j - i} height="46" fill="#000" />);
    i = j - 1;
  }
  const w = 95 + quiet * 2;
  return (
    <figure className="inline-block rounded-xl bg-white p-2 text-center">
      <svg role="img" aria-label={`EAN-13 barcode ${ean}`} viewBox={`0 0 ${w} 58`} shapeRendering="crispEdges" className="h-24 w-56">
        <rect width={w} height="58" fill="#fff" />
        {bars}
        <text x={w / 2} y="56" textAnchor="middle" fontSize="7" fill="#000">{ean}</text>
      </svg>
    </figure>
  );
}