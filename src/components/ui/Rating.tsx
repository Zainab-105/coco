import { Star } from 'lucide-react'

import { cn } from '@/lib/cn'

export function Rating({
  value,
  count,
  size = 14,
  className,
}: {
  value: number
  count?: number
  size?: number
  className?: string
}) {
  const rounded = Math.round(value * 2) / 2

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="flex" role="img" aria-label={`Rated ${rounded} out of 5`}>
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = rounded >= i ? 1 : rounded >= i - 0.5 ? 0.5 : 0
          return (
            <span key={i} className="relative" style={{ width: size, height: size }}>
              <Star className="absolute inset-0 text-blush-200" fill="currentColor" strokeWidth={0} size={size} />
              {fill > 0 && (
                <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                  <Star className="text-gold-500" fill="currentColor" strokeWidth={0} size={size} />
                </span>
              )}
            </span>
          )
        })}
      </div>
      {count !== undefined && <span className="text-xs text-muted">({count})</span>}
    </div>
  )
}
