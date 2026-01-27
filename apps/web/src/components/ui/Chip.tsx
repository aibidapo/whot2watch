import { HTMLAttributes, KeyboardEvent } from 'react';

type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  selected?: boolean;
};

export function Chip({ className = '', selected, onClick, ...props }: ChipProps) {
  const base =
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-200';
  const variant = selected
    ? 'border-brand-cyan bg-brand-cyan/20 text-brand-cyan'
    : 'border-chip-border bg-chip-bg text-chip-text';
  const interactive = onClick ? 'cursor-pointer hover:brightness-110' : '';

  const handleKeyDown = onClick
    ? (e: KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e as unknown as React.MouseEvent<HTMLSpanElement>);
        }
      }
    : undefined;

  return (
    <span
      className={`${base} ${variant} ${interactive} ${className}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}
