/**
 * Security headers for every response, built from environment-specific origins.
 *
 * The Content-Security-Policy has no nonces: those force every page to render per request, which
 * would lose the ISR caching behind the storefront's speed. Next's inline bootstrap scripts
 * therefore need 'unsafe-inline' for scripts; the other directives still limit where code can
 * load from, connect to and submit forms to.
 */
const TURNSTILE = 'https://challenges.cloudflare.com'
const GA_SCRIPT = 'https://www.googletagmanager.com'
const GA_COLLECT = ['https://*.google-analytics.com', 'https://*.analytics.google.com', GA_SCRIPT]
/** The hosted payment pages customers are sent to (see lib/payments). */
const PAYMENT_GATEWAYS = ['https://sandbox.jazzcash.com.pk', 'https://payments.jazzcash.com.pk', 'https://easypaystg.easypaisa.com.pk', 'https://easypay.easypaisa.com.pk']
/** Payload's JSON/code field loads its editor from this CDN. */
const ADMIN_CDN = 'https://cdn.jsdelivr.net'

type Env = { serverUrl?: string; mediaUrl?: string; isDev?: boolean }

const originOf = (url?: string) => {
  const parsed = url ? URL.parse(url) : null
  return parsed ? parsed.origin : null
}

function policy(directives: Record<string, (string | null | false | undefined)[]>) {
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values.filter(Boolean)].join(' ').trim())
    .join('; ')
}

export function contentSecurityPolicy({ serverUrl, mediaUrl, isDev }: Env, { admin = false } = {}) {
  const media = originOf(mediaUrl)
  const https = serverUrl?.startsWith('https://')
  const cdn = admin && ADMIN_CDN
  return policy({
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", isDev && "'unsafe-eval'", TURNSTILE, GA_SCRIPT, cdn],
    'style-src': ["'self'", "'unsafe-inline'", cdn],
    'img-src': ["'self'", 'data:', 'blob:', media, ...GA_COLLECT],
    'media-src': ["'self'", 'blob:', media],
    'font-src': ["'self'", 'data:', cdn],
    'connect-src': ["'self'", TURNSTILE, ...GA_COLLECT, cdn, isDev && 'ws:'],
    'frame-src': ["'self'", TURNSTILE],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'", ...PAYMENT_GATEWAYS],
    'frame-ancestors': ["'self'"],
    ...(https ? { 'upgrade-insecure-requests': [] } : {}),
  })
}

export function securityHeaders(env: Env) {
  const https = env.serverUrl?.startsWith('https://')
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: contentSecurityPolicy(env) },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
        ...(https ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
      ],
    },
    // Later rules override the same header for matching paths.
    { source: '/admin/:path*', headers: [{ key: 'Content-Security-Policy', value: contentSecurityPolicy(env, { admin: true }) }] },
    { source: '/admin', headers: [{ key: 'Content-Security-Policy', value: contentSecurityPolicy(env, { admin: true }) }] },
  ]
}
