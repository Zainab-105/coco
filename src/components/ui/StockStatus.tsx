import { cn } from '@/lib/cn'

export type StockLevel = 'in_stock' | 'low_stock' | 'out_of_stock'

export function stockLevel(stock: number, lowStockThreshold = 5): StockLevel {
  if (stock <= 0) return 'out_of_stock'
  if (stock <= lowStockThreshold) return 'low_stock'
  return 'in_stock'
}

const copy: Record<StockLevel, { label: string; dot: string }> = {
  in_stock: { label: 'In stock', dot: 'bg-success' },
  low_stock: { label: 'Only a few left', dot: 'bg-gold-500' },
  out_of_stock: { label: 'Sold out', dot: 'bg-danger' },
}

export function StockStatus({ level, className }: { level: StockLevel; className?: string }) {
  const { label, dot } = copy[level]
  return (
    <p className={cn('flex items-center gap-1.5 text-xs text-muted', className)}>
      <span aria-hidden className={cn('size-1.5 rounded-full', dot)} />
      {label}
    </p>
  )
}
