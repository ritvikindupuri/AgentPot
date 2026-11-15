import React from 'react';

export function TableContainer({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border border-border rounded-lg overflow-hidden overflow-x-auto bg-surface ${className}`}
    >
      <table className="w-full text-left text-[13px] border-collapse">{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-bg-subtle border-b border-border text-xs text-text-faint font-medium">
      <tr className="h-9">{children}</tr>
    </thead>
  );
}

export function TableHeaderCell({
  children,
  align = 'left',
  className = '',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={`px-3 font-medium text-xs normal-case ${alignClass} ${className}`}>
      {children}
    </th>
  );
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function TableRow({
  children,
  onClick,
  selected = false,
  isNew = false,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  isNew?: boolean;
  className?: string;
}) {
  const isClickable = !!onClick;

  return (
    <tr
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`h-10 transition-colors duration-120 ${
        selected
          ? 'bg-accent-bg'
          : isNew
          ? 'animate-row-fade'
          : isClickable
          ? 'hover:bg-surface-hover cursor-pointer'
          : ''
      } ${className}`}
    >
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  align = 'left',
  mono = false,
  truncate = false,
  className = '',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
  truncate?: boolean;
  className?: string;
}) {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const monoClass = mono ? 'font-mono text-xs' : '';
  const truncClass = truncate ? 'truncate max-w-[200px]' : '';

  return (
    <td className={`px-3 text-[13px] ${alignClass} ${monoClass} ${truncClass} ${className}`}>
      {children}
    </td>
  );
}
