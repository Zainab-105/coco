import { Car, Clock, Droplet, Leaf } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { HeroSlider } from '@/components/home/HeroSlider'
import { ProductGrid } from '@/components/product/ProductGrid'
import { RecentlyViewed } from '@/components/product/RecentlyViewed'
import { JsonLd } from '@/components/seo/JsonLd'
import { ButtonLink } from '@/components/ui/Button'
import { Container, SectionHeading } from '@/components/ui/Layout'
import { Rating } from '@/components/ui/Rating'
import { getApprovedReviews, getCategories, getFragrances, getHeroSlides, listByFlag, listGiftSets } from '@/lib/storefront/catalog'
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo/jsonLd'
import { DEFAULT_SETTINGS, getStorefrontSettings } from '@/lib/storefront/data'
import { toMediaItem } from '@/lib/storefront/mappers'

export const revalidate = 300
export const metadata = { alternates: { canonical: '/' } }

// Placeholder tiles until category images are uploaded in the admin.
const fallbackCategoryImages: Record<string, string> = {
  'car-scents': '/mock/diffuser-bottle.webp',
  'car-accessories': '/mock/business-card.webp',
  'home-scents': '/mock/butter-paper.webp',
  'gift-sets': '/mock/packaging-box.webp',
}

const promises = [
  { icon: Clock, title: 'Long lasting', text: 'Up to 45 days per bottle' },
  { icon: Leaf, title: 'Premium fragrance', text: 'Fine oils, balanced notes' },
  { icon: Droplet, title: 'Leak-proof design', text: 'Sealed glass, wooden cap' },
  { icon: Car, title: 'Fits all cars', text: 'Hangs on any mirror' },
]

export default async function HomePage() {
  const [settings, slides, categories, bestsellers, newArrivals, giftSets, fragrances, reviews] = await Promise.all([
    getStorefrontSettings(),
    getHeroSlides(),
    getCategories(),
    listByFlag('bestselling', 8),
    listByFlag('isNewArrival', 4),
    listGiftSets(2),
    getFragrances(),
    getApprovedReviews(undefined, 6),
  ])
  const topCategories = categories.filter((c) => !c.parent && c.showInMenu !== false)
  const heroSlides = slides.length
    ? slides
    : [{ id: 0, title: DEFAULT_SETTINGS.tagline, subtitle: 'Premium car and home fragrance', ctaLabel: 'Shop car scents', ctaUrl: '/collections/car-scents', desktop: '/mock/hero-packaging.webp', mobile: '/mock/packaging-box.webp' }]

  return (
    <>
      <JsonLd data={[organizationJsonLd(settings), websiteJsonLd(settings.storeName)]} />
      <HeroSlider slides={heroSlides} />

      <Container className="py-16">
        <SectionHeading eyebrow="Collections" title="Shop by category" align="center" />
        <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {topCategories.map((category) => {
            const image = toMediaItem(category.image, 'card')?.src ?? fallbackCategoryImages[category.slug ?? '']
            return (
              <li key={category.id}>
                <Link href={`/collections/${category.slug}`} className="group relative block aspect-[4/5] overflow-hidden bg-blush-200">
                  {image && (
                    <Image src={image} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-burgundy-900/80 to-transparent p-4 pt-16 font-display text-xl text-cream-50 sm:text-2xl">
                    {category.title}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </Container>

      {bestsellers.length > 0 && (
        <Container className="py-10">
          <SectionHeading
            eyebrow="Loved by our customers"
            title="Best sellers"
            action={<Link href="/collections?sort=bestselling" className="shrink-0 text-xs uppercase tracking-[0.18em] underline underline-offset-4">View all</Link>}
          />
          <ProductGrid products={bestsellers.slice(0, 4)} layout="row" />
        </Container>
      )}

      {fragrances.length > 0 && (
        <section className="mt-10 bg-burgundy-700 py-16 text-cream-50">
          <Container>
            <div className="mb-8 text-center">
              <p className="text-[11px] uppercase tracking-[0.35em] text-blush-200">Fragrance finder</p>
              <h2 className="mt-1 text-4xl">Find your signature scent</h2>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {fragrances.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/collections/hanging-car-diffusers?fragrance=${f.slug}`}
                    className="flex h-full flex-col items-center gap-3 border border-cream-50/15 p-5 text-center transition-colors hover:bg-burgundy-900"
                  >
                    <span aria-hidden className="size-10 rounded-full ring-2 ring-cream-50/30" style={{ background: f.swatch ?? undefined }} />
                    <span className="font-display text-xl">{f.name}</span>
                    {f.mood && <span className="text-[11px] uppercase tracking-[0.16em] text-nude-100/70">{f.mood}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {giftSets.length > 0 && (
        <Container className="py-20">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div className="relative aspect-[4/5] overflow-hidden bg-nude-100 sm:aspect-[5/4]">
              <Image src={giftSets[0].media[0]?.src ?? '/mock/packaging-box.webp'} alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-rose-600">Gift sets</p>
              <h2 className="mt-1 text-4xl text-burgundy-700 sm:text-5xl">A gift that lingers</h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
                Our signature scents in the COCO gift box, wrapped in branded paper with a handwritten note. Ready to give.
              </p>
              <ProductGrid products={giftSets} className="mt-8 !grid-cols-2 lg:!grid-cols-2" priorityCount={0} />
            </div>
          </div>
        </Container>
      )}

      <section className="border-y border-blush-200 bg-nude-100/60 py-12">
        <Container>
          <ul className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {promises.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex flex-col items-center gap-2 text-center">
                <Icon size={28} strokeWidth={1.25} className="text-burgundy-700" />
                <p className="font-display text-xl">{title}</p>
                <p className="text-xs text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {newArrivals.length > 0 && (
        <Container className="py-16">
          <SectionHeading eyebrow="Just in" title="New arrivals" />
          <ProductGrid products={newArrivals} layout="row" priorityCount={0} />
        </Container>
      )}

      {reviews.length > 0 && (
        <Container className="py-16">
          <SectionHeading eyebrow="Reviews" title="What our customers say" align="center" />
          <ul className="scrollbar-none -mx-4 flex snap-x gap-4 overflow-x-auto px-4 lg:mx-0 lg:grid lg:grid-cols-3 lg:px-0">
            {reviews.map((r) => (
              <li key={r.id} className="w-[80%] shrink-0 snap-start bg-white p-6 shadow-card sm:w-[45%] lg:w-auto">
                <Rating value={r.rating} />
                {r.title && <p className="mt-3 font-display text-xl">{r.title}</p>}
                {r.body && <p className="mt-2 line-clamp-4 text-sm leading-relaxed">{r.body}</p>}
                <p className="mt-4 text-xs text-muted">
                  {r.authorName}
                  {r.productSlug && (
                    <>
                      {' on '}
                      <Link href={`/products/${r.productSlug}`} className="underline underline-offset-2">
                        {r.productTitle}
                      </Link>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </Container>
      )}

      <Container className="py-10">
        <RecentlyViewed />
      </Container>

      <Container className="pt-6 text-center">
        <ButtonLink href="/collections" variant="outline" size="lg">
          Shop all products
        </ButtonLink>
      </Container>
    </>
  )
}
