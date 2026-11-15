import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Server,
  Flag,
  Activity,
  Bot,
  Layers,
  Eye,
  FileText,
  KeyRound,
  LayoutDashboard,
  Sprout,
  Radar,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

const ICON = { size: 20, strokeWidth: 1.5 } as const;

const STRIP: { icon: LucideIcon; label: string }[] = [
  { icon: Server, label: 'Decoy MCP' },
  { icon: FileText, label: 'Poisoned pages' },
  { icon: KeyRound, label: 'Canary keys' },
  { icon: LayoutDashboard, label: 'Live dashboard' },
];

const FEATURES: { icon: LucideIcon; title: string; line: string }[] = [
  { icon: Server, title: 'Decoy MCP server', line: 'Tools that never execute.' },
  { icon: Flag, title: 'Injection canaries', line: 'Unique IDs trace every hijack.' },
  { icon: Activity, title: 'Live classification', line: 'Typed, scored, and grouped.' },
];

const STEPS: { icon: LucideIcon; title: string; line: string }[] = [
  { icon: Sprout, title: 'Plant', line: 'Sit where agents look.' },
  { icon: Radar, title: 'Capture', line: 'Every touch is logged.' },
  { icon: BarChart3, title: 'Review', line: 'See sessions and severity.' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
      {/* Sticky Header 56px */}
      <header className="sticky top-0 z-40 h-14 bg-[rgba(10,11,14,0.8)] border-b border-border">
        <div className="max-w-[1120px] mx-auto px-6 h-full flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Logo size={24} />
          </Link>

          <nav className="flex items-center gap-3 text-[13px]">
            <Link
              href="/login"
              className="inline-flex items-center justify-center h-8 px-3 rounded-md bg-surface border border-border-strong hover:bg-surface-hover text-text font-medium text-[13px] transition-colors duration-120"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center h-8 px-3 rounded-md bg-accent hover:bg-accent-hover text-white font-medium text-[13px] transition-colors duration-120"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-[1120px] mx-auto px-6 pt-32 pb-24 text-center">
          <div className="max-w-[720px] mx-auto">
            <h1 className="text-[40px] sm:text-[56px] leading-[44px] sm:leading-[60px] font-semibold tracking-[-0.03em] text-text">
              See what AI agents do when no one is watching.
            </h1>
            <p className="mt-4 text-lg text-text-muted font-normal leading-7">
              Decoys lure them. Every move is recorded.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-accent hover:bg-accent-hover text-white font-medium text-sm transition-colors duration-120"
              >
                <span>Sign up</span>
                <ArrowRight size={14} strokeWidth={1.5} />
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center h-10 px-4 rounded-md bg-surface border border-border-strong hover:bg-surface-hover text-text font-medium text-sm transition-colors duration-120"
              >
                Sign in
              </Link>
            </div>
          </div>

          {/* Hero diagram */}
          <div className="mt-16 max-w-[960px] mx-auto">
            <div className="relative border border-border-strong rounded-lg p-6 sm:p-8 bg-surface/30">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-0 relative">
                <div className="w-full md:w-56 bg-surface border border-border rounded-lg p-4 text-center z-10">
                  <Bot size={ICON.size} strokeWidth={ICON.strokeWidth} className="text-accent mx-auto mb-2" />
                  <div className="text-[13px] font-medium text-text leading-5">Agent</div>
                  <div className="text-xs text-text-muted mt-0.5 leading-4">MCP client or crawler</div>
                </div>

                <div className="hidden md:flex flex-1 items-center justify-center relative mx-4">
                  <div className="w-full h-[1px] bg-border-strong" />
                  <div className="absolute w-2 h-2 rounded-full bg-accent" />
                </div>

                <div className="w-full md:w-56 bg-surface border border-border rounded-lg p-4 text-center z-10">
                  <Layers size={ICON.size} strokeWidth={ICON.strokeWidth} className="text-accent mx-auto mb-2" />
                  <div className="text-[13px] font-medium text-text leading-5">Decoys</div>
                  <div className="text-xs text-text-muted mt-0.5 leading-4">Tools, pages, keys</div>
                </div>

                <div className="hidden md:flex flex-1 items-center justify-center relative mx-4">
                  <div className="w-full h-[1px] bg-border-strong" />
                  <div className="absolute w-2 h-2 rounded-full bg-accent" />
                </div>

                <div className="w-full md:w-56 bg-surface border border-border rounded-lg p-4 text-center z-10">
                  <Eye size={ICON.size} strokeWidth={ICON.strokeWidth} className="text-accent mx-auto mb-2" />
                  <div className="text-[13px] font-medium text-text leading-5">AgentPot</div>
                  <div className="text-xs text-text-muted mt-0.5 leading-4">Classify and record</div>
                </div>
              </div>
            </div>
          </div>

          {/* Compact icon strip */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {STRIP.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="inline-flex items-center gap-2.5 text-[13px] text-text-muted"
              >
                <Icon size={ICON.size} strokeWidth={ICON.strokeWidth} className="text-accent" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="max-w-[1120px] mx-auto px-6 py-16 sm:py-24 border-t border-border">
          <h2 className="text-2xl sm:text-[32px] leading-8 sm:leading-10 font-semibold text-text text-center mb-12">
            Built to catch what logs miss.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, line }) => (
              <div key={title} className="bg-surface border border-border rounded-lg p-6 text-center">
                <Icon
                  size={ICON.size}
                  strokeWidth={ICON.strokeWidth}
                  className="text-accent mx-auto mb-4"
                />
                <h3 className="text-sm font-semibold text-text leading-5">{title}</h3>
                <p className="text-[13px] text-text-muted mt-1 leading-5">{line}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-[1120px] mx-auto px-6 py-16 sm:py-24 border-t border-border">
          <h2 className="text-2xl sm:text-[32px] leading-8 sm:leading-10 font-semibold text-text text-center mb-12">
            How it works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
            {STEPS.map(({ icon: Icon, title, line }, i) => (
              <div
                key={title}
                className={`py-6 md:py-0 text-center ${
                  i === 0 ? 'md:pr-8' : i === 1 ? 'md:px-8' : 'md:pl-8'
                }`}
              >
                <Icon
                  size={ICON.size}
                  strokeWidth={ICON.strokeWidth}
                  className="text-accent mx-auto mb-3"
                />
                <h3 className="text-sm font-semibold text-text leading-5">{title}</h3>
                <p className="text-[13px] text-text-muted mt-1 leading-5">{line}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 border-t border-border text-center">
          <div className="max-w-[720px] mx-auto px-6">
            <h2 className="text-2xl sm:text-3xl font-semibold text-text mb-6">Start watching.</h2>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-accent hover:bg-accent-hover text-white font-medium text-sm transition-colors duration-120"
            >
              Sign up
            </Link>
          </div>
        </section>
      </main>

      <footer className="h-16 border-t border-border text-[13px] text-text-faint">
        <div className="max-w-[1120px] mx-auto px-6 h-full flex items-center justify-between">
          <span>AgentPot</span>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-text transition-colors duration-120">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-text transition-colors duration-120">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
