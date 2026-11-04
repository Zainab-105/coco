import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'

import { TrackEvent } from '@/components/analytics/Analytics'
import { ProductGallery } from '@/components/product/ProductGallery'
import { ProductGrid } from '@/components/product/ProductGrid'
import { ProductPurchase } from '@/components/product/ProductPurchase'
import { RecentlyViewed } from '@/components/product/RecentlyViewed'
import { Reviews } from '@/components/product/Reviews'
import { JsonLd } from '@/components/seo/JsonLd'
import { Badge } from '@/components/ui/Badge'
import { Container, SectionHeading } from '@/components/ui/Layout'
import { Rating } from '@/components/ui/Rating'
import { RichText } from '@/components/ui/RichText'
import type { Category, Fragrance, Media } from '@/payload-types'
import config from '@/payload.config'
import { effectivePrice } from '@/lib/pricing'
import { breadcrumbJsonLd, productJsonLd } from '@/lib/seo/jsonLd'
import { socialCard } from '@/lib/seo/meta'
import { redirectOrNotFound } from '@/lib/seo/redirectLookup'
import { getApprovedReviews, getProductBySlug, getRatingDistribution, getRelatedProducts } from '@/lib/storefront/catalog'
import { getPolicies, getStorefrontSettings } from '@/lib/storefront/data'
import { galleryOf, isDoc, toMediaItem, toProductCard } from '@/lib/storefront/mappers'

export const revalidate = 300
export const dynamicParams = true

type Props = { params: Promise<{ slug: string }> }

/** Pre-render published products at build time; new products render on first visit. */
export async function generateStaticParams() {
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'products',
      where: { status: { equals: 'published' } },
      select: { slug: true },
      limit: 500,
      depth: 0,
    })
    return docs.filter((d) => d.slug).map((d) => ({ slug: d.slug! }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug)
  if (!product) return {}
  const firstImage = product.gallery?.map((g) => g.media).find((m) => isDoc<Media>(m) && m.mimeType?.startsWith('image/'))
  const image = toMediaItem(product.meta?.image ?? firstImage, 'og')?.src
  const title = product.meta?.title ?? product.title
  const description = product.meta?.description ?? product.shortDescription ?? undefined
  return {
    title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    ...socialCard({ title, description, url: `/products/${product.slug}`, image }),
  }
}

function Accordion({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-b border-blush-200 py-1">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-xs uppercase tracking-[0.2em] [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden className="text-lg transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  )
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug)
  if (!product) return redirectOrNotFound(`/products/${(await params).slug}`)

  const [settings, policies, reviews, distribution, related] = await Promise.all([
    getStorefrontSettings(),
    getPolicies(),
    getApprovedReviews(product.id),
    getRatingDistribution(product.id),
    getRelatedProducts(product),
  ])
  const card = toProductCard(product)
  const media = galleryOf(product, 'large')
  const category = isDoc<Category>(product.category) ? product.category : null
  const parent = category && isDoc<Category>(category.parent) ? category.parent : null
  const fragrances = (product.fragrances ?? []).filter(isDoc<Fragrance>)
  const variantFragrances = (product.variants ?? []).map((v) => v.fragrance).filter(isDoc<Fragrance>)
  const notes = fragrances.length ? fragrances : variantFragrances
  const prices = product.productType === 'variable' && product.variants?.length
    ? product.variants.map((v) => effectivePrice(v.price ?? product.price, v.price != null ? v.salePrice : (v.salePrice ?? product.salePrice)))
    : [effectivePrice(product.price, product.salePrice)]

  const jsonLd = productJsonLd({
    title: product.title,
    slug: product.slug ?? '',
    description: product.shortDescription,
    sku: product.sku,
    images: media.filter((m) => m.type === 'image').map((m) => m.src),
    prices,
    inStock: product.stockStatus !== 'out_of_stock',
    ratingAverage: product.ratingAverage,
    ratingCount: product.ratingCount,
    reviews,
  })
  const breadcrumbs = [
    { href: '/', label: 'Home' },
    ...(parent ? [{ href: `/collections/${parent.slug}`, label: parent.title }] : []),
    ...(category ? [{ href: `/collections/${category.slug}`, label: category.title }] : []),
    { href: `/products/${product.slug}`, label: product.title },
  ]

  return (
    <>
      <JsonLd data={[jsonLd, breadcrumbJsonLd(breadcrumbs)]} />
      <TrackEvent
        name="view_item"
        value={Math.min(...prices)}
        items={[{ item_id: String(product.id), item_name: product.title, item_category: category?.title, price: Math.min(...prices), quantity: 1 }]}
      />
      <Container className="pb-16">
        <nav aria-label="Breadcrumb" className="pt-6 pb-4 text-xs text-muted">
          <ol className="flex flex-wrap gap-1.5">
            {breadcrumbs.map((c, i) => (
              <li key={c.href} className="flex gap-1.5">
                {i > 0 && <span aria-hidden>/</span>}
                {i === breadcrumbs.length - 1 ? (
                  <span aria-current="page">{c.label}</span>
                ) : (
                  <Link href={c.href} className="hover:text-burgundy-700">
                    {c.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-14">
          <ProductGallery media={media.length ? media : card.media} title={product.title} />

          <div className="flex flex-col gap-5">
            <div>
              <div className="flex flex-wrap gap-2">
                {card.isNew && <Badge tone="new">New</Badge>}
                {product.productType === 'bundle' && <Badge tone="gold">Gift set</Badge>}
              </div>
              {category && <p className="mt-3 text-[11px] uppercase tracking-[0.3em] text-rose-600">{category.title}</p>}
              <h1 className="mt-1 text-4xl leading-tight text-burgundy-700 sm:text-5xl">{product.title}</h1>
              {card.rating && (
                <a href="#reviews" className="mt-2 inline-block">
                  <Rating value={card.rating.average} count={card.rating.count} />
                </a>
              )}
              {product.shortDescription && <p className="mt-4 text-sm leading-relaxed text-ink/80">{product.shortDescription}</p>}
            </div>

            <ProductPurchase
              product={card}
              deliveryEstimate={product.deliveryNote ?? settings.shipping.deliveryEstimate}
              whatsappNumber={settings.whatsappNumber}
            />

            <div>
              {product.description && (
                <Accordion title="Description" open>
                  <RichText data={product.description} />
                </Accordion>
              )}
              {(product.features?.length || product.specifications?.length) ? (
                <Accordion title="Features & specifications">
                  {product.features && product.features.length > 0 && (
                    <ul className="mb-4 list-disc space-y-1 pl-5 text-sm">
                      {product.features.map((f) => (
                        <li key={f.id}>{f.text}</li>
                      ))}
                    </ul>
                  )}
                  {product.specifications && product.specifications.length > 0 && (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                      {product.specifications.map((s) => (
                        <div key={s.id} className="contents">
                          <dt className="text-muted">{s.label}</dt>
                          <dd>{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </Accordion>
              ) : null}
              {notes.length > 0 && (
                <Accordion title="Fragrance notes">
                  <ul className="space-y-4 text-sm">
                    {notes.map((f) => (
                      <li key={f.id}>
                        <p className="flex items-center gap-2 font-display text-lg">
                          <span aria-hidden className="size-3 rounded-full" style={{ background: f.swatch ?? undefined }} />
                          {f.name}
                          {f.mood && <span className="font-sans text-xs italic text-muted">{f.mood}</span>}
                        </p>
                        <p className="text-muted">
                          {[f.topNotes && `Top: ${f.topNotes}`, f.heartNotes && `Heart: ${f.heartNotes}`, f.baseNotes && `Base: ${f.baseNotes}`]
                            .filter(Boolean)
                            .join('  |  ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Accordion>
              )}
              <Accordion title="Shipping & returns">
                {policies.shipping ? <RichText data={policies.shipping} /> : <p className="text-sm">Delivery in {settings.shipping.deliveryEstimate}.</p>}
                {policies.returns && <RichText data={policies.returns} className="mt-3" />}
                <Link href="/pages/returns" className="mt-3 inline-block text-sm text-burgundy-700 underline underline-offset-4">
                  Full returns policy
                </Link>
              </Accordion>
            </div>
          </div>
        </div>

        <div className="mt-20 space-y-20">
          <Reviews productId={product.id} reviews={reviews} distribution={distribution} average={product.ratingAverage ?? 0} count={product.ratingCount ?? reviews.length} />

          {related.length > 0 && (
            <section aria-label="You may also like">
              <SectionHeading eyebrow="Complete the set" title="You may also like" />
              <ProductGrid products={related} layout="row" priorityCount={0} />
            </section>
          )}

          <RecentlyViewed excludeId={product.id} />
        </div>
      </Container>
    </>
  )
}
