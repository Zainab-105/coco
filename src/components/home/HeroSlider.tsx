'use client'

import useEmblaCarousel from 'embla-carousel-react'
import Image from 'next/image'
import { useEffect, useState } from 'react'

import { ButtonLink } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

export type Slide = {
  id: number
  title: string
  subtitle?: string | null
  ctaLabel?: string | null
  ctaUrl?: string | null
  desktop?: string
  mobile?: string
}

/** Home hero from active "Hero" banners. Auto-advances every 6 s unless the user prefers reduced motion. */
export function HeroSlider({ slides }: { slides: Slide[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: slides.length > 1 })
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap())
    emblaApi.on('select', onSelect)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = slides.length > 1 && !reduce ? setInterval(() => emblaApi.scrollNext(), 6000) : undefined
    return () => {
      emblaApi.off('select', onSelect)
      if (timer) clearInterval(timer)
    }
  }, [emblaApi, slides.length])

  return (
    <section aria-roledescription="carousel" aria-label="Featured" className="relative bg-nude-100">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {slides.map((slide, i) => (
            <div key={slide.id} className="relative isolate min-w-0 flex-[0_0_100%]" aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}`}>
              {slide.mobile && (
                <Image src={slide.mobile} alt="" fill priority={i === 0} fetchPriority={i === 0 ? 'high' : undefined} sizes="100vw" className="-z-10 object-cover opacity-45 sm:hidden" />
              )}
              {slide.desktop && (
                <Image src={slide.desktop} alt="" fill priority={i === 0} fetchPriority={i === 0 ? 'high' : undefined} sizes="100vw" className="-z-10 hidden object-cover opacity-45 sm:block" />
              )}
              <div className="mx-auto flex min-h-[72svh] max-w-7xl flex-col items-center justify-center px-4 py-20 text-center sm:min-h-[620px]">
                <p className="text-[11px] uppercase tracking-[0.4em] text-burgundy-500">Scent your world</p>
                {i === 0 ? (
                  <h1 className="mt-4 max-w-3xl text-5xl text-burgundy-700 sm:text-7xl">{slide.title}</h1>
                ) : (
                  <p className="mt-4 max-w-3xl font-display text-5xl text-burgundy-700 sm:text-7xl">{slide.title}</p>
                )}
                {slide.subtitle && <p className="mt-4 max-w-md text-sm text-ink/80">{slide.subtitle}</p>}
                {slide.ctaUrl && (
                  <ButtonLink href={slide.ctaUrl} size="lg" className="mt-10">
                    {slide.ctaLabel ?? 'Shop now'}
                  </ButtonLink>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center">
          {slides.map((s, i) => (
            <button key={s.id} type="button" onClick={() => emblaApi?.scrollTo(i)} aria-label={`Show slide ${i + 1}`} aria-current={i === selected} className="flex h-8 items-center px-1.5">
              <span className={cn('block h-1 rounded-full transition-all', i === selected ? 'w-8 bg-burgundy-700' : 'w-4 bg-burgundy-700/30')} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
