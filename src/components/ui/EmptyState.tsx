import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  sentence?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  sentence,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className}`}
    >
      {icon && (
        <div className="text-text-faint mb-2 flex items-center justify-center">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-text leading-5">{title}</h3>
      {sentence && (
        <p className="text-[13px] text-text-muted mt-1 leading-5 max-w-sm">
          {sentence}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
