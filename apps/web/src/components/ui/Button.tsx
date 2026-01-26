import { ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<string, string> = {
    primary:
      'bg-accent text-accent-foreground shadow-sm hover:shadow-md hover:brightness-110 active:scale-[0.98]',
    secondary:
      'border border-border bg-card text-foreground hover:bg-card-hover hover:border-ring',
    ghost: 'text-muted hover:bg-card-hover hover:text-foreground',
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
