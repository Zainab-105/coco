import { Check } from 'lucide-react'

import { cn } from '@/lib/cn'

const STEPS = [
  { key: 'new', label: 'Order placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'processing', label: 'Packing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
] as const

const OFF_TRACK: Record<string, string> = {
  cancelled: 'This order was cancelled.',
  returned: 'This order was returned.',
  refunded: 'This order was refunded.',
}

export function OrderTimeline({ status }: { status: string }) {
  if (OFF_TRACK[status]) return <p className="border-l-4 border-muted bg-nude-100 px-4 py-3 text-sm">{OFF_TRACK[status]}</p>
  const current = STEPS.findIndex((s) => s.key === status)

  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Order progress">
      {STEPS.map((step, i) => {
        const done = i <= current
        return (
          <li key={step.key} className="flex flex-col items-center gap-2 text-center" aria-current={i === current ? 'step' : undefined}>
            <span className="relative flex w-full items-center justify-center">
              {i > 0 && <span className={cn('absolute right-1/2 h-0.5 w-full', i <= current ? 'bg-burgundy-700' : 'bg-blush-200')} aria-hidden />}
              <span
                className={cn(
                  'relative flex size-7 items-center justify-center rounded-full border-2 text-xs',
                  done ? 'border-burgundy-700 bg-burgundy-700 text-cream-50' : 'border-blush-200 bg-cream-50 text-muted',
                )}
              >
                {done ? <Check size={14} /> : i + 1}
              </span>
            </span>
            <span className={cn('text-[11px] leading-tight sm:text-xs', done ? 'text-ink' : 'text-muted')}>{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
