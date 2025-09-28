import { HTMLAttributes, ReactNode } from 'react'

type CardProps = HTMLAttributes<HTMLElement> & { children: ReactNode; className?: string }

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <section className={`card p-4 ${className}`} {...props}>
      {children}
    </section>
  )
}


