import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  ExternalLink,
  MessageSquareWarning,
  PackageOpen,
  Plus,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Star,
  Tag,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import type { AdminViewServerProps } from 'payload'

import type { User } from '@/payload-types'
import { hasRole } from '@/access/roles'
import { computeKpis, salesBreakdown, statusFunnel, timeSeries } from '@/lib/reports/compute'
import { loadExpenses, loadLookups, loadOrders } from '@/lib/reports/load'
import { parseReportRange, pktDay, rangeQuery } from '@/lib/reports/range'

import { StatusPill } from '../StatusCell'
import { InsightChart } from '../reports/InsightChart'
import { count, Delta, money, percent } from '../reports/ReportParts'

const PERIODS = { today: 'Today', '7d': '7 days', '30d': '30 days', '90d': '90 days', ytd: 'This year', last_year: 'Last year' } as const
const PIPELINE = ['new', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'] as const
const orderLink = (query: string) => `/admin/collections/orders${query ? `?${query}` : ''}`
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

/** The Pakistan-time hour and date, wherever the server runs. */
function greeting(now = new Date()) {
  const hour = Number(now.toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Karachi' }))
  return {
    hello: hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening',
    date: now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Karachi' }),
  }
}

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return days < 30 ? `${days} day${days === 1 ? '' : 's'} ago` : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2 || values.every((v) => v === 0)) return null
  const max = Math.max(...values, 1)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * 100).toFixed(1)},${(28 - (v / max) * 26).toFixed(1)}`).join(' ')
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="coco-spark" aria-hidden>
      <path d={`${d} L100,30 L0,30 Z`} className="coco-spark__area" />
      <path d={d} className="coco-spark__line" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function Metric({
  label,
  value,
  current,
  previous,
  href,
  lowerIsBetter,
  spark,
  note,
}: {
  label: string
  value: string
  current: number
  previous?: number
  href: string
  lowerIsBetter?: boolean
  spark?: number[]
  note?: string
}) {
  return (
    <Link href={href} className="coco-metric">
      <span className="coco-metric__label">
        {label} <ArrowUpRight size={13} aria-hidden />
      </span>
      <strong className="coco-metric__value">{value}</strong>
      {previous !== undefined && <Delta current={current} previous={previous} lowerIsBetter={lowerIsBetter} />}
      {note && <small className="coco-muted">{note}</small>}
      {spark && <Sparkline values={spark} />}
    </Link>
  )
}

function Task({ label, value, href, icon: Icon, hint }: { label: string; value: number; href: string; icon: LucideIcon; hint: string }) {
  return (
    <Link href={href} className={`coco-task${value ? ' is-waiting' : ''}`}>
      <span className="coco-task__icon">
        <Icon size={18} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="coco-task__text">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
      <small>
        {value ? (
          hint
        ) : (
          <>
            <CheckCircle2 size={12} aria-hidden /> All clear
          </>
        )}
      </small>
    </Link>
  )
}

/** /admin: what needs doing now, then how the business is going. Full analysis lives in Reports. */
export async function DashboardView({ initPageResult, searchParams }: AdminViewServerProps) {
  const { req } = initPageResult
  const payload = req.payload
  const user = req.user as User | null
  const canSeeCosts = hasRole(user, ['owner', 'manager'])

  const asked = typeof searchParams?.period === 'string' ? searchParams.period : '30d'
  const range = parseReportRange({
    range: asked === 'custom' || asked in PERIODS ? asked : '30d',
    compare: 'previous',
    from: searchParams?.from,
    to: searchParams?.to,
  })
  const period = range.preset
  const previous = range.previous!

  const [
    newOrders,
    toVerify,
    toShip,
    pendingReviews,
    openTickets,
    openCarts,
    orders,
    previousOrders,
    expenses,
    previousExpenses,
    lookups,
    recent,
    lowStock,
    totalCustomers,
    repeatCustomers,
    liveProducts,
  ] = await Promise.all([
    payload.count({ collection: 'orders', where: { status: { equals: 'new' } } }),
    payload.count({ collection: 'orders', where: { 'payment.status': { equals: 'awaiting_verification' } } }),
    payload.count({ collection: 'orders', where: { status: { in: ['confirmed', 'processing'] } } }),
    payload.count({ collection: 'reviews', where: { status: { equals: 'pending' } } }),
    payload.count({ collection: 'support-tickets', where: { status: { in: ['open', 'in_progress'] } } }),
    payload.count({
      collection: 'carts',
      where: { and: [{ status: { equals: 'open' } }, { lastActivityAt: { less_than: ago(3_600_000) } }, { lastActivityAt: { greater_than: ago(7 * 86_400_000) } }] },
    }),
    loadOrders(payload, range),
    loadOrders(payload, previous),
    canSeeCosts ? loadExpenses(payload, range) : [],
    canSeeCosts ? loadExpenses(payload, previous) : [],
    loadLookups(payload),
    payload.find({
      collection: 'orders',
      sort: '-createdAt',
      limit: 6,
      depth: 0,
      select: { orderNumber: true, status: true, total: true, createdAt: true, shippingAddress: { fullName: true, city: true } },
    }),
    payload.find({
      collection: 'products',
      where: { and: [{ status: { equals: 'published' } }, { stockStatus: { in: ['low_stock', 'out_of_stock'] } }] },
      sort: 'totalStock',
      limit: 5,
      depth: 0,
      select: { title: true, totalStock: true, stockStatus: true },
    }),
    payload.count({ collection: 'customers' }),
    payload.count({ collection: 'customers', where: { orderCount: { greater_than: 1 } } }),
    payload.count({ collection: 'products', where: { status: { equals: 'published' } } }),
  ])

  const k = computeKpis(orders, expenses, range)
  const p = computeKpis(previousOrders, previousExpenses, previous)
  const series = timeSeries(orders, range, range.granularity)
  const previousSeries = timeSeries(previousOrders, previous, range.granularity)
  const funnel = statusFunnel(orders)
  const pipelineMax = Math.max(...funnel.map((f) => f.count), 1)
  const breakdown = salesBreakdown(orders, lookups)
  const topProducts = breakdown.products.slice(0, 5)
  const topMax = Math.max(...topProducts.map((t) => t.netSales), 1)
  const topCategories = breakdown.categories.slice(0, 5)
  const categoryMax = Math.max(...topCategories.map((t) => t.netSales), 1)

  const { hello, date } = greeting()
  const firstName = user?.name?.split(' ')[0]
  const periodLabel = range.label
  const reports = (tab: string) => `/admin/reports?tab=${tab}&${rangeQuery(range)}`

  return (
    <div className="coco-dash">
      <header className="coco-dash__head">
        <div>
          <h1>
            {hello}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="coco-muted">{date}</p>
        </div>
        <div className="coco-dash__actions">
          <Link href="/admin/collections/products/create" className="coco-btn coco-btn--primary">
            <Plus size={15} aria-hidden /> Add product
          </Link>
          <Link href="/admin/collections/coupons/create" className="coco-btn">
            <Tag size={15} aria-hidden /> New coupon
          </Link>
          <Link href="/admin/reports" className="coco-btn">
            <BarChart3 size={15} aria-hidden /> Open reports
          </Link>
          <a href="/" target="_blank" rel="noopener noreferrer" className="coco-btn">
            <ExternalLink size={15} aria-hidden /> View store
          </a>
        </div>
      </header>

      {canSeeCosts && !user?.twoFactor?.enabled && (
        <Link href="/admin/security" className="coco-alert">
          <ShieldAlert size={18} aria-hidden />
          <span>
            <strong>Protect your account.</strong> Turn on two-factor authentication: this login can see customer data and profit.
          </span>
          <ArrowUpRight size={15} aria-hidden />
        </Link>
      )}

      <section aria-labelledby="dash-attention">
        <h2 id="dash-attention" className="coco-section">
          Needs attention
        </h2>
        <div className="coco-tasks">
          <Task label="New orders to confirm" value={newOrders.totalDocs} href={orderLink('where[status][equals]=new')} icon={ShoppingBag} hint="Call or message to confirm" />
          <Task label="Payments to verify" value={toVerify.totalDocs} href={orderLink('where[payment.status][equals]=awaiting_verification')} icon={CreditCard} hint="Check the merchant app" />
          <Task label="To pack & ship" value={toShip.totalDocs} href={orderLink('where[status][in]=confirmed,processing')} icon={ClipboardCheck} hint="Ready for the courier" />
          <Task label="Reviews to moderate" value={pendingReviews.totalDocs} href="/admin/collections/reviews?where[status][equals]=pending" icon={Star} hint="Waiting to go live" />
          <Task label="Support tickets open" value={openTickets.totalDocs} href="/admin/collections/support-tickets?where[status][in]=open,in_progress" icon={MessageSquareWarning} hint="Customers waiting" />
          <Task label="Abandoned carts (7 days)" value={openCarts.totalDocs} href="/admin/collections/carts?where[status][equals]=open" icon={ShoppingCart} hint="Could still be recovered" />
        </div>
      </section>

      <section aria-labelledby="dash-performance">
        <div className="coco-dash__bar">
          <h2 id="dash-performance" className="coco-section">
            {periodLabel}
          </h2>
          <nav className="coco-tabs" aria-label="Period">
            {Object.entries(PERIODS).map(([value, label]) => (
              <Link key={value} href={`/admin?period=${value}`} scroll={false} className={value === period ? 'is-active' : ''} aria-current={value === period ? 'true' : undefined}>
                {label}
              </Link>
            ))}
          </nav>
          <form action="/admin" className="coco-dash__custom" aria-label="Custom dates">
            <input type="hidden" name="period" value="custom" />
            <input type="date" name="from" aria-label="From" required defaultValue={pktDay(range.from)} />
            <span className="coco-muted">to</span>
            <input type="date" name="to" aria-label="To" required defaultValue={pktDay(new Date(range.to.getTime() - 1))} />
            <button type="submit" className="coco-btn">
              Apply
            </button>
          </form>
        </div>

        <div className="coco-metrics">
          <Metric label="Net sales" value={money(k.netSales)} current={k.netSales} previous={p.netSales} href={reports('sales')} spark={series.map((s) => s.netSales)} note={`${money(k.totalCollected)} collected with delivery`} />
          <Metric label="Orders" value={count(k.revenueOrders)} current={k.revenueOrders} previous={p.revenueOrders} href={reports('sales')} spark={series.map((s) => s.orders)} />
          <Metric label="Avg. order value" value={money(k.averageOrderValue)} current={k.averageOrderValue} previous={p.averageOrderValue} href={reports('customers')} note={`${percent(k.repeatRate)} repeat customers`} />
          {canSeeCosts ? (
            <Metric label="Estimated profit" value={money(k.estimatedProfit)} current={k.estimatedProfit} previous={p.estimatedProfit} href={reports('finance')} note={`${percent(k.grossMargin)} gross margin`} />
          ) : (
            <Metric label="Units sold" value={count(k.units)} current={k.units} previous={p.units} href={reports('sales')} />
          )}
        </div>
      </section>

      <section aria-labelledby="dash-store">
        <h2 id="dash-store" className="coco-section">
          All time
        </h2>
        <div className="coco-metrics">
          <Metric label="Total customers" value={count(totalCustomers.totalDocs)} current={totalCustomers.totalDocs} href="/admin/collections/customers" />
          <Metric
            label="Repeat customers"
            value={count(repeatCustomers.totalDocs)}
            current={repeatCustomers.totalDocs}
            href="/admin/collections/customers?where[orderCount][greater_than]=1"
            note="Two or more orders"
          />
          <Metric label="Live products" value={count(liveProducts.totalDocs)} current={liveProducts.totalDocs} href="/admin/collections/products?where[status][equals]=published" />
          <Metric
            label="Low or out of stock"
            value={count(lowStock.totalDocs)}
            current={lowStock.totalDocs}
            href="/admin/collections/products?where[stockStatus][in]=low_stock,out_of_stock"
          />
        </div>
      </section>

      <div className="coco-dash__grid">
        <section className="coco-panel">
          <header className="coco-panel__head">
            <h2>Sales trend</h2>
            <span className="coco-legend">
              <i className="is-current" /> This period <i className="is-previous" /> Previous
            </span>
          </header>
          <InsightChart
            label={`Net sales per ${range.granularity}, ${periodLabel.toLowerCase()}`}
            granularity={range.granularity}
            metrics={[
              { key: 'netSales', label: 'Net sales', kind: 'money' },
              { key: 'orders', label: 'Orders', kind: 'count' },
            ]}
            points={series.map((s, i) => ({
              key: s.key,
              values: { netSales: s.netSales, orders: s.orders },
              previous: { netSales: previousSeries[i]?.netSales ?? 0, orders: previousSeries[i]?.orders ?? 0 },
            }))}
          />
        </section>

        <section className="coco-panel">
          <header className="coco-panel__head">
            <h2>Order pipeline</h2>
            <small className="coco-muted">Placed in this period</small>
          </header>
          <ul className="coco-pipeline">
            {PIPELINE.map((status) => {
              const row = funnel.find((f) => f.status === status)
              return (
                <li key={status}>
                  <Link href={orderLink(`where[status][equals]=${status}`)}>
                    <span className="coco-pipeline__name">{status}</span>
                    <span className={`coco-pipeline__bar coco-tone-${status}`}>
                      <i style={{ width: `${((row?.count ?? 0) / pipelineMax) * 100}%` }} />
                    </span>
                    <strong>{row?.count ?? 0}</strong>
                  </Link>
                </li>
              )
            })}
          </ul>
          <p className="coco-muted coco-panel__foot">
            {percent(k.cancellationRate)} cancelled · {percent(k.deliverySuccessRate)} delivered of completed
          </p>
        </section>

        <section className="coco-panel">
          <header className="coco-panel__head">
            <h2>Recent orders</h2>
            <Link href={orderLink('')}>View all</Link>
          </header>
          {recent.docs.length === 0 ? (
            <p className="coco-muted">No orders yet. They will appear here as soon as one is placed.</p>
          ) : (
            <ul className="coco-orders">
              {recent.docs.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/collections/orders/${o.id}`}>
                    <span className="coco-orders__who">
                      <strong>{o.shippingAddress?.fullName}</strong>
                      <small className="coco-muted">
                        {o.orderNumber} · {o.shippingAddress?.city}
                      </small>
                    </span>
                    <StatusPill value={o.status} />
                    <span className="coco-orders__total">
                      <strong>{money(o.total ?? 0)}</strong>
                      <small className="coco-muted">{timeAgo(o.createdAt)}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="coco-dash__stack">
          <section className="coco-panel">
            <header className="coco-panel__head">
              <h2>Top sellers</h2>
              <Link href={reports('sales')}>All products</Link>
            </header>
            {topProducts.length === 0 ? (
              <p className="coco-muted">No sales in this period yet.</p>
            ) : (
              <ol className="coco-top">
                {topProducts.map((t) => (
                  <li key={t.key}>
                    <Link href={`/admin/collections/products/${t.key}`}>
                      <span className="coco-top__row">
                        <span>{t.label}</span>
                        <strong>{money(t.netSales)}</strong>
                      </span>
                      <span className="coco-top__bar">
                        <i style={{ width: `${(t.netSales / topMax) * 100}%` }} />
                      </span>
                      <small className="coco-muted">{t.units} sold</small>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="coco-panel">
            <header className="coco-panel__head">
              <h2>Top categories</h2>
              <Link href={reports('sales')}>All categories</Link>
            </header>
            {topCategories.length === 0 ? (
              <p className="coco-muted">No sales in this period yet.</p>
            ) : (
              <ol className="coco-top">
                {topCategories.map((t) => (
                  <li key={t.key}>
                    <Link href={reports('sales')}>
                      <span className="coco-top__row">
                        <span>{t.label}</span>
                        <strong>{money(t.netSales)}</strong>
                      </span>
                      <span className="coco-top__bar">
                        <i style={{ width: `${(t.netSales / categoryMax) * 100}%` }} />
                      </span>
                      <small className="coco-muted">{t.units} sold</small>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="coco-panel">
            <header className="coco-panel__head">
              <h2>
                <AlertTriangle size={15} aria-hidden /> Running low
              </h2>
              <Link href="/admin/collections/inventory-adjustments/create">Record a restock</Link>
            </header>
            {lowStock.docs.length === 0 ? (
              <p className="coco-muted coco-clear">
                <PackageOpen size={15} aria-hidden /> Everything is well stocked.
              </p>
            ) : (
              <ul className="coco-stock">
                {lowStock.docs.map((s) => (
                  <li key={s.id}>
                    <Link href={`/admin/collections/products/${s.id}`}>
                      <span>{s.title}</span>
                      <StatusPill value={s.stockStatus === 'out_of_stock' ? 'out_of_stock' : 'low_stock'} text={s.stockStatus === 'out_of_stock' ? 'Out of stock' : `${s.totalStock ?? 0} left`} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
