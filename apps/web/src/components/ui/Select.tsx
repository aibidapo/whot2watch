import { SelectHTMLAttributes } from 'react';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className = '', ...props }: SelectProps) {
  return (
    <select
      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 ${className} border-slate-600/40 bg-slate-800/40 text-slate-100`}
      {...props}
    />
  );
}
