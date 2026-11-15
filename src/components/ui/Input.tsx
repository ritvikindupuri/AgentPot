import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', icon, ...props }, ref) => {
    return (
      <div className="relative inline-flex items-center w-full">
        {icon && (
          <span className="absolute left-2.5 text-text-faint pointer-events-none flex items-center">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          className={`h-8 w-full bg-surface border border-border-strong rounded-md text-[13px] text-text placeholder:text-text-faint transition-colors duration-120 ${
            icon ? 'pl-8 pr-3' : 'px-3'
          } ${className}`}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';
