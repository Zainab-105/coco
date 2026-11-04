'use server'

import { headers } from 'next/headers'

import { subscribe, unsubscribe } from '@/lib/marketing/server'
import { TURNSTILE_FAILED, verifyTurnstile } from '@/lib/security/turnstile'
import { clientIp, throttled } from '@/lib/throttle'

export type NewsletterState = { ok?: boolean; message?: string }

export async function subscribeAction(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  // Honeypot: bots fill every field. Pretend it worked.
  if (formData.get('company')) return { ok: true, message: 'Thank you for subscribing.' }

  const ip = clientIp(await headers())
  if (throttled(`newsletter:${ip}`)) return { ok: false, message: 'Too many attempts. Please try again later.' }

  if (!(await verifyTurnstile(formData.get('turnstile'), ip))) return { ok: false, message: TURNSTILE_FAILED }

  try {
    const ok = await subscribe(String(formData.get('email') ?? ''), 'footer')
    return ok
      ? { ok: true, message: 'Thank you! New scents and offers will reach your inbox.' }
      : { ok: false, message: 'Please enter a valid email address.' }
  } catch (error) {
    console.error('[newsletter] subscribe failed', error)
    return { ok: false, message: 'Something went wrong. Please try again.' }
  }
}

export async function unsubscribeAction(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  const ok = await unsubscribe(String(formData.get('token') ?? '')).catch(() => false)
  return ok
    ? { ok: true, message: 'You have been unsubscribed. You will not receive marketing emails from COCO.' }
    : { ok: false, message: 'This link is not valid. Please contact us and we will remove you.' }
}
