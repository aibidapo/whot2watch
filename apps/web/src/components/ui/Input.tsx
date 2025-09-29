import { InputHTMLAttributes, forwardRef } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-lg border px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 ${className} border-slate-600/40 bg-slate-800/40 text-slate-100`}
      {...props}
    />
  );
});
