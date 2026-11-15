'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const origin = window.location.origin;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback?from=/dashboard`,
        },
      });

      if (signUpError) {
        setError(signUpError.message || 'Something went wrong. Try again.');
        setLoading(false);
        return;
      }

      if (data.session) {
        router.push('/dashboard');
        router.refresh();
        return;
      }

      setCheckEmail(true);
      setLoading(false);
    } catch {
      setError('Something went wrong. Try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[360px] flex flex-col items-center">
        <div className="flex justify-center mb-3">
          <Logo size={32} markOnly />
        </div>

        <h1 className="text-[20px] font-semibold text-text leading-7 tracking-tight text-center">
          {checkEmail ? 'Check your email' : 'Create your AgentPot account'}
        </h1>

        <div className="mt-6 w-full">
          {checkEmail ? (
            <Card padding={24} className="w-full">
              <p className="text-[13px] text-text-muted leading-5 text-center">
                We sent a confirmation link to{' '}
                <span className="text-text">{email}</span>. Open it to finish signing up.
              </p>
            </Card>
          ) : (
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
                    minLength={6}
                    autoComplete="new-password"
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
                  {loading ? 'Creating account…' : 'Sign up'}
                </Button>
              </form>
            </Card>
          )}
        </div>

        <div className="mt-4 text-center text-xs text-text-faint">
          {checkEmail ? (
            <Link href="/login" className="hover:text-text transition-colors duration-120">
              Back to sign in
            </Link>
          ) : (
            <>
              Already have an account?{' '}
              <Link href="/login" className="text-text-muted hover:text-text transition-colors duration-120">
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
