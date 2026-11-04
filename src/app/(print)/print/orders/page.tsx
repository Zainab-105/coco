import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { hasRole } from '@/access/roles'
import type { Order } from '@/payload-types'
import config from '@/payload.config'
import { formatPKR } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/orderStatus'

import { PrintToolbar } from './PrintToolbar'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ ids?: string; doc?: string }> }

const date = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

/** /print/orders?ids=1,2,3&doc=invoice|packing  (admin users only) */
export default async function PrintOrdersPage({ searchParams }: Props) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!hasRole(user, ['owner', 'manager', 'staff'])) redirect('/admin/login')

  const { ids = '', doc = 'invoice' } = await searchParams
  const idList = ids.split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 100)
  const settings = await payload.findGlobal({ slug: 'store-settings', depth: 0 })
  const { docs } = idList.length
    ? await payload.find({ collection: 'orders', where: { id: { in: idList } }, depth: 0, limit: idList.length, user, overrideAccess: false })
    : { docs: [] as Order[] }
  const orders = idList.map((id) => docs.find((d) => d.id === id)).filter((o): o is Order => Boolean(o))
  const packing = doc === 'packing'

  return (
    <>
      <PrintToolbar count={orders.length} label={`${packing ? 'packing slip' : 'invoice'}${orders.length === 1 ? '' : 's'}`} />
      {orders.length === 0 && <p style={{ textAlign: 'center', padding: 48 }}>No orders selected.</p>}
      {orders.map((o) => (
        <section key={o.id} className="sheet">
          <div className="head">
            <div>
              <div className="brand">COCO</div>
              <div className="muted">Car Scents | Room Diffusers | Accessories</div>
              {settings.address && <div className="muted">{settings.address}</div>}
              <div className="muted">{[settings.supportPhone, settings.supportEmail].filter(Boolean).join('  |  ')}</div>
            </div>
            <div>
              <div className="doc-title">{packing ? 'Packing slip' : 'Invoice'}</div>
              <div className="num big">{o.orderNumber}</div>
              <div className="num muted">{date(o.createdAt)}</div>
            </div>
          </div>

          <div className="grid">
            <div>
              <div className="label">Deliver to</div>
              <div className="big">{o.shippingAddress.fullName}</div>
              <div style={{ whiteSpace: 'pre-line' }}>{o.shippingAddress.address}</div>
              <div className="big">{o.shippingAddress.city}</div>
              <div>{o.shippingAddress.phone.replace('+92', '0')}</div>
            </div>
            <div>
              {!packing && (
                <>
                  <div className="label">Payment</div>
                  <div>
                    {PAYMENT_METHOD_LABELS[o.payment.method]} ({o.payment.status.replace('_', ' ')})
                  </div>
                </>
              )}
              {o.fulfilment?.trackingNumber && (
                <>
                  <div className="label" style={{ marginTop: 10 }}>
                    Courier
                  </div>
                  <div>
                    {o.fulfilment.courier} {o.fulfilment.trackingNumber}
                  </div>
                </>
              )}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                {packing && <th style={{ width: 28 }} />}
                <th>Item</th>
                <th>SKU</th>
                <th className="num">Qty</th>
                {!packing && <th className="num">Price</th>}
                {!packing && <th className="num">Total</th>}
              </tr>
            </thead>
            <tbody>
              {(o.items ?? []).map((i) => (
                <tr key={i.id}>
                  {packing && (
                    <td>
                      <span className="check" />
                    </td>
                  )}
                  <td>
                    <strong>{i.title}</strong>
                    {i.variantLabel && <div className="muted">{i.variantLabel}</div>}
                  </td>
                  <td className="muted">{i.sku}</td>
                  <td className="num" style={packing ? { fontSize: 16, fontWeight: 700 } : undefined}>
                    {i.quantity}
                  </td>
                  {!packing && <td className="num">{formatPKR(i.unitPrice)}</td>}
                  {!packing && <td className="num">{formatPKR(i.lineTotal ?? 0)}</td>}
                </tr>
              ))}
            </tbody>
          </table>

          {!packing && (
            <table className="totals">
              <tbody>
                <tr>
                  <td>Subtotal</td>
                  <td className="num">{formatPKR(o.subtotal ?? 0)}</td>
                </tr>
                {Boolean(o.discount) && (
                  <tr>
                    <td>Discount</td>
                    <td className="num">-{formatPKR(o.discount!)}</td>
                  </tr>
                )}
                <tr>
                  <td>Delivery</td>
                  <td className="num">{o.shippingFee ? formatPKR(o.shippingFee) : 'Free'}</td>
                </tr>
                {o.gift?.wrap && Boolean(o.gift.wrapFee) && (
                  <tr>
                    <td>Gift wrap</td>
                    <td className="num">{formatPKR(o.gift.wrapFee!)}</td>
                  </tr>
                )}
                <tr className="grand">
                  <td>Total</td>
                  <td className="num">{formatPKR(o.total ?? 0)}</td>
                </tr>
              </tbody>
            </table>
          )}

          {o.payment.method === 'cod' && o.payment.status !== 'paid' && (
            <div className="cod">Cash on Delivery: collect {formatPKR(o.total ?? 0)}</div>
          )}

          {o.gift?.wrap && (
            <div className="box">
              <div className="label">Gift wrap{packing ? ' - do not include prices' : ''}</div>
              {o.gift.note ? <div style={{ fontStyle: 'italic' }}>&ldquo;{o.gift.note}&rdquo;</div> : <div>No note</div>}
            </div>
          )}

          {packing && (
            <div className="box">
              <div className="label">Packed by / checked</div>
              <div style={{ height: 24 }} />
            </div>
          )}

          <div className="foot">Thank you for shopping with COCO. Little Scents. Big Vibes.</div>
        </section>
      ))}
    </>
  )
}
