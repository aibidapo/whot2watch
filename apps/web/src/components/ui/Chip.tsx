import { HTMLAttributes } from 'react';

type ChipProps = HTMLAttributes<HTMLSpanElement>;

export function Chip({ className = '', ...props }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-chip-border bg-chip-bg px-2.5 py-0.5 text-xs font-medium text-chip-text ${className}`}
      {...props}
    />
  );
}
