import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Jost } from 'next/font/google'
import React from 'react'

import { Analytics } from '@/components/analytics/Analytics'
import { MobileTabBar } from '@/components/storefront/MobileTabBar'
import { SiteFooter } from '@/components/storefront/SiteFooter'
import { SiteHeader } from '@/components/storefront/SiteHeader'
import { AccountSync } from '@/components/account/AccountSync'
import { StorefrontProvider } from '@/components/storefront/StorefrontProvider'
import { WhatsAppButton } from '@/components/storefront/WhatsAppButton'
import { socialCard } from '@/lib/seo/meta'
import { getStorefrontSettings } from '@/lib/storefront/data'
import './styles.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  // 78 KB that would compete with the main product image on mobile. Headings show in a size-matched
  // fallback for a moment, then swap.
  preload: false,
})
const jost = Jost({ subsets: ['latin'], variable: '--font-jost' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'),
  title: { default: 'COCO | Car Scents, Room Diffusers & Accessories', template: '%s | COCO' },
  description: 'Premium hanging car diffusers, room diffusers, car accessories and gift sets.',
  ...socialCard({
    title: 'COCO | Car Scents, Room Diffusers & Accessories',
    description: 'Premium hanging car diffusers, room diffusers, car accessories and gift sets.',
    url: '/',
  }),
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
}

export const viewport: Viewport = {
  themeColor: '#6b1f2a',
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getStorefrontSettings()

  return (
    <html lang="en" className={`${cormorant.variable} ${jost.variable}`}>
      <body className="min-h-dvh pb-tabbar lg:pb-0">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-cream-50 focus:p-3">
          Skip to content
        </a>
        <StorefrontProvider shipping={settings.shipping}>
          <AccountSync />
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
          <WhatsAppButton number={settings.whatsappNumber} />
          <MobileTabBar />
          <Analytics />
        </StorefrontProvider>
      </body>
    </html>
  )
}
