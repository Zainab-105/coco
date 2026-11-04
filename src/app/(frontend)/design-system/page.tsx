import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { FormControlsDemo, ProductGridDemo } from '@/components/design-system/InteractiveDemo'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Container, SectionHeading, Skeleton } from '@/components/ui/Layout'
import { Price } from '@/components/ui/Price'
import { Rating } from '@/components/ui/Rating'
import { StockStatus } from '@/components/ui/StockStatus'

export const metadata: Metadata = {
  title: 'Design system',
  robots: { index: false, follow: false },
}

const colours = [
  { name: 'Burgundy 900', token: 'burgundy-900', hex: '#4A1620', use: 'Hover, deep accents' },
  { name: 'Burgundy 700', token: 'burgundy-700', hex: '#6B1F2A', use: 'Primary: buttons, links, headings' },
  { name: 'Burgundy 500', token: 'burgundy-500', hex: '#8E3A45', use: 'Discount text, secondary accents' },
  { name: 'Rose 400', token: 'rose-400', hex: '#C99485', use: 'Eyebrows, decorative waves' },
  { name: 'Blush 200', token: 'blush-200', hex: '#E9CFC2', use: 'Borders, secondary buttons' },
  { name: 'Nude 100', token: 'nude-100', hex: '#F3E3D8', use: 'Surfaces, image placeholders' },
  { name: 'Cream 50', token: 'cream-50', hex: '#FAF4EE', use: 'Page background' },
  { name: 'Gold 500', token: 'gold-500', hex: '#B8945A', use: 'Ratings, dividers, premium details' },
  { name: 'Ink', token: 'ink', hex: '#2B1A1C', use: 'Body text' },
]

function Block({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-blush-200 py-14">
      <SectionHeading eyebrow={eyebrow} title={title} />
      {children}
    </section>
  )
}

/** Living UI kit for Phase 1 sign-off. Not linked from the store and excluded from search engines. */
export default function DesignSystemPage() {
  return (
    <Container className="pb-10">
      <header className="py-14 text-center">
        <p className="text-[11px] uppercase tracking-[0.4em] text-rose-600">Phase 1 | For client review</p>
        <h1 className="mt-3 text-5xl text-burgundy-700 sm:text-6xl">COCO Design System</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-muted">
          Colours, type and components that every storefront page is built from. Everything below is interactive: swipe the
          product cards, use Quick View and add items to the cart.
        </p>
        <nav className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs uppercase tracking-[0.18em]">
          {['colours', 'type', 'buttons', 'labels', 'products', 'forms', 'states'].map((s) => (
            <a key={s} href={`#${s}`} className="py-2 text-burgundy-700 underline-offset-4 hover:underline">
              {s}
            </a>
          ))}
        </nav>
      </header>

      <Block id="colours" eyebrow="Foundations" title="Colour palette">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {colours.map((c) => (
            <li key={c.token} className="bg-white p-2 shadow-card">
              <div className="h-20 ring-1 ring-black/5" style={{ background: c.hex }} />
              <p className="mt-2 text-sm font-medium">{c.name}</p>
              <p className="text-xs text-muted">
                {c.hex} | {c.token}
              </p>
              <p className="mt-1 text-xs text-muted">{c.use}</p>
            </li>
          ))}
        </ul>
      </Block>

      <Block id="type" eyebrow="Foundations" title="Typography">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Display: Cormorant Garamond</p>
            <p className="font-display text-6xl text-burgundy-700">Scent Your World</p>
            <p className="font-display text-4xl">Hanging Car Diffuser</p>
            <p className="font-display text-2xl italic text-burgundy-500">Little Scents. Big Vibes.</p>
          </div>
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Body &amp; UI: Jost</p>
            <p className="text-[11px] uppercase tracking-[0.35em] text-rose-600">Eyebrow label</p>
            <p className="text-base">
              Body text at 16px for comfortable reading on phones. A long-lasting, leak-proof diffuser with premium fragrance oils
              that fits every car.
            </p>
            <p className="text-sm text-muted">Secondary text at 14px for supporting details and delivery information.</p>
            <p className="text-xs uppercase tracking-[0.18em]">Button &amp; navigation label</p>
          </div>
        </div>
      </Block>

      <Block id="buttons" eyebrow="Components" title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Add to cart</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="whatsapp">Order on WhatsApp</Button>
          <Button disabled>Sold out</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
        <p className="mt-4 text-xs text-muted">All sizes keep at least a 44px touch target.</p>
      </Block>

      <Block id="labels" eyebrow="Components" title="Prices, badges, ratings &amp; stock">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Price price={1450} />
            <Price price={1450} salePrice={1199} />
            <Price price={4200} salePrice={3490} size="lg" />
          </div>
          <div className="flex flex-wrap content-start gap-2">
            <Badge tone="sale">-17%</Badge>
            <Badge tone="new">New</Badge>
            <Badge tone="soldout">Sold out</Badge>
            <Badge tone="gold">Bestseller</Badge>
            <Badge>Gift ready</Badge>
          </div>
          <div className="space-y-2">
            <Rating value={4.7} count={128} />
            <Rating value={3.5} count={9} />
            <Rating value={5} size={18} />
          </div>
          <div className="space-y-2">
            <StockStatus level="in_stock" />
            <StockStatus level="low_stock" />
            <StockStatus level="out_of_stock" />
          </div>
        </div>
      </Block>

      <Block id="products" eyebrow="Key component" title="Product cards">
        <p className="mb-6 max-w-2xl text-sm text-muted">
          Two per row on mobile, up to four on desktop. Swipe a card (or use the arrows on desktop) to see more photos and videos
          without opening the product. &quot;Hanging Car Diffuser&quot; needs a fragrance, so quick add opens Quick View.
        </p>
        <ProductGridDemo />
      </Block>

      <Block id="forms" eyebrow="Components" title="Form controls">
        <FormControlsDemo />
      </Block>

      <Block id="states" eyebrow="Components" title="Loading state">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[4/5]" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      </Block>
    </Container>
  )
}
