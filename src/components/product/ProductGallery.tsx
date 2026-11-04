'use client'

import useEmblaCarousel from 'embla-carousel-react'
import { Expand, Play } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Video from 'yet-another-react-lightbox/plugins/video'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'

import { cn } from '@/lib/cn'

import type { MediaItem } from './types'

/**
 * Product page gallery: swipeable on mobile, thumbnails on every screen size, tap/click to open
 * a full-screen viewer with pinch/scroll zoom and inline video.
 */
export function ProductGallery({ media, title }: { media: MediaItem[]; title: string }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false })
  const [selected, setSelected] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState(-1)

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap())
    emblaApi.on('select', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi])

  const goTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi])

  return (
    <div className="flex min-w-0 flex-col-reverse gap-3 lg:grid lg:grid-cols-[72px_minmax(0,1fr)] lg:items-start">
      {media.length > 1 && (
        <ul className="scrollbar-none flex gap-2 overflow-x-auto lg:max-h-[640px] lg:flex-col lg:overflow-y-auto" aria-label="Choose image">
          {media.map((item, i) => (
            <li key={`${item.src}-${i}`} className="shrink-0">
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show ${item.type} ${i + 1}`}
                aria-current={i === selected}
                className={cn(
                  'relative block aspect-[4/5] w-16 overflow-hidden bg-nude-100 ring-offset-2 lg:w-[72px]',
                  i === selected ? 'ring-1 ring-burgundy-700' : 'opacity-70 hover:opacity-100',
                )}
              >
                {(item.type === 'image' || item.poster) && (
                  <Image src={item.type === 'image' ? item.src : item.poster!} alt="" fill sizes="72px" className="object-cover" />
                )}
                {item.type === 'video' && (
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/30 text-white">
                    <Play size={16} fill="currentColor" />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative overflow-hidden bg-nude-100">
        <div ref={emblaRef} className="overflow-hidden" aria-roledescription="carousel" aria-label={`${title} images`}>
          <div className="flex touch-pan-y">
            {media.map((item, i) => (
              <div key={`${item.src}-${i}`} className="relative aspect-[4/5] min-w-0 flex-[0_0_100%]" aria-roledescription="slide" aria-label={`${i + 1} of ${media.length}`}>
                {item.type === 'video' ? (
                  <video
                    src={item.src}
                    poster={item.poster}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    aria-label={item.alt}
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <button type="button" onClick={() => setLightboxIndex(i)} className="absolute inset-0 cursor-zoom-in" aria-label={`Zoom ${item.alt}`}>
                    <Image
                      src={item.src}
                      alt={item.alt}
                      fill
                      priority={i === 0}
                      fetchPriority={i === 0 ? 'high' : undefined}
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      className="object-cover"
                      draggable={false}
                    />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setLightboxIndex(selected)}
          aria-label="Open full screen"
          className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full bg-cream-50/90 shadow-card"
        >
          <Expand size={16} />
        </button>
        {media.length > 1 && (
          <p className="absolute bottom-3 left-3 bg-cream-50/90 px-2 py-0.5 text-xs tabular-nums lg:hidden" aria-hidden>
            {selected + 1} / {media.length}
          </p>
        )}
      </div>

      <Lightbox
        open={lightboxIndex >= 0}
        index={lightboxIndex}
        close={() => setLightboxIndex(-1)}
        on={{ view: ({ index }) => goTo(index) }}
        plugins={[Zoom, Video]}
        zoom={{ maxZoomPixelRatio: 3, scrollToZoom: true }}
        styles={{ container: { backgroundColor: 'rgba(43, 26, 28, 0.96)' } }}
        slides={media.map((item) =>
          item.type === 'video'
            ? { type: 'video' as const, poster: item.poster, sources: [{ src: item.src, type: 'video/mp4' }] }
            : { src: item.src, alt: item.alt },
        )}
      />
    </div>
  )
}
