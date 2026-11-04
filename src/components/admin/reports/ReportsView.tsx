import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import type { ReactNode } from 'react'

import { hasRole } from '@/access/roles'
import { PAYMENT_METHOD_LABELS } from '@/lib/orderStatus'
import { buildReport, financeRows, reportTables, type Report, type ReportTableKey } from '@/lib/reports/build'
import { loadMarketing, loadReportData, type MarketingStats } from '@/lib/reports/load'
import { describeRange, parseReportRange, pktDay, rangeQuery } from '@/lib/reports/range'

import { BarChart, BarList } from './Charts'
import { InsightChart } from './InsightChart'
import { RangeControls } from './RangeControls'
import { card, count, compactMoney, Kpi, KpiGrid, money, muted, Panel, percent, ReportTable } from './ReportParts'

const TABS = {
  overview: 'Overview',
  sales: 'Sales',
  customers: 'Customers',
  marketing: 'Marketing',
  finance: 'Finance',
  inventory: 'Inventory',
} as const
type Tab = keyof typeof TABS
const MANAGER_TABS: Tab[] = ['finance', 'inventory']

const STATUS_TONES: Record<string, string> = {
  new: '#6b1f2a',
  confirmed: '#2b5a92',
  processing: '#2b5a92',
  shipped: '#2b5a92',
  delivered: '#2f6b3a',
  cancelled: '#999999',
  returned: '#8a5a00',
  refunded: '#8a5a00',
}

const grid = (min = 360) => ({ display: 'grid', gap: 16, gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))` }) as const

/**
 * /admin/reports: sales, customers, marketing, finance and inventory reports for a date range,
 * compared with the previous period. Figures come from saved orders (see lib/reports/compute.ts
 * for definitions) and are reconciled against SQL in tests/int/reports.int.spec.ts.
 * Staff see sales and marketing; cost, profit, expenses and stock value need manager or owner.
 */
export async function ReportsView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req } = initPageResult
  if (!hasRole(req.user, ['owner', 'manager', 'staff'])) redirect('/admin')
  const canSeeCosts = hasRole(req.user, ['owner', 'manager'])

  const query = (searchParams ?? {}) as Record<string, string | string[] | undefined>
  const range = parseReportRange(query)
  let tab = (typeof query.tab === 'string' && query.tab in TABS ? query.tab : 'overview') as Tab
  if (!canSeeCosts && MANAGER_TABS.includes(tab)) tab = 'overview'

  const [data, marketing] = await Promise.all([
    loadReportData(req.payload, range),
    tab === 'marketing' ? loadMarketing(req.payload, range) : undefined,
  ])
  const report = buildReport(data)
  const tables = reportTables(report)
  const qs = rangeQuery(range)
  const exportHref = (table: ReportTableKey) => `/api/reports/export?table=${table}&${qs}`

  const tabs = (Object.keys(TABS) as Tab[]).filter((t) => canSeeCosts || !MANAGER_TABS.includes(t))

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={req.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <div style={{ display: 'grid', gap: 16, padding: '24px 0 48px' }}>
          <header style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h1 style={{ margin: 0 }}>Reports</h1>
              <p style={{ ...muted, fontSize: 13, margin: '4px 0 0' }}>
                {describeRange(range)}
                {range.previous ? ` · compared with ${describeRange(range.previous)}` : ''} · Pakistan time
              </p>
            </div>
            <RangeControls from={pktDay(range.from)} to={pktDay(new Date(range.to.getTime() - 1))} granularity={range.granularity} />
          </header>

          <nav aria-label="Report sections" style={{ display: 'flex', gap: 8, overflowX: 'auto', borderBottom: '1px solid var(--theme-elevation-150)' }}>
            {tabs.map((t) => (
              <Link
                key={t}
                href={`/admin/reports?tab=${t}&${qs}`}
                aria-current={t === tab ? 'page' : undefined}
                style={{
                  padding: '8px 12px',
                  textDecoration: 'none',
                  color: 'inherit',
                  fontSize: 14,
                  whiteSpace: 'nowrap',
                  borderBottom: t === tab ? '3px solid #6b1f2a' : '3px solid transparent',
                  fontWeight: t === tab ? 600 : 400,
                }}
              >
                {TABS[t]}
              </Link>
            ))}
          </nav>

          {tab === 'overview' && <Overview report={report} tables={tables} canSeeCosts={canSeeCosts} exportHref={exportHref} />}
          {tab === 'sales' && <Sales tables={tables} exportHref={exportHref} />}
          {tab === 'customers' && <Customers report={report} tables={tables} exportHref={exportHref} />}
          {tab === 'marketing' && marketing && <Marketing report={report} tables={tables} marketing={marketing} exportHref={exportHref} />}
          {tab === 'finance' && <Finance report={report} tables={tables} exportHref={exportHref} />}
          {tab === 'inventory' && <Inventory report={report} tables={tables} exportHref={exportHref} />}
        </div>
      </Gutter>
    </DefaultTemplate>
  )
}

type SectionProps = { report: Report; tables: ReturnType<typeof reportTables>; exportHref: (t: ReportTableKey) => string }

function Overview({ report, tables, canSeeCosts, exportHref }: SectionProps & { canSeeCosts: boolean }) {
  const { kpis: k, previousKpis: p } = report
  const series = report.series
  return (
    <>
      <KpiGrid>
        <Kpi label="Net sales" value={money(k.netSales)} current={k.netSales} previous={p?.netSales} hint="Item value of revenue orders, after discounts" />
        <Kpi label="Orders" value={count(k.revenueOrders)} current={k.revenueOrders} previous={p?.revenueOrders} hint="Excludes cancelled, returned and refunded" />
        <Kpi label="Avg. order value" value={money(k.averageOrderValue)} current={k.averageOrderValue} previous={p?.averageOrderValue} hint="Including delivery and gift wrap" />
        <Kpi label="Units sold" value={count(k.units)} current={k.units} previous={p?.units} />
        <Kpi label="Customers" value={count(k.customers)} current={k.customers} previous={p?.customers} />
        <Kpi label="Repeat customers" value={percent(k.repeatRate)} current={k.repeatRate} previous={p?.repeatRate} />
        {canSeeCosts && (
          <>
            <Kpi label="Estimated profit" value={money(k.estimatedProfit)} current={k.estimatedProfit} previous={p?.estimatedProfit} hint="Net sales + delivery + gift wrap - cost of goods - expenses" />
            <Kpi label="Gross margin" value={percent(k.grossMargin)} current={k.grossMargin} previous={p?.grossMargin} />
          </>
        )}
      </KpiGrid>

      <div style={grid(420)}>
        <Panel
          title="Net sales"
          description={report.previousSeries ? 'Dashed line: comparison period' : undefined}
          action={<a href={exportHref('daily')} style={{ fontSize: 12 }}>Download CSV</a>}
        >
          <InsightChart
            label="Net sales over time"
            granularity={report.range.granularity}
            metrics={[{ key: 'netSales', label: 'Net sales', kind: 'money' }]}
            points={series.map((s, i) => ({
              key: s.key,
              values: { netSales: s.netSales },
              previous: report.previousSeries ? { netSales: report.previousSeries[i]?.netSales ?? 0 } : undefined,
            }))}
          />
        </Panel>
        <Panel title="Orders">
          <BarChart label="Orders over time" points={series.map((s) => ({ key: s.key, value: s.orders }))} format={count} granularity={report.range.granularity} />
        </Panel>
      </div>

      <div style={grid()}>
        <Panel title="Orders by status" description="Orders placed in this period, by where they are now.">
          <BarList
            rows={report.funnel.map((f) => ({ label: f.status.charAt(0).toUpperCase() + f.status.slice(1), value: f.count, tone: STATUS_TONES[f.status] }))}
            format={count}
          />
          <p style={{ ...muted, margin: 0 }}>
            Cancelled {percent(k.cancellationRate)} · Returned {percent(k.returnRate)} of shipped · Delivered {percent(k.deliverySuccessRate)} of completed
          </p>
        </Panel>
        <Panel title="Cash on Delivery vs prepaid">
          <BarList
            rows={report.payments.split.map((r) => ({
              label: r.key === 'cod' ? PAYMENT_METHOD_LABELS.cod : 'Prepaid',
              value: r.netSales,
              extra: `${count(r.orders)} orders`,
            }))}
            format={compactMoney}
          />
        </Panel>
      </div>

      <div style={grid()}>
        <ReportTable table={tables.products} exportHref={exportHref('products')} limit={8} />
        <ReportTable table={tables.categories} exportHref={exportHref('categories')} />
      </div>
    </>
  )
}

function Sales({ tables, exportHref }: Omit<SectionProps, 'report'>) {
  return (
    <>
      <ReportTable table={tables.products} exportHref={exportHref('products')} limit={25} />
      <div style={grid()}>
        <ReportTable table={tables.categories} exportHref={exportHref('categories')} />
        <ReportTable table={tables.fragrances} exportHref={exportHref('fragrances')} />
      </div>
      <ReportTable table={tables.variants} exportHref={exportHref('variants')} limit={25} />
      <div style={grid()}>
        <ReportTable table={tables.slowSellers} exportHref={exportHref('slowSellers')} />
        <ReportTable table={tables.statuses} exportHref={exportHref('statuses')} />
      </div>
    </>
  )
}

function Customers({ report, tables, exportHref }: SectionProps) {
  const { kpis: k, previousKpis: p } = report
  return (
    <>
      <KpiGrid>
        <Kpi label="Customers who ordered" value={count(k.customers)} current={k.customers} previous={p?.customers} />
        <Kpi label="New customers" value={count(k.newCustomers)} current={k.newCustomers} previous={p?.newCustomers} />
        <Kpi label="Returning customers" value={count(k.returningCustomers)} current={k.returningCustomers} previous={p?.returningCustomers} />
        <Kpi label="Repeat rate" value={percent(k.repeatRate)} current={k.repeatRate} previous={p?.repeatRate} hint="Customers who had ordered before, or ordered twice in the period" />
        <Kpi label="Cancellation rate" value={percent(k.cancellationRate)} current={k.cancellationRate} previous={p?.cancellationRate} lowerIsBetter />
        <Kpi label="Return rate" value={percent(k.returnRate)} current={k.returnRate} previous={p?.returnRate} lowerIsBetter hint="Returned or refunded, of orders that were shipped" />
        <Kpi label="Delivery success" value={percent(k.deliverySuccessRate)} current={k.deliverySuccessRate} previous={p?.deliverySuccessRate} hint="Delivered, of orders that were delivered or returned" />
      </KpiGrid>
      <div style={grid()}>
        <ReportTable table={tables.payments} exportHref={exportHref('payments')} />
        <ReportTable table={tables.cities} exportHref={exportHref('cities')} />
      </div>
      <p style={muted}>
        Customer lists by segment (new, repeat, high value, inactive) are under{' '}
        <Link href="/admin/collections/customers">Customers</Link>, with CSV export.
      </p>
    </>
  )
}

function Marketing({ report, tables, marketing: m, exportHref }: SectionProps & { marketing: MarketingStats }) {
  const discountShare = report.kpis.grossSales ? report.kpis.discounts / report.kpis.grossSales : 0
  return (
    <>
      <KpiGrid>
        <Kpi label="Discounts given" value={money(report.kpis.discounts)} current={report.kpis.discounts} previous={report.previousKpis?.discounts} lowerIsBetter hint={`${percent(discountShare)} of gross sales`} />
        <Kpi label="Orders with a coupon" value={count(report.coupons.reduce((s, c) => s + c.orders, 0))} />
        <Kpi label="New subscribers" value={count(m.newSubscribers)} hint={`${count(m.activeSubscribers)} subscribed in total`} />
        <Kpi label="Unsubscribed" value={count(m.unsubscribed)} />
        <Kpi label="Checkouts captured" value={count(m.cartsCaptured)} hint="Visitors who entered a phone or email at checkout" />
        <Kpi label="Recovered" value={`${count(m.cartsRecovered)} (${percent(m.recoveryRate)})`} hint="Captured checkouts that became an order" />
        <Kpi label="Still abandoned" value={money(m.abandonedValue)} hint={`${count(m.cartsOpen)} carts not completed`} />
        <Kpi label="Recovered order value" value={money(m.recoveredValue)} />
      </KpiGrid>
      <ReportTable table={tables.coupons} exportHref={exportHref('coupons')} />
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13 }}>
        <Link href="/admin/collections/coupons">Manage coupons</Link>
        <Link href="/admin/collections/banners">Banners &amp; scheduling</Link>
        <Link href="/admin/collections/subscribers">Subscribers</Link>
        <Link href="/admin/collections/carts?where[status][equals]=open">Abandoned carts to follow up</Link>
      </div>
    </>
  )
}

function Finance({ report, tables, exportHref }: SectionProps) {
  const { kpis: k, previousKpis: p } = report
  const previous = p ? financeRows(p) : undefined
  return (
    <>
      {k.linesMissingCost > 0 && (
        <Note>
          {k.linesMissingCost} order lines in this period have no cost price, so cost of goods is understated and profit overstated. Add cost prices
          to products; new orders save them automatically.
        </Note>
      )}
      <KpiGrid>
        <Kpi label="Net sales" value={money(k.netSales)} current={k.netSales} previous={p?.netSales} />
        <Kpi label="Cost of goods" value={money(k.costOfGoods)} current={k.costOfGoods} previous={p?.costOfGoods} lowerIsBetter />
        <Kpi label="Gross profit" value={money(k.grossProfit)} current={k.grossProfit} previous={p?.grossProfit} />
        <Kpi label="Expenses" value={money(k.expenses)} current={k.expenses} previous={p?.expenses} lowerIsBetter />
        <Kpi label="Estimated profit" value={money(k.estimatedProfit)} current={k.estimatedProfit} previous={p?.estimatedProfit} />
      </KpiGrid>
      <div style={grid(420)}>
        <Panel title="Finance summary" description="Estimate for management use, not an accounting statement." action={<a href={exportHref('finance')} style={{ fontSize: 12 }}>Download CSV</a>}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {financeRows(k).map((row, i) => (
                <tr key={row.label} style={{ fontWeight: row.strong ? 600 : 400 }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--theme-elevation-100)' }}>
                    {row.label}
                    {row.note && <div style={{ ...muted, fontWeight: 400 }}>{row.note}</div>}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--theme-elevation-100)' }}>
                    {money(row.value)}
                  </td>
                  {previous && (
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--theme-elevation-100)', ...muted }}>
                      {money(previous[i].value)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {previous && <p style={{ ...muted, margin: 0 }}>Right column: comparison period.</p>}
        </Panel>
        <ReportTable table={tables.expenses} exportHref={exportHref('expenses')} />
      </div>
      <ReportTable table={tables.productProfit} exportHref={exportHref('productProfit')} limit={25} />
      <ReportTable table={tables.categoryProfit} exportHref={exportHref('categoryProfit')} />
      <p style={muted}>
        Record ads, packaging, courier bills and other running costs under <Link href="/admin/collections/expenses">Expenses</Link> so they
        are included in estimated profit.
      </p>
    </>
  )
}

function Inventory({ report, tables, exportHref }: SectionProps) {
  const inv = report.inventory
  return (
    <>
      {inv.missingCost > 0 && <Note>{inv.missingCost} products in stock have no cost price, so stock value is understated.</Note>}
      <KpiGrid>
        <Kpi label="Units in stock" value={count(inv.units)} />
        <Kpi label="Stock value (cost)" value={money(inv.stockValue)} />
        <Kpi label="Low stock" value={count(inv.lowStock)} hint="Products with any one option low, so this can be higher than the dashboard" />
        <Kpi label="Out of stock" value={count(inv.outOfStock)} hint="Products with any one option sold out" />
      </KpiGrid>
      <div style={grid()}>
        <ReportTable table={tables.restock} exportHref={exportHref('restock')} />
        <ReportTable table={tables.promote} exportHref={exportHref('promote')} />
      </div>
      <ReportTable table={tables.inventory} exportHref={exportHref('inventory')} />
      <ReportTable table={tables.slowSellers} exportHref={exportHref('slowSellers')} />
    </>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p style={{ ...card, borderLeft: '4px solid #8a5a00', margin: 0, fontSize: 13 }}>{children}</p>
}
