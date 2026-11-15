import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  children: React.ReactNode;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'default', className = '', children, ...props }, ref) => {
    let variantStyles = '';
    if (variant === 'primary') {
      variantStyles = 'bg-accent text-white hover:bg-accent-hover transition-colors duration-120';
    } else if (variant === 'secondary') {
      variantStyles =
        'bg-surface border border-border-strong text-text hover:bg-surface-hover transition-colors duration-120';
    } else if (variant === 'ghost') {
      variantStyles =
        'bg-transparent text-text-muted hover:bg-surface-hover hover:text-text transition-colors duration-120';
    }

    let sizeStyles = 'h-8 px-3 text-[13px] font-medium rounded-md';
    if (size === 'lg') {
      sizeStyles = 'h-10 px-4 text-sm font-medium rounded-md';
    } else if (size === 'sm') {
      sizeStyles = 'h-7 px-2.5 text-xs font-medium rounded-md';
    }

    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer select-none disabled:opacity-50 disabled:pointer-events-none ${variantStyles} ${sizeStyles} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
