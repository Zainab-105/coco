'use client'

import { useActionState, useEffect, useState } from 'react'

import { subscribeAction, type NewsletterState } from '@/app/(frontend)/newsletter/actions'
import { useTurnstile } from '@/components/support/useTurnstile'
import { Honeypot } from '@/components/ui/Honeypot'

/** Footer email sign-up. Consent is explicit: nothing is pre-ticked and the purpose is stated. */
export function NewsletterForm() {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribeAction, {})
  // The footer is on every page: load the anti-bot script only once someone starts typing.
  const [engaged, setEngaged] = useState(false)
  const turnstile = useTurnstile(engaged)
  const { reset } = turnstile

  // Tokens work once, so a retry needs a fresh one.
  useEffect(() => {
    if (state.ok === false) reset()
  }, [state, reset])

  return (
    <form action={action} className="mt-4 space-y-2">
      <label htmlFor="newsletter-email" className="block text-sm opacity-90">
        New scents and offers, about twice a month.
      </label>
      <div className="flex">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Your email"
          onFocus={() => setEngaged(true)}
          aria-describedby="newsletter-status"
          className="min-h-11 w-full min-w-0 border border-nude-100/40 bg-transparent px-3 text-sm text-nude-100 placeholder:text-nude-100/60 focus:border-nude-100 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 shrink-0 bg-nude-100 px-4 text-[11px] tracking-[0.18em] text-burgundy-900 uppercase hover:bg-cream-50 disabled:opacity-60"
        >
          {pending ? '...' : 'Join'}
        </button>
      </div>
      <input type="hidden" name="turnstile" value={turnstile.token} />
      {turnstile.element}
      <Honeypot name="leave_empty" />
      <p id="newsletter-status" aria-live="polite" className="min-h-4 text-xs opacity-90">
        {state.message ?? 'Unsubscribe any time.'}
      </p>
    </form>
  )
}
