'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Runs `fn` on mount and whenever `fn` changes. Late responses from older calls are ignored. */
export function useAsync(fn) {
  const [s, setS] = useState({ loading: true, data: null, error: null });
  const latest = useRef(0);
  const run = useCallback(() => {
    const id = (latest.current += 1);
    setS((p) => ({ ...p, loading: true, error: null }));
    fn()
      .then((data) => id === latest.current && setS({ loading: false, data, error: null }))
      .catch((e) => id === latest.current && setS({ loading: false, data: null, error: e.message }));
  }, [fn]);
  useEffect(run, [run]);
  return { ...s, reload: run };
}
