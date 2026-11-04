import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6', className)}>{children}</div>
}

export function SectionHeading({
  eyebrow,
  title,
  action,
  align = 'left',
  className,
}: {
  eyebrow?: string
  title: string
  action?: ReactNode
  align?: 'left' | 'center'
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-6 flex items-end gap-4 sm:mb-8',
        align === 'center' ? 'flex-col items-center text-center' : 'justify-between',
        className,
      )}
    >
      <div>
        {eyebrow && <p className="text-[11px] uppercase tracking-[0.35em] text-rose-600">{eyebrow}</p>}
        <h2 className="mt-1 text-3xl text-burgundy-700 sm:text-4xl">{title}</h2>
        {align === 'center' && <span aria-hidden className="mx-auto mt-3 block h-px w-12 bg-gold-500" />}
      </div>
      {action}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse bg-nude-100', className)} />
}
