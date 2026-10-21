 'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function finishSignIn() {
      try {
        // Supabase's browser client handles the OAuth callback and session.
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (data.session) {
          router.replace('/overview');
          return;
        }

        // If the OAuth response contains a one-time code, exchange it for a session.
        const code = new URLSearchParams(window.location.search).get('code');

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) throw exchangeError;

          router.replace('/overview');
          return;
        }

        throw new Error(
          'No sign-in session was found. Please return to login and try again.'
        );
      } catch (err) {
        if (active) {
          setError(err.message || 'Unable to complete sign-in.');
        }
      }
    }

    finishSignIn();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#10091d] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-purple-400/20 bg-[#1b102b] p-8 text-center">
        <h1 className="text-xl font-semibold">Completing sign-in</h1>

        {!error ? (
          <p className="mt-3 text-sm text-purple-200/70">
            Please wait while ANCHOR AI verifies your session…
          </p>
        ) : (
          <>
            <p role="alert" className="mt-3 text-sm text-red-300">
              {error}
            </p>
            <button
              type="button"
              onClick={() => router.replace('/login')}
              className="mt-5 rounded-xl bg-purple-500 px-4 py-2 font-medium hover:bg-purple-400"
            >
              Return to login
            </button>
          </>
        )}
      </div>
    </main>
  );
}
