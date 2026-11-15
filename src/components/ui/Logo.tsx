import React from 'react';

interface LogoProps {
  size?: number;
  markOnly?: boolean;
  className?: string;
}

export function Logo({ size = 24, markOnly = false, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        width={size}
        height={size}
        fill="none"
        className="shrink-0"
        aria-hidden="true"
      >
        <path
          d="M27.26 15.2V22.5L16 29L4.74 22.5V9.5L16 3L21.1 5.95"
          fill="none"
          stroke="#EDEEF0"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="16" r="5.2" fill="none" stroke="#EDEEF0" strokeWidth="2.2" />
        <circle cx="16" cy="16" r="1.9" fill="#5B6CFF" />
        <circle cx="26.2" cy="8.9" r="2.3" fill="#5B6CFF" />
      </svg>
      {!markOnly && (
        <span className="font-semibold text-[15px] text-text tracking-tight">
          AgentPot
        </span>
      )}
    </div>
  );
}
