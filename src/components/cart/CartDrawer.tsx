'use client'

import { ShoppingBag, Trash2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { ButtonLink } from '@/components/ui/Button'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { Sheet } from '@/components/ui/Sheet'
import { formatPKR } from '@/lib/format'
import { calculateTotals, type ShippingRule } from '@/lib/pricing'

export type CartLineView = {
  key: string
  slug: string
  title: string
  variantLabel?: string
  image: string
  unitPrice: number
  compareAtPrice?: number
  quantity: number
  maxQuantity?: number
}

/** Slide-out cart. Presentational: cart state is owned by the cart store (Phase 4). */
export function CartDrawer({
  open,
  onOpenChange,
  lines,
  shipping,
  onQuantityChange,
  onRemove,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lines: CartLineView[]
  shipping: ShippingRule
  onQuantityChange: (key: string, quantity: number) => void
  onRemove: (key: string) => void
}) {
  const totals = calculateTotals(lines, shipping)
  const threshold = shipping.freeShippingThreshold ?? 0
  const remaining = Math.max(0, threshold - totals.subtotal)
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0)

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Your cart (${itemCount})`}
      footer={
        lines.length > 0 && (
          <div className="space-y-3">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd>{formatPKR(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Delivery</dt>
                <dd>{totals.shipping === 0 ? 'Free' : formatPKR(totals.shipping)}</dd>
              </div>
              <div className="flex justify-between border-t border-blush-200 pt-2 text-base font-medium">
                <dt>Total</dt>
                <dd>{formatPKR(totals.total)}</dd>
              </div>
            </dl>
            <ButtonLink href="/checkout" block size="lg">
              Checkout
            </ButtonLink>
            <p className="text-center text-xs text-muted">Cash on Delivery available. Discount codes at checkout.</p>
          </div>
        )
      }
    >
      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
          <ShoppingBag size={40} strokeWidth={1} className="text-rose-400" />
          <p className="font-display text-2xl text-burgundy-700">Your cart is empty</p>
          <p className="text-sm text-muted">Find a scent that makes every journey better.</p>
          <ButtonLink href="/collections/car-scents" variant="outline" onClick={() => onOpenChange(false)}>
            Shop car scents
          </ButtonLink>
        </div>
      ) : (
        <>
          {threshold > 0 && (
            <div className="border-b border-blush-200 bg-nude-100 px-5 py-3">
              <p className="text-xs">
                {remaining > 0 ? (
                  <>
                    Add <strong>{formatPKR(remaining)}</strong> more for free delivery
                  </>
                ) : (
                  <strong>You&apos;ve unlocked free delivery</strong>
                )}
              </p>
              <div
                className="mt-2 h-1 bg-blush-200"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={threshold}
                aria-valuenow={Math.min(totals.subtotal, threshold)}
                aria-label="Progress to free delivery"
              >
                <div className="h-full bg-burgundy-700 transition-all" style={{ width: `${Math.min(100, (totals.subtotal / threshold) * 100)}%` }} />
              </div>
            </div>
          )}
          <ul className="divide-y divide-blush-200">
            {lines.map((line) => (
              <li key={line.key} className="flex gap-4 p-5">
                <Link href={`/products/${line.slug}`} className="relative aspect-[4/5] w-20 shrink-0 bg-nude-100" onClick={() => onOpenChange(false)}>
                  <Image src={line.image} alt="" fill sizes="80px" className="object-cover" />
                </Link>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex justify-between gap-2">
                    <p className="font-display text-lg leading-tight">{line.title}</p>
                    <button
                      type="button"
                      onClick={() => onRemove(line.key)}
                      aria-label={`Remove ${line.title}`}
                      className="-mt-2 -mr-2 flex size-10 shrink-0 items-center justify-center text-muted hover:text-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {line.variantLabel && <p className="text-xs text-muted">{line.variantLabel}</p>}
                  <div className="mt-auto flex items-end justify-between">
                    <QuantityStepper
                      size="sm"
                      value={line.quantity}
                      max={line.maxQuantity}
                      onChange={(q) => onQuantityChange(line.key, q)}
                    />
                    <p className="text-sm font-medium">{formatPKR(line.unitPrice * line.quantity)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  )
}
