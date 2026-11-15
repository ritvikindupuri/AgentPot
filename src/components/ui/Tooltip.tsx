'use client';

import React, { useId, useRef, useState } from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Prefer 'start' when the trigger sits at the right edge of a tight row. */
  align?: 'center' | 'start' | 'end';
}

/**
 * Accessible, keyboard-focusable tooltip. Shows on hover and focus, hides on
 * blur, pointer leave, or Escape. Use around badges, labels, and chart bars.
 */
export function Tooltip({ content, children, className = '', align = 'center' }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      hide();
      (e.currentTarget as HTMLElement).blur();
    }
  };

  const alignClass =
    align === 'start' ? 'left-0' : align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2';

  return (
    <span
      ref={wrapRef}
      className={`relative inline-flex max-w-full ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={onKeyDown}
    >
      <span
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        className="inline-flex max-w-full rounded-md outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {children}
      </span>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`absolute z-50 bottom-full mb-1.5 ${alignClass} w-max max-w-[260px] px-2.5 py-1.5 rounded-lg bg-bg-subtle border border-border-strong text-[12px] leading-4 font-normal text-text shadow-[0_0_0_1px_#000,0_8px_24px_rgba(0,0,0,0.45)] pointer-events-none`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
