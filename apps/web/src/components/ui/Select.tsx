import { SelectHTMLAttributes } from 'react';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className = '', ...props }: SelectProps) {
  return (
    <select
      className={`w-full rounded-lg border px-3 py-2 text-sm border-input-border bg-input-bg text-input-text focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors duration-200 ${className}`}
      {...props}
    />
  );
}
