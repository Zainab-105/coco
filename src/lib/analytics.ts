/**
 * Google Analytics 4. Nothing loads until the visitor accepts (see components/analytics). Business
 * figures still come from our own database; this is for traffic and conversions only.
 * Never send customer details: order pages carry a private token and Track order a phone number
 * in their URLs, so URLs are scrubbed and every event's data is limited to product facts.
 */
export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const KEPT_PARAMS = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'])

/** Removes order numbers from paths and every query value except campaign tags. */
export function scrubUrl(url: string): string {
  const parsed = URL.parse(url)
  if (!parsed) return ''
  const path = parsed.pathname.replace(/^\/order\/[^/]+/, '/order').replace(/^\/checkout\/pay\/[^/]+/, '/checkout/pay')
  const kept = new URLSearchParams()
  parsed.searchParams.forEach((value, key) => KEPT_PARAMS.has(key) && kept.set(key, value))
  return `${parsed.origin}${path}${kept.size ? `?${kept}` : ''}`
}

export function startAnalytics() {
  if (!GA_ID || window.gtag) return
  window.dataLayer = window.dataLayer ?? []
  // gtag.js requires the real `arguments` object rather than an array.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', GA_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: scrubUrl(window.location.href),
    page_referrer: scrubUrl(document.referrer),
  })
}

export function trackPageView() {
  window.gtag?.('event', 'page_view', { page_location: scrubUrl(window.location.href), page_referrer: scrubUrl(document.referrer), page_title: document.title })
}

export type AnalyticsItem = {
  item_id: string
  item_name: string
  item_category?: string
  item_variant?: string
  price: number
  quantity: number
}

export type AnalyticsEvent = 'view_item' | 'add_to_cart' | 'begin_checkout' | 'purchase'

export function trackEvent(name: AnalyticsEvent, params: { currency?: 'PKR'; value: number; items: AnalyticsItem[]; transaction_id?: string; coupon?: string; shipping?: number }) {
  window.gtag?.('event', name, { currency: 'PKR', ...params })
}

const SENT_KEY = 'coco.analytics.purchases'

/** Reloading a thank-you page must not count the sale again. */
export function firstTimeSeen(transactionId: string) {
  try {
    const sent = JSON.parse(window.localStorage.getItem(SENT_KEY) ?? '[]') as string[]
    if (sent.includes(transactionId)) return false
    window.localStorage.setItem(SENT_KEY, JSON.stringify([transactionId, ...sent].slice(0, 20)))
  } catch {
    // Storage unavailable: send it anyway.
  }
  return true
}
