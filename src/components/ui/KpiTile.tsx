import React from 'react';

interface KpiTileProps {
  caption: string;
  value: number | string;
  delta?: string;
  className?: string;
}

export function KpiTile({ caption, value, delta, className = '' }: KpiTileProps) {
  return (
    <div className={`bg-surface border border-border rounded-lg p-4 flex flex-col justify-between ${className}`}>
      <span className="text-xs text-text-muted leading-4 font-normal">
        {caption}
      </span>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="text-[28px] font-semibold text-text leading-8 tracking-tight font-sans">
          {value}
        </span>
        {delta && (
          <span className="text-xs text-text-faint font-normal">
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
