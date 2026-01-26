import { InputHTMLAttributes, forwardRef } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-lg border px-3 py-2 text-sm border-input-border bg-input-bg text-input-text placeholder:text-input-placeholder focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors duration-200 ${className}`}
      {...props}
    />
  );
});
