import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

type Tone = 'sale' | 'new' | 'soldout' | 'neutral' | 'gold'

const tones: Record<Tone, string> = {
  sale: 'bg-burgundy-700 text-cream-50',
  new: 'bg-cream-50 text-burgundy-700 ring-1 ring-burgundy-700/30',
  soldout: 'bg-ink/80 text-cream-50',
  neutral: 'bg-nude-100 text-ink',
  gold: 'bg-gold-500 text-white',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
