'use client'

import { Minus, Plus } from 'lucide-react'

import { cn } from '@/lib/cn'

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = 'md',
  className,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  size?: 'sm' | 'md'
  className?: string
}) {
  const btn = cn(
    'flex items-center justify-center text-ink transition-colors hover:bg-nude-100 disabled:opacity-30',
    size === 'sm' ? 'size-9' : 'size-11',
  )

  return (
    <div className={cn('inline-flex items-center border border-blush-200 bg-white', className)}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="Decrease quantity">
        <Minus size={14} />
      </button>
      <output aria-live="polite" className={cn('text-center text-sm tabular-nums', size === 'sm' ? 'w-7' : 'w-10')}>
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase quantity">
        <Plus size={14} />
      </button>
    </div>
  )
}
