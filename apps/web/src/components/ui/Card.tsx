import { HTMLAttributes, ReactNode } from 'react';

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
};

export function Card({ children, className = '', interactive = false, ...props }: CardProps) {
  return (
    <section
      className={`card p-4 ${interactive ? 'card-interactive cursor-pointer' : ''} ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}
