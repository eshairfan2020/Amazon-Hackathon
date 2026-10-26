import { X509Certificate, createVerify } from 'node:crypto';
import tls from 'node:tls';
import { AppError } from '../utils/errors.js';

/** Alexa request verification as required by Amazon: cert URL, cert chain, signature, timestamp, skill id. */
export function isValidCertUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && u.hostname.toLowerCase() === 's3.amazonaws.com' && u.pathname.startsWith('/echo.api/') && (u.port === '' || u.port === '443');
  } catch { return false; }
}

export function parseChain(pem) {
  const blocks = String(pem).match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
  return blocks.map((b) => new X509Certificate(b));
}

export function validateChain(certs, { now = Date.now(), roots = tls.rootCertificates } = {}) {
  if (!certs.length) throw new Error('empty certificate chain');
  for (const c of certs) if (now < Date.parse(c.validFrom) || now > Date.parse(c.validTo)) throw new Error('certificate not currently valid');
  if (!String(certs[0].subjectAltName ?? '').split(',').some((s) => s.trim() === 'DNS:echo-api.amazon.com')) throw new Error('certificate is not for echo-api.amazon.com');
  for (let i = 0; i < certs.length - 1; i += 1) {
    if (!certs[i].checkIssued(certs[i + 1]) || !certs[i].verify(certs[i + 1].publicKey)) throw new Error('broken certificate chain');
  }
  const last = certs[certs.length - 1];
  const trusted = roots.some((pem) => {
    try { const root = new X509Certificate(pem); return last.fingerprint256 === root.fingerprint256 || (last.checkIssued(root) && last.verify(root.publicKey)); } catch { return false; }
  });
  if (!trusted) throw new Error('certificate chain is not trusted');
}

export const verifySignature = (leaf, rawBody, signatureB64) => {
  try { return createVerify('RSA-SHA256').update(rawBody).verify(leaf.publicKey, Buffer.from(signatureB64, 'base64')); } catch { return false; }
};
export const timestampOk = (ts, now = Date.now(), toleranceSec = 150) => { const t = Date.parse(ts); return Number.isFinite(t) && Math.abs(now - t) <= toleranceSec * 1000; };

const bad = (msg) => new AppError(400, 'ALEXA_VERIFICATION_FAILED', msg);

/** Returns async ({headers, rawBody, body}) that throws a 400 unless the request genuinely came from Alexa for OUR skill. */
export function createAlexaVerifier({ skillId, fetchCert = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error('cert download failed'); return r.text(); }, roots, now = () => Date.now() }) {
  const cache = new Map();
  return async function verify({ headers, rawBody, body }) {
    const url = headers.signaturecertchainurl;
    const sig = headers['signature-256'];
    if (!url || !sig || typeof rawBody !== 'string') throw bad('Missing Alexa signature headers');
    if (!isValidCertUrl(url)) throw bad('Invalid certificate URL');
    let certs = cache.get(url);
    if (!certs) {
      try { certs = parseChain(await fetchCert(url)); } catch { throw bad('Could not load the Alexa certificate'); }
      cache.set(url, certs);
    }
    try { validateChain(certs, { now: now(), roots }); } catch (e) { cache.delete(url); throw bad(`Certificate rejected: ${e.message}`); }
    if (!verifySignature(certs[0], rawBody, sig)) throw bad('Signature does not match the request body');
    if (!timestampOk(body?.request?.timestamp, now())) throw bad('Request timestamp is too old');
    const appId = body?.session?.application?.applicationId ?? body?.context?.System?.application?.applicationId;
    if (!skillId || appId !== skillId) throw bad('Request is for a different skill');
  };
}