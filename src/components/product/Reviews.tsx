import { BadgeCheck } from 'lucide-react'
import Image from 'next/image'

import { Rating } from '@/components/ui/Rating'
import type { ReviewView } from '@/lib/storefront/catalog'

import { ReviewForm } from './ReviewForm'

/** Rating summary, approved reviews and the (moderated) review form. */
export function Reviews({
  productId,
  reviews,
  distribution,
  average,
  count,
}: {
  productId: number
  reviews: ReviewView[]
  distribution: { stars: number; n: number }[]
  average: number
  count: number
}) {
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="scroll-mt-28">
      <h2 id="reviews-title" className="text-3xl text-burgundy-700">
        Customer reviews
      </h2>

      {count === 0 ? (
        <p className="mt-4 text-sm text-muted">No reviews yet. Be the first to share how this scent made your drive better.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[260px_1fr]">
          <div>
            <p className="font-display text-5xl text-burgundy-700">{average.toFixed(1)}</p>
            <Rating value={average} count={count} size={18} className="mt-1" />
            <ul className="mt-5 space-y-1.5">
              {distribution.map(({ stars, n }) => (
                <li key={stars} className="flex items-center gap-2 text-xs">
                  <span className="w-3 tabular-nums">{stars}</span>
                  <span className="h-1.5 flex-1 bg-blush-200">
                    <span className="block h-full bg-gold-500" style={{ width: `${count ? (n / count) * 100 : 0}%` }} />
                  </span>
                  <span className="w-5 text-right tabular-nums text-muted">{n}</span>
                </li>
              ))}
            </ul>
          </div>

          <ul className="divide-y divide-blush-200">
            {reviews.map((r) => (
              <li key={r.id} className="py-6 first:pt-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Rating value={r.rating} />
                  <p className="text-sm font-medium">{r.authorName}</p>
                  {r.verified && (
                    <p className="flex items-center gap-1 text-xs text-success">
                      <BadgeCheck size={14} /> Verified purchase
                    </p>
                  )}
                  <time className="ml-auto text-xs text-muted" dateTime={r.date}>
                    {new Date(r.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </time>
                </div>
                {r.title && <p className="mt-2 font-display text-xl">{r.title}</p>}
                {r.body && <p className="mt-1 text-sm leading-relaxed">{r.body}</p>}
                {r.photos.length > 0 && (
                  <ul className="mt-3 flex gap-2">
                    {r.photos.map((src) => (
                      <li key={src} className="relative aspect-square w-20 overflow-hidden bg-nude-100">
                        <Image src={src} alt={`Photo from ${r.authorName}`} fill sizes="80px" className="object-cover" />
                      </li>
                    ))}
                  </ul>
                )}
                {r.videos.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {r.videos.map((src) => (
                      <li key={src} className="w-44 bg-nude-100">
                        <video src={src} controls playsInline preload="metadata" aria-label={`Video from ${r.authorName}`} className="aspect-[4/5] w-full object-cover" />
                      </li>
                    ))}
                  </ul>
                )}
                {r.adminReply && (
                  <p className="mt-3 border-l-2 border-gold-500 bg-nude-100/60 px-3 py-2 text-sm">
                    <span className="font-medium">COCO: </span>
                    {r.adminReply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ReviewForm productId={productId} />
    </section>
  )
}
