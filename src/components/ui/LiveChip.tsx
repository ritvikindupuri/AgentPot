import React from 'react';

interface LiveChipProps {
  isLive?: boolean;
  className?: string;
}

export function LiveChip({ isLive = true, className = '' }: LiveChipProps) {
  const dotColor = isLive ? '#3DD68C' : '#FF6369';
  const label = isLive ? 'Live' : 'Offline';

  return (
    <div
      className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-surface border border-border text-xs text-text select-none ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isLive ? 'animate-live-dot' : ''}`}
        style={{ backgroundColor: dotColor }}
        aria-hidden="true"
      />
      <span className="font-medium text-[12px]">{label}</span>
    </div>
  );
}
