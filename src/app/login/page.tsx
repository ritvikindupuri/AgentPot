'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('from') || '/dashboard';
  const safeRedirect = redirectTarget.startsWith('/') ? redirectTarget : '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        const msg = signInError.message || '';
        if (/invalid login credentials/i.test(msg) || /invalid/i.test(msg)) {
          setError('Incorrect email or password.');
        } else if (/email not confirmed/i.test(msg)) {
          setError('Check your email to confirm your account.');
        } else {
          setError('Something went wrong. Try again.');
        }
        setLoading(false);
        return;
      }

      router.push(safeRedirect);
      router.refresh();
    } catch {
      setError('Something went wrong. Try again.');
      setLoading(false);
    }
  };

  return (
    <Card padding={24} className="w-full">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-xs text-text-muted font-normal leading-4">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoFocus
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            className="w-full h-8 px-3 bg-surface border border-border-strong rounded-md text-[13px] text-text focus:outline-none focus:border-accent transition-colors duration-120"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-xs text-text-muted font-normal leading-4">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            className="w-full h-8 px-3 bg-surface border border-border-strong rounded-md text-[13px] text-text focus:outline-none focus:border-accent transition-colors duration-120"
          />
          {error && (
            <p className="text-xs text-[#FF6369] mt-1 leading-4">{error}</p>
          )}
        </div>
        <Button
          type="submit"
          variant="primary"
          disabled={loading || !email || !password}
          className="w-full h-8 text-[13px]"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[360px] flex flex-col items-center">
        <div className="flex justify-center mb-3">
          <Logo size={32} markOnly />
        </div>

        <h1 className="text-[20px] font-semibold text-text leading-7 tracking-tight text-center">
          Sign in to AgentPot
        </h1>

        <div className="mt-6 w-full">
          <Suspense fallback={<div className="h-40 bg-surface rounded-lg border border-border" />}>
            <LoginForm />
          </Suspense>
        </div>

        <div className="mt-4 text-center text-xs text-text-faint">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-text-muted hover:text-text transition-colors duration-120">
            Sign up
          </Link>
          <div className="mt-2">
            <Link href="/" className="hover:text-text transition-colors duration-120">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
