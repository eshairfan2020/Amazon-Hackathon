'use client';
import { useEffect, useRef, useState } from 'react';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'];

/**
 * Camera scanner using the browser BarcodeDetector API (Chrome on Android/desktop, Edge).
 * Needs HTTPS or localhost. Unsupported browsers (e.g. iOS Safari) fall back to typed / USB-scanner entry on the page.
 */
export default function BarcodeScanner({ onDetect }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const lastRef = useRef({ code: '', at: 0 });
  const cb = useRef(onDetect);
  cb.current = onDetect;
  const [state, setState] = useState('idle'); // idle | starting | scanning | unsupported | error
  const [message, setMessage] = useState('');

  const release = () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => release, []);

  function stop() { release(); setState('idle'); }

  async function start() {
    if (typeof window === 'undefined' || !('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
      setState('unsupported');
      return;
    }
    setState('starting');
    setMessage('');
    try {
      const supported = (await window.BarcodeDetector.getSupportedFormats?.()) || FORMATS;
      const detector = new window.BarcodeDetector({ formats: FORMATS.filter((f) => supported.includes(f)) });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setState('scanning');
      timerRef.current = setInterval(async () => {
        try {
          const found = await detector.detect(video);
          const raw = found[0]?.rawValue;
          const now = Date.now();
          if (!raw || (raw === lastRef.current.code && now - lastRef.current.at < 2500)) return;
          lastRef.current = { code: raw, at: now };
          navigator.vibrate?.(80);
          cb.current(raw);
        } catch { /* a dropped frame is fine */ }
      }, 300);
    } catch (e) {
      release();
      setState('error');
      setMessage(e?.name === 'NotAllowedError' ? 'Camera permission was denied. Allow it in the browser address bar, or type the code below.' : 'Could not start the camera. Type the code below instead.');
    }
  }

  const live = state === 'scanning' || state === 'starting';
  return (
    <div>
      <video ref={videoRef} playsInline muted className={`aspect-video w-full rounded-xl bg-black object-cover ${live ? '' : 'hidden'}`} />
      {state === 'unsupported' && <p role="alert" className="mb-2 text-sm text-warning">Camera scanning is not supported in this browser (use Chrome or Edge, over HTTPS or localhost). You can still type a code or use a USB/Bluetooth scanner.</p>}
      {state === 'error' && <p role="alert" className="mb-2 text-sm text-danger">{message}</p>}
      <div className="mt-2 flex gap-2">
        {live ? <button type="button" className="btn" onClick={stop}>Stop camera</button> : <button type="button" className="btn-secondary" onClick={start}>Start camera</button>}
        {state === 'scanning' && <span className="self-center text-sm text-success" role="status">Scanning…</span>}
      </div>
    </div>
  );
}