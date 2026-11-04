'use client'

import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/cn'

import type { MediaItem } from './types'

/**
 * Swipeable photo/video gallery used on product cards (client requirement: browse media
 * without opening the product page). Touch-swipe on mobile, arrows on desktop hover,
 * dot indicators always. Videos are muted and only play while their slide is visible.
 */
export function MediaCarousel({
  media,
  href,
  sizes,
  priority,
  aspect = 'aspect-[4/5]',
  className,
}: {
  media: MediaItem[]
  href?: string
  sizes: string
  priority?: boolean
  aspect?: string
  className?: string
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, containScroll: 'trimSnaps' })
  const [selected, setSelected] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap())
    emblaApi.on('select', onSelect).on('reInit', onSelect)
    return () => {
      emblaApi.off('select', onSelect).off('reInit', onSelect)
    }
  }, [emblaApi])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.6 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi])
  const multiple = media.length > 1

  return (
    <div ref={rootRef} className={cn('group/media relative overflow-hidden bg-nude-100', aspect, className)}>
      <div ref={emblaRef} className="h-full overflow-hidden" aria-roledescription="carousel">
        <div className="flex h-full touch-pan-y">
          {media.map((item, i) => {
            const slide =
              item.type === 'video' ? (
                <VideoSlide item={item} active={inView && selected === i} />
              ) : (
                <Image
                  src={item.src}
                  alt={item.alt}
                  fill
                  sizes={sizes}
                  priority={priority && i === 0}
                  fetchPriority={priority && i === 0 ? 'high' : undefined}
                  className="object-cover"
                  draggable={false}
                />
              )
            return (
              <div
                key={`${item.src}-${i}`}
                className="relative h-full min-w-0 flex-[0_0_100%]"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${media.length}`}
              >
                {href ? (
                  <Link href={href} tabIndex={i === selected ? 0 : -1} className="block h-full" draggable={false}>
                    {slide}
                  </Link>
                ) : (
                  slide
                )}
              </div>
            )
          })}
        </div>
      </div>

      {multiple && (
        <>
          <button
            type="button"
            onClick={() => emblaApi?.scrollPrev()}
            disabled={selected === 0}
            aria-label="Previous image"
            className="absolute top-1/2 left-2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-cream-50/90 text-ink opacity-0 shadow-card transition-opacity group-hover/media:opacity-100 focus-visible:opacity-100 disabled:!opacity-0 md:flex"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => emblaApi?.scrollNext()}
            disabled={selected === media.length - 1}
            aria-label="Next image"
            className="absolute top-1/2 right-2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-cream-50/90 text-ink opacity-0 shadow-card transition-opacity group-hover/media:opacity-100 focus-visible:opacity-100 disabled:!opacity-0 md:flex"
          >
            <ChevronRight size={18} />
          </button>
          {/* Phones: indicators only, since people swipe and a row of small buttons would sit on top of Add to cart. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5 sm:hidden">
            {media.map((_, i) => (
              <span key={i} className={cn('block h-1.5 rounded-full transition-all', i === selected ? 'w-4 bg-burgundy-700' : 'w-1.5 bg-cream-50/90 ring-1 ring-ink/10')} />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0.5 hidden justify-center sm:flex">
            {media.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollTo(i)}
                aria-label={`Show ${item.type === 'video' ? 'video' : 'image'} ${i + 1}`}
                aria-current={i === selected}
                className="pointer-events-auto flex h-6 min-w-6 items-center justify-center"
              >
                <span className={cn('block h-1.5 rounded-full transition-all', i === selected ? 'w-4 bg-burgundy-700' : 'w-1.5 bg-cream-50/90 ring-1 ring-ink/10')} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function VideoSlide({ item, active }: { item: MediaItem; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    if (active) video.play().catch(() => {})
    else video.pause()
  }, [active])

  return (
    <>
      <video
        ref={ref}
        src={item.src}
        poster={item.poster}
        muted
        loop
        playsInline
        preload="none"
        aria-label={item.alt}
        className="absolute inset-0 size-full object-cover"
      />
      {!active && (
        <span className="absolute top-2 left-2 flex size-7 items-center justify-center rounded-full bg-ink/60 text-white">
          <Play size={12} fill="currentColor" />
        </span>
      )}
    </>
  )
}
