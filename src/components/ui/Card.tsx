import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  padding?: number | string;
}

export function Card({
  title,
  action,
  children,
  className = '',
  padding = 16,
  ...props
}: CardProps) {
  const padClass = padding === 24 ? 'p-6' : padding === 0 ? 'p-0' : 'p-4';

  return (
    <div
      className={`bg-surface border border-border rounded-lg ${padClass} ${className}`}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between pb-3">
          {title && (
            <h2 className="text-sm font-semibold text-text leading-5">
              {title}
            </h2>
          )}
          {action && <div className="text-xs text-text-muted">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
