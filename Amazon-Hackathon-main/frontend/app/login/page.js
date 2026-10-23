 'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() },
          },
        });

        if (error) throw error;

        if (data.session) {
          router.replace('/overview');
        } else {
          setMessage(
            'Account created. Check your email to confirm your account, then sign in.'
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.replace('/overview');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#10091d] px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-3xl border border-purple-400/20 bg-[#1b102b] p-8 shadow-2xl shadow-purple-950/40">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/20 text-2xl text-pink-300">
            ✦
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Inventory Managment System <span className="text-pink-300"></span>
          </h1>
          <p className="mt-2 text-sm text-purple-200/70">
            Your context-aware workspace assistant
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-xl bg-black/20 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
              setMessage('');
            }}
            className={`rounded-lg px-3 py-2 text-sm ${
              mode === 'login'
                ? 'bg-purple-500 text-white'
                : 'text-purple-200/70'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError('');
              setMessage('');
            }}
            className={`rounded-lg px-3 py-2 text-sm ${
              mode === 'signup'
                ? 'bg-purple-500 text-white'
                : 'text-purple-200/70'
            }`}
          >
            Create account
          </button>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={busy}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-purple-300/20 bg-white px-4 py-3 font-medium text-gray-800 transition hover:bg-purple-50 disabled:opacity-60"
        >
          <span className="text-lg font-bold">G</span>
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-purple-200/40">
          <div className="h-px flex-1 bg-purple-300/15" />
          OR WITH EMAIL
          <div className="h-px flex-1 bg-purple-300/15" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm text-purple-100/80">
                Your name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
                className="w-full rounded-xl border border-purple-300/20 bg-black/20 px-4 py-3 outline-none transition placeholder:text-purple-200/30 focus:border-pink-300"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-purple-100/80">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-purple-300/20 bg-black/20 px-4 py-3 outline-none transition placeholder:text-purple-200/30 focus:border-pink-300"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm text-purple-100/80">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={6}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-xl border border-purple-300/20 bg-black/20 px-4 py-3 outline-none transition placeholder:text-purple-200/30 focus:border-pink-300"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </p>
          )}

          {message && (
            <p role="status" className="rounded-lg bg-green-500/10 p-3 text-sm text-green-300">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3 font-semibold transition hover:brightness-110 disabled:opacity-60"
          >
            {busy
              ? 'Please wait…'
              : mode === 'signup'
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-purple-200/40">
          By continuing, you agree to use ANCHOR AI responsibly.
        </p>
      </section>
    </main>
  );
}
