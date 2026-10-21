'use client';
import { useCallback, useState } from 'react';

export function useToast() {
  const [t, setT] = useState(null);
  const show = useCallback((message, tone = 'border-success') => {
    setT({ message, tone });
    setTimeout(() => setT(null), 4000);
  }, []);
  const node = t && <div role="status" className={`fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl border bg-sidebar px-4 py-2 text-sm ${t.tone}`}>{t.message}</div>;
  return [node, show];
}
