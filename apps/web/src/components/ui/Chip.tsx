import { HTMLAttributes } from 'react';

type ChipProps = HTMLAttributes<HTMLSpanElement>;

export function Chip({ className = '', ...props }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-slate-600/40 bg-slate-800/40 px-2 py-0.5 text-xs text-sky-300 ${className}`}
      {...props}
    />
  );
}
