import type { Metadata } from 'next'

/**
 * Link previews on WhatsApp, Facebook and X. Next replaces (not merges) these per page, so every
 * page with its own card repeats the shared fields. Without an image, the site's default applies.
 */
export const DEFAULT_SOCIAL_IMAGE = '/brand/social-card.png'

export function socialCard({ title, description, url, image }: { title: string; description?: string; url: string; image?: string }): Pick<Metadata, 'openGraph' | 'twitter'> {
  const images = [{ url: image ?? DEFAULT_SOCIAL_IMAGE, width: 1200, height: 630 }]
  return {
    openGraph: { type: 'website', siteName: 'COCO', locale: 'en_PK', title, description, url, images },
    twitter: { card: 'summary_large_image', title, description, images: images.map((i) => i.url) },
  }
}
