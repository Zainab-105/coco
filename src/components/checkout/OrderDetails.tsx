import type { Order } from '@/payload-types'
import { formatPKR } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/orderStatus'

const PAYMENT_STATUS: Record<string, string> = {
  pending: 'Pending',
  awaiting_verification: 'Awaiting verification',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
}

/** Items, totals, delivery and payment summary shared by the order page and track-order results. */
export function OrderDetails({ order }: { order: Order }) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <section aria-label="Items" className="border border-blush-200 bg-white p-5">
        <ul className="divide-y divide-blush-200 text-sm">
          {(order.items ?? []).map((i) => (
            <li key={i.id} className="flex justify-between gap-4 py-3">
              <span>
                <span className="font-display text-lg">{i.title}</span>
                {i.variantLabel && <span className="block text-xs text-muted">{i.variantLabel}</span>}
                <span className="block text-xs text-muted">Qty {i.quantity}</span>
              </span>
              <span>{formatPKR(i.lineTotal ?? 0)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-blush-200 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd>{formatPKR(order.subtotal ?? 0)}</dd>
          </div>
          {Boolean(order.discount) && (
            <div className="flex justify-between text-success">
              <dt>Discount</dt>
              <dd>-{formatPKR(order.discount!)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted">Delivery</dt>
            <dd>{order.shippingFee ? formatPKR(order.shippingFee) : 'Free'}</dd>
          </div>
          {order.gift?.wrap && Boolean(order.gift.wrapFee) && (
            <div className="flex justify-between">
              <dt className="text-muted">Gift wrap</dt>
              <dd>{formatPKR(order.gift.wrapFee!)}</dd>
            </div>
          )}
          <div className="flex justify-between pt-2 text-base font-medium">
            <dt>Total</dt>
            <dd>{formatPKR(order.total ?? 0)}</dd>
          </div>
        </dl>
      </section>

      <section aria-label="Delivery and payment" className="space-y-5 text-sm">
        <div>
          <h3 className="text-xs uppercase tracking-[0.2em] text-muted">Delivering to</h3>
          <p className="mt-2 whitespace-pre-line">
            {order.shippingAddress.fullName}
            {'\n'}
            {order.shippingAddress.address}
            {'\n'}
            {order.shippingAddress.city}
            {'\n'}
            {order.shippingAddress.phone.replace('+92', '0')}
          </p>
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-[0.2em] text-muted">Payment</h3>
          <p className="mt-2">
            {PAYMENT_METHOD_LABELS[order.payment.method]} &middot; {PAYMENT_STATUS[order.payment.status] ?? order.payment.status}
          </p>
        </div>
        {order.fulfilment?.trackingNumber && (
          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-muted">Courier</h3>
            <p className="mt-2">
              {order.fulfilment.courier} &middot; {order.fulfilment.trackingNumber}
            </p>
          </div>
        )}
        {order.gift?.note && (
          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-muted">Gift note</h3>
            <p className="mt-2 italic">&ldquo;{order.gift.note}&rdquo;</p>
          </div>
        )}
      </section>
    </div>
  )
}
