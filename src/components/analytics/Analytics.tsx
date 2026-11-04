'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { useEffect } from 'react'

import { Button } from '@/components/ui/Button'
import { firstTimeSeen, GA_ID, startAnalytics, trackEvent, trackPageView, type AnalyticsEvent, type AnalyticsItem } from '@/lib/analytics'
import { createPersistentStore } from '@/lib/stores/persistent'

const consent = createPersistentStore<'granted' | 'denied' | null>('coco.consent.v1', null)

/** Loads Google Analytics only after the visitor accepts, and reports each page. */
export function Analytics() {
  const choice = consent.useStore()
  const pathname = usePathname()
  const granted = Boolean(GA_ID) && choice === 'granted'

  useEffect(() => {
    if (!granted) return
    startAnalytics()
    trackPageView()
  }, [granted, pathname])

  if (!GA_ID) return null

  return (
    <>
      {granted && <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />}
      {choice === null && (
        <div role="region" aria-label="Cookie choice" className="fixed inset-x-0 bottom-16 z-40 border-t border-blush-200 bg-cream-50 p-4 text-sm shadow-lg lg:bottom-0">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>
              We use analytics cookies to see how the site is used and improve it. Your name, number and address are never shared.{' '}
              <Link href="/pages/privacy" className="underline">
                Privacy policy
              </Link>
            </p>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={() => consent.set('denied')}>
                Decline
              </Button>
              <Button size="sm" onClick={() => consent.set('granted')}>
                Accept
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Footer link: asks again. A reload stops an analytics script that is already running. */
export function CookieSettingsLink() {
  if (!GA_ID) return null
  return (
    <button
      type="button"
      className="hover:underline"
      onClick={() => {
        const wasGranted = consent.get() === 'granted'
        consent.set(null)
        if (wasGranted) window.location.reload()
      }}
    >
      Cookie settings
    </button>
  )
}

/** Reports one event when a page shows. `once` also guards against repeats across reloads. */
export function TrackEvent({
  name,
  value,
  items,
  once,
  coupon,
  shipping,
}: {
  name: AnalyticsEvent
  value: number
  items: AnalyticsItem[]
  once?: string
  coupon?: string
  shipping?: number
}) {
  const choice = consent.useStore()
  const payload = JSON.stringify({ value, items, coupon, shipping })

  useEffect(() => {
    if (!GA_ID || choice !== 'granted') return
    startAnalytics()
    if (once && !firstTimeSeen(once)) return
    trackEvent(name, { ...JSON.parse(payload), ...(once ? { transaction_id: once } : {}) })
  }, [choice, name, once, payload])

  return null
}
