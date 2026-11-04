'use client'

import { useActionState } from 'react'

import { unsubscribeAction, type NewsletterState } from '@/app/(frontend)/newsletter/actions'
import { Button } from '@/components/ui/Button'

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(unsubscribeAction, {})

  if (state.ok) return <p className="mt-8 text-sm" role="status">{state.message}</p>

  return (
    <form action={action} className="mt-8 space-y-3">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Unsubscribing...' : 'Unsubscribe'}
      </Button>
      {state.message && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  )
}
