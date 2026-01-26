import { HTMLAttributes } from 'react';

type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  selected?: boolean;
};

export function Chip({ className = '', selected, ...props }: ChipProps) {
  const base =
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-200';
  const variant = selected
    ? 'border-brand-cyan bg-brand-cyan/20 text-brand-cyan'
    : 'border-chip-border bg-chip-bg text-chip-text';
  const interactive = props.onClick ? 'cursor-pointer hover:brightness-110' : '';
  return (
    <span
      className={`${base} ${variant} ${interactive} ${className}`}
      role={props.onClick ? 'button' : undefined}
      tabIndex={props.onClick ? 0 : undefined}
      {...props}
    />
  );
}
