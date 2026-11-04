import { beforeAll, describe, expect, it } from 'vitest'

import { firstTimeSeen, scrubUrl } from '@/lib/analytics'
import { absoluteUrl, breadcrumbJsonLd, productJsonLd, serializeJsonLd } from '@/lib/seo/jsonLd'
import { normalizeRedirectPath, redirectTargetProblem, resolveRedirect } from '@/lib/seo/redirects'
import { contentSecurityPolicy, securityHeaders } from '@/lib/security/headers'
import {
  base32Decode,
  base32Encode,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  otpauthUrl,
  totpCode,
  totpCounter,
  verifyTotp,
} from '@/lib/security/totp'
import { clientIp } from '@/lib/throttle'

describe('TOTP', () => {
  // RFC 6238 appendix B (SHA-1), truncated from 8 to 6 digits.
  const secret = base32Encode(Buffer.from('12345678901234567890'))

  it('matches the published test vectors', () => {
    expect(totpCode(secret, totpCounter(59_000))).toBe('287082')
    expect(totpCode(secret, totpCounter(1111111109_000))).toBe('081804')
    expect(totpCode(secret, totpCounter(1234567890_000))).toBe('005924')
    expect(totpCode(secret, totpCounter(2000000000_000))).toBe('279037')
  })

  it('round-trips base32', () => {
    const bytes = Buffer.from('any bytes at all!')
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true)
  })

  it('accepts neighbouring steps for clock drift, but nothing further', () => {
    const now = 1234567890_000
    const counter = totpCounter(now)
    expect(verifyTotp(secret, totpCode(secret, counter), { now })).toBe(counter)
    expect(verifyTotp(secret, totpCode(secret, counter - 1), { now })).toBe(counter - 1)
    expect(verifyTotp(secret, totpCode(secret, counter + 1), { now })).toBe(counter + 1)
    expect(verifyTotp(secret, totpCode(secret, counter - 2), { now })).toBeNull()
  })

  it('refuses a code already used, and malformed input', () => {
    const now = 1234567890_000
    const counter = totpCounter(now)
    expect(verifyTotp(secret, totpCode(secret, counter), { now, lastCounter: counter })).toBeNull()
    expect(verifyTotp(secret, '12345', { now })).toBeNull()
    expect(verifyTotp(secret, 'abcdef', { now })).toBeNull()
  })

  it('builds the link authenticator apps scan', () => {
    const url = otpauthUrl(secret, 'owner@coco.pk')
    expect(url).toContain(`secret=${secret}`)
    expect(url).toMatch(/^otpauth:\/\/totp\/COCO%20Admin%3Aowner%40coco\.pk\?/)
  })

  it('generates distinct recovery codes, hashed regardless of case or spacing', () => {
    const codes = generateRecoveryCodes()
    expect(new Set(codes).size).toBe(8)
    expect(codes[0]).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/)
    expect(hashRecoveryCode(` ${codes[0].toUpperCase()} `)).toBe(hashRecoveryCode(codes[0]))
    expect(hashRecoveryCode(codes[0])).not.toContain(codes[0])
  })

  describe('stored secrets', () => {
    beforeAll(() => {
      process.env.PAYLOAD_SECRET ||= 'unit-test-secret'
    })

    it('encrypts with a fresh IV each time and detects tampering', () => {
      const a = encryptSecret('SECRET')
      expect(a).not.toContain('SECRET')
      expect(encryptSecret('SECRET')).not.toBe(a)
      expect(decryptSecret(a)).toBe('SECRET')
      const [iv, tag, data] = a.split('.')
      const flipped = Buffer.from(data, 'base64url')
      flipped[0] ^= 1
      expect(() => decryptSecret([iv, tag, flipped.toString('base64url')].join('.'))).toThrow()
    })
  })
})

describe('security headers', () => {
  const prod = { serverUrl: 'https://coco.pk', mediaUrl: 'https://media.coco.pk' }
  const header = (rules: ReturnType<typeof securityHeaders>, key: string) => rules[0].headers.find((h) => h.key === key)?.value

  it('locks down the storefront policy', () => {
    const csp = contentSecurityPolicy(prod)
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("frame-ancestors 'self'")
    expect(csp).toContain('upgrade-insecure-requests')
    expect(csp).not.toContain('unsafe-eval')
    expect(csp).not.toContain('cdn.jsdelivr.net')
    expect(csp).not.toContain('undefined')
  })

  it('allows what the site really uses: media host, payment pages, Turnstile, GA', () => {
    const csp = contentSecurityPolicy(prod)
    expect(csp).toMatch(/img-src [^;]*https:\/\/media\.coco\.pk/)
    expect(csp).toMatch(/media-src [^;]*https:\/\/media\.coco\.pk/)
    expect(csp).toMatch(/form-action [^;]*https:\/\/payments\.jazzcash\.com\.pk/)
    expect(csp).toMatch(/form-action [^;]*https:\/\/easypay\.easypaisa\.com\.pk/)
    expect(csp).toMatch(/frame-src [^;]*https:\/\/challenges\.cloudflare\.com/)
    expect(csp).toMatch(/script-src [^;]*https:\/\/www\.googletagmanager\.com/)
  })

  it('loosens only for the admin editor CDN and for development', () => {
    expect(contentSecurityPolicy(prod, { admin: true })).toContain('https://cdn.jsdelivr.net')
    const dev = contentSecurityPolicy({ serverUrl: 'http://localhost:3000', isDev: true })
    expect(dev).toContain("'unsafe-eval'")
    expect(dev).toContain('ws:')
    expect(dev).not.toContain('upgrade-insecure-requests')
  })

  it('sends HSTS only over HTTPS', () => {
    expect(header(securityHeaders(prod), 'Strict-Transport-Security')).toContain('max-age=31536000')
    expect(header(securityHeaders({ serverUrl: 'http://localhost:3000' }), 'Strict-Transport-Security')).toBeUndefined()
  })
})

describe('client IP for rate limits', () => {
  const ip = (headers: Record<string, string>) => clientIp(new Headers(headers))

  it('cannot be chosen by the client through X-Forwarded-For', () => {
    expect(ip({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 203.0.113.9' })).toBe('203.0.113.9')
  })

  it('prefers Cloudflare, and shares one bucket when unknown', () => {
    expect(ip({ 'cf-connecting-ip': '198.51.100.7', 'x-forwarded-for': '1.1.1.1' })).toBe('198.51.100.7')
    expect(ip({})).toBe('unknown')
  })
})

describe('analytics privacy', () => {
  it('removes order tokens, order numbers and phone numbers from URLs', () => {
    expect(scrubUrl('https://coco.pk/order/COCO-261102-ABCD?t=secrettoken&placed=1')).toBe('https://coco.pk/order')
    expect(scrubUrl('https://coco.pk/checkout/pay/COCO-1?t=secret')).toBe('https://coco.pk/checkout/pay')
    expect(scrubUrl('https://coco.pk/track-order?order=COCO-1&phone=03001234567')).toBe('https://coco.pk/track-order')
    expect(scrubUrl('https://coco.pk/products/rose?order=COCO-1&t=secret')).toBe('https://coco.pk/products/rose')
    expect(scrubUrl('https://coco.pk/unsubscribe?token=abc')).toBe('https://coco.pk/unsubscribe')
  })

  it('keeps campaign tags, and copes with no referrer', () => {
    expect(scrubUrl('https://coco.pk/?utm_source=ig&phone=0300')).toBe('https://coco.pk/?utm_source=ig')
    expect(scrubUrl('')).toBe('')
  })

  it('counts a sale once across reloads', () => {
    expect(firstTimeSeen('COCO-A')).toBe(true)
    expect(firstTimeSeen('COCO-A')).toBe(false)
    expect(firstTimeSeen('COCO-B')).toBe(true)
  })
})

describe('structured data', () => {
  const base = { title: 'Diffuser', slug: 'diffuser', images: ['/api/media/file/a.webp', 'https://media.coco.pk/b.webp'], inStock: true }

  it('uses absolute image and page URLs, as search engines require', () => {
    const ld = productJsonLd({ ...base, prices: [1450] })
    expect(ld.image[0]).toBe(absoluteUrl('/api/media/file/a.webp'))
    expect(ld.image[0]).toMatch(/^https?:\/\//)
    expect(ld.image[1]).toBe('https://media.coco.pk/b.webp')
    expect(ld.url).toMatch(/^https?:\/\/.*\/products\/diffuser$/)
  })

  it('gives one price as an Offer and a range as an AggregateOffer', () => {
    expect(productJsonLd({ ...base, prices: [1450, 1450] }).offers).toMatchObject({ '@type': 'Offer', price: 1450, priceCurrency: 'PKR' })
    expect(productJsonLd({ ...base, prices: [1200, 1450, 1800] }).offers).toMatchObject({ '@type': 'AggregateOffer', lowPrice: 1200, highPrice: 1800, offerCount: 3 })
    expect(productJsonLd({ ...base, prices: [100], inStock: false }).offers.availability).toBe('https://schema.org/OutOfStock')
  })

  it('includes ratings and reviews only when there are some', () => {
    expect(productJsonLd({ ...base, prices: [1] })).toMatchObject({ aggregateRating: undefined, review: undefined })
    const ld = productJsonLd({
      ...base,
      prices: [1],
      ratingAverage: 4.5,
      ratingCount: 2,
      reviews: [{ authorName: 'Sana', rating: 5, title: 'Nice', body: 'Lovely', date: '2026-10-05T07:00:00.000Z' }],
    })
    expect(ld.aggregateRating).toMatchObject({ ratingValue: 4.5, reviewCount: 2 })
    expect(ld.review?.[0]).toMatchObject({ author: { name: 'Sana' }, datePublished: '2026-10-05', reviewRating: { ratingValue: 5 } })
  })

  it('numbers breadcrumbs from 1', () => {
    const ld = breadcrumbJsonLd([{ href: '/', label: 'Home' }, { href: '/collections/x', label: 'X' }])
    expect(ld.itemListElement[1]).toMatchObject({ position: 2, name: 'X' })
  })

  it('cannot be broken out of by review text', () => {
    expect(serializeJsonLd({ reviewBody: '</script><script>alert(1)</script>' })).not.toContain('<')
  })
})

describe('redirect rules', () => {
  it('normalises the old path', () => {
    expect(normalizeRedirectPath(' /products/old/?x=1#a ')).toBe('/products/old')
    expect(normalizeRedirectPath('products/old')).toBe('/products/old')
  })

  it('accepts site paths and https addresses only', () => {
    expect(redirectTargetProblem('/collections/x')).toBeNull()
    expect(redirectTargetProblem('https://coco.pk/x')).toBeNull()
    expect(redirectTargetProblem('//evil.example')).toBeTruthy()
    expect(redirectTargetProblem('/\\evil.example')).toBeTruthy()
    expect(redirectTargetProblem('javascript:alert(1)')).toBeTruthy()
    expect(redirectTargetProblem('http://coco.pk')).toBeTruthy()
  })

  it('follows chains in one hop and refuses loops', () => {
    const rules = new Map([['/a', '/b'], ['/b', '/c'], ['/x', '/y'], ['/y', '/x'], ['/self', '/self']])
    expect(resolveRedirect('/a', rules)).toBe('/c')
    expect(resolveRedirect('/none', rules)).toBeNull()
    expect(resolveRedirect('/x', rules)).toBeNull()
    expect(resolveRedirect('/self', rules)).toBeNull()
  })
})
