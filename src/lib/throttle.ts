/**
 * Simple per-instance throttle against spam on public forms. A shared store (Redis) would be
 * needed for multiple instances.
 */
const attempts = new Map<string, number[]>()

export function throttled(key: string, limit = 5, windowMs = 10 * 60_000) {
  const now = Date.now()
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < windowMs)
  recent.push(now)
  attempts.set(key, recent)
  if (attempts.size > 5000) attempts.clear()
  return recent.length > limit
}

/**
 * The visitor's address for rate limits. Cloudflare's header if present. Otherwise the last
 * X-Forwarded-For entry, the one added by our own proxy: anything before it is whatever the
 * client chose to send, and trusting that would let bots dodge every limit.
 */
export const clientIp = (headers: Headers) =>
  headers.get('cf-connecting-ip')?.trim() || headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown'
