/**
 * Cloudflare Turnstile (anti-bot check) on public forms. Off until both keys are configured.
 * A form submits the widget's token; this confirms it with Cloudflare.
 */
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export const TURNSTILE_FAILED = 'Please wait for the security check to finish, then try again. If this keeps happening, message us on WhatsApp.'

export async function verifyTurnstile(token: unknown, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (typeof token !== 'string' || !token) return false

  const body = new URLSearchParams({ secret, response: token })
  if (ip && ip !== 'unknown') body.set('remoteip', ip)
  try {
    const res = await fetch(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(5000) })
    return ((await res.json()) as { success?: boolean }).success === true
  } catch (error) {
    // A Cloudflare outage must not stop customers ordering; rate limits still apply.
    console.warn('[turnstile] verification unavailable, allowing the request', (error as Error).message)
    return true
  }
}
