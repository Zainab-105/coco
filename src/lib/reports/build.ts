import { PAYMENT_METHOD_LABELS } from '@/lib/orderStatus'

import {
  computeKpis,
  couponPerformance,
  expensesByCategory,
  inventoryReport,
  paymentMix,
  PROMOTE_OVER_DAYS,
  RESTOCK_WITHIN_DAYS,
  salesBreakdown,
  slowSellers,
  statusFunnel,
  stockInsights,
  timeSeries,
  topCities,
  type Kpis,
  type ReportExpense,
  type ReportLookups,
  type ReportOrder,
} from './compute'
import { pktDay, type ReportRange } from './range'

export type ReportInput = {
  range: ReportRange
  orders: ReportOrder[]
  previousOrders?: ReportOrder[]
  expenses: ReportExpense[]
  previousExpenses?: ReportExpense[]
  lookups: ReportLookups
}

export function buildReport(input: ReportInput) {
  const { range, orders, lookups } = input
  const previous = range.previous
  const inventory = inventoryReport(orders, lookups.products, range)
  return {
    range,
    kpis: computeKpis(orders, input.expenses, range),
    previousKpis: previous && input.previousOrders ? computeKpis(input.previousOrders, input.previousExpenses ?? [], previous) : undefined,
    series: timeSeries(orders, range, range.granularity),
    previousSeries: previous && input.previousOrders ? timeSeries(input.previousOrders, previous, range.granularity) : undefined,
    funnel: statusFunnel(orders),
    sales: salesBreakdown(orders, lookups),
    slowSellers: slowSellers(orders, lookups.products, range),
    payments: paymentMix(orders),
    coupons: couponPerformance(orders, lookups.couponCodes),
    cities: topCities(orders),
    inventory,
    insights: stockInsights(inventory.rows),
    expenses: expensesByCategory(input.expenses),
  }
}

export type Report = ReturnType<typeof buildReport>

export type ColumnKind = 'text' | 'number' | 'money' | 'percent'
export type Column<T> = { header: string; kind: ColumnKind; value: (row: T) => string | number | null | undefined }
export type Table<T> = { title: string; description?: string; columns: Column<T>[]; rows: T[]; managerOnly?: boolean }

type ColFn<T> = (header: string, kind: ColumnKind, value: Column<T>['value']) => Column<T>

function table<T>(rows: T[], meta: Omit<Table<T>, 'rows' | 'columns'>, columns: (col: ColFn<T>) => Column<T>[]): Table<T> {
  return { ...meta, rows, columns: columns((header, kind, value) => ({ header, kind, value })) }
}

type SalesLike = Report['sales']['products'][number]
const salesColumns =
  (first: string, withCost: boolean) =>
  (col: ColFn<SalesLike>): Column<SalesLike>[] => [
    col(first, 'text', (r) => r.label),
    col('Orders', 'number', (r) => r.orders),
    col('Units', 'number', (r) => r.units),
    col('Net sales', 'money', (r) => r.netSales),
    col('Share', 'percent', (r) => r.share),
    ...(withCost
      ? [col('Cost of goods', 'money', (r) => r.costOfGoods), col('Gross profit', 'money', (r) => r.netSales - r.costOfGoods)]
      : []),
  ]

const EXPENSE_LABELS: Record<string, string> = {
  advertising: 'Advertising',
  packaging: 'Packaging',
  courier: 'Courier',
  salaries: 'Salaries',
  hosting: 'Hosting & software',
  other: 'Other',
}

/** Finance statement rows, in the order an accountant reads them. */
export function financeRows(k: Kpis) {
  return [
    { label: 'Gross sales', value: k.grossSales, note: 'Item value of all orders except cancelled' },
    { label: 'Discounts', value: -k.discounts, note: 'Coupons' },
    { label: 'Refunds & returns', value: -k.refunds, note: `${k.returnedOrders} returned or refunded orders` },
    { label: 'Net sales', value: k.netSales, note: 'Item value of revenue orders', strong: true },
    { label: 'Delivery charges', value: k.deliveryCharges, note: 'Charged to customers' },
    { label: 'Gift wrap', value: k.giftWrap, note: '' },
    { label: 'Total collected', value: k.totalCollected, note: 'What customers paid on revenue orders', strong: true },
    { label: 'Cost of goods', value: -k.costOfGoods, note: 'Cost price saved on each order line' },
    { label: 'Expenses', value: -k.expenses, note: 'Recorded under Reports > Expenses' },
    { label: 'Estimated profit', value: k.estimatedProfit, note: 'Estimate: excludes costs not recorded as expenses', strong: true },
  ]
}

/** Every table in the reports, used both on screen and for CSV downloads. */
export function reportTables(report: Report) {
  const { sales, payments, inventory } = report
  return {
    daily: table(report.series, { title: 'Sales over time' }, (col) => [
      col('Period starting', 'text', (r) => r.key),
      col('Orders', 'number', (r) => r.orders),
      col('Net sales', 'money', (r) => r.netSales),
    ]),
    statuses: table(report.funnel, { title: 'Orders by status', description: 'All orders placed in the period, by their current status.' }, (col) => [
      col('Status', 'text', (r) => r.status),
      col('Orders', 'number', (r) => r.count),
      col('Order value', 'money', (r) => r.value),
    ]),
    products: table(sales.products, { title: 'Sales by product' }, salesColumns('Product', false)),
    productProfit: table(sales.products, { title: 'Profit by product', managerOnly: true }, salesColumns('Product', true)),
    variants: table(sales.variants, { title: 'Sales by product & variant' }, salesColumns('Product / variant', false)),
    categories: table(sales.categories, { title: 'Sales by category' }, salesColumns('Category', false)),
    categoryProfit: table(sales.categories, { title: 'Profit by category', managerOnly: true }, salesColumns('Category', true)),
    fragrances: table(
      sales.fragrances,
      { title: 'Sales by fragrance', description: 'Single-scent products and fragrance variants. Mixed gift sets are not counted here.' },
      salesColumns('Fragrance', false),
    ),
    slowSellers: table(
      report.slowSellers,
      { title: 'Slow sellers', description: 'Live products with the fewest sales in the period (products added during the period are left out).' },
      (col) => [col('Product', 'text', (r) => r.title), col('Units sold', 'number', (r) => r.units), col('In stock', 'number', (r) => r.stock)],
    ),
    payments: table(
      [...payments.split, ...payments.methods],
      { title: 'Payment methods', description: 'Revenue orders by method. Cancelled shows how many orders with that method were cancelled.' },
      (col) => [
        col('Method', 'text', (r) => (r.key === 'prepaid' ? 'Prepaid (all)' : PAYMENT_METHOD_LABELS[r.key])),
        col('Orders', 'number', (r) => r.orders),
        col('Net sales', 'money', (r) => r.netSales),
        col('Share of orders', 'percent', (r) => r.share),
        col('Cancelled', 'number', (r) => r.cancelled),
      ],
    ),
    cities: table(report.cities, { title: 'Top cities' }, (col) => [
      col('City', 'text', (r) => r.city),
      col('Orders', 'number', (r) => r.orders),
      col('Net sales', 'money', (r) => r.netSales),
    ]),
    coupons: table(report.coupons, { title: 'Coupon performance' }, (col) => [
      col('Code', 'text', (r) => r.code),
      col('Orders', 'number', (r) => r.orders),
      col('Discount given', 'money', (r) => r.discount),
      col('Net sales', 'money', (r) => r.netSales),
      col('Avg. order value', 'money', (r) => r.averageOrderValue),
    ]),
    inventory: table(
      inventory.rows,
      {
        title: 'Inventory',
        description: 'Current stock valued at cost. Days of cover = stock / average daily units sold in the period.',
        managerOnly: true,
      },
      (col) => [
        col('Product', 'text', (r) => r.title),
        col('Status', 'text', (r) => r.status),
        col('In stock', 'number', (r) => r.stock),
        col('Sold in period', 'number', (r) => r.unitsSold),
        col('Days of cover', 'number', (r) => r.daysOfCover),
        col('Stock value (cost)', 'money', (r) => r.stockValue),
      ],
    ),
    restock: table(
      report.insights.restock,
      {
        title: 'Consider restocking',
        description: `Selling, and low or out of stock, or with ${RESTOCK_WITHIN_DAYS} days of stock or less at this period's sales. A suggestion: most useful over 30 days or more.`,
        managerOnly: true,
      },
      (col) => [
        col('Product', 'text', (r) => r.title),
        col('In stock', 'number', (r) => r.stock),
        col('Sold in period', 'number', (r) => r.unitsSold),
        col('Days of cover', 'number', (r) => r.daysOfCover),
      ],
    ),
    promote: table(
      report.insights.promote,
      {
        title: 'Consider promoting',
        description: `Live products that sold nothing, or have over ${PROMOTE_OVER_DAYS} days of stock at this period's sales. A suggestion: most useful over 30 days or more.`,
        managerOnly: true,
      },
      (col) => [
        col('Product', 'text', (r) => r.title),
        col('In stock', 'number', (r) => r.stock),
        col('Sold in period', 'number', (r) => r.unitsSold),
        col('Days of cover', 'number', (r) => r.daysOfCover),
      ],
    ),
    finance: table(financeRows(report.kpis), { title: 'Finance summary', description: 'All figures in PKR. Profit is an estimate.', managerOnly: true }, (col) => [
      col('Line', 'text', (r) => r.label),
      col('Amount', 'money', (r) => r.value),
      col('Notes', 'text', (r) => r.note),
    ]),
    expenses: table(report.expenses, { title: 'Expenses by category', managerOnly: true }, (col) => [
      col('Category', 'text', (r) => EXPENSE_LABELS[r.category] ?? r.category),
      col('Amount', 'money', (r) => r.amount),
    ]),
  }
}

export type ReportTables = ReturnType<typeof reportTables>
export type ReportTableKey = keyof ReportTables

/** CSV cell value for a column: money and counts as plain numbers, percentages to 1 dp. */
export function csvValue(kind: ColumnKind, value: unknown) {
  if (value == null) return ''
  if (kind === 'percent' && typeof value === 'number') return Math.round(value * 1000) / 10
  return value
}

export const reportFileName = (key: string, report: Pick<Report, 'range'>) =>
  `coco-report-${key}-${pktDay(report.range.from)}-to-${pktDay(new Date(report.range.to.getTime() - 1))}.csv`
