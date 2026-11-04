import { cn } from '@/lib/cn'
import { formatPKR } from '@/lib/format'
import { discountPercent, effectivePrice } from '@/lib/pricing'

type Props = {
  price: number
  salePrice?: number | null
  size?: 'sm' | 'md' | 'lg'
  showDiscount?: boolean
  className?: string
}

const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl' }

/** Shows the effective price, with the original struck through and the % saved when on sale. */
export function Price({ price, salePrice, size = 'md', showDiscount = true, className }: Props) {
  const current = effectivePrice(price, salePrice)
  const percent = discountPercent(price, salePrice)

  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2', sizes[size], className)}>
      <span className={cn('font-medium', percent > 0 ? 'text-burgundy-700' : 'text-ink')}>
        {percent > 0 && <span className="sr-only">Sale price </span>}
        {formatPKR(current)}
      </span>
      {percent > 0 && (
        <>
          <s className="text-[0.85em] text-muted">
            <span className="sr-only">Original price </span>
            {formatPKR(price)}
          </s>
          {showDiscount && <span className="text-[0.8em] font-medium text-burgundy-500">-{percent}%</span>}
        </>
      )}
    </p>
  )
}
