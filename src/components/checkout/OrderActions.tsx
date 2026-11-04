'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { submitTransferReference, switchToCashOnDelivery } from '@/app/(frontend)/order/[number]/actions'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { cart } from '@/lib/stores/cart'

export function TransferReferenceForm({ orderNumber, token, current }: { orderNumber: string; token: string; current?: string | null }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  return (
    <form
      action={(formData) =>
        start(async () => {
          const r = await submitTransferReference(orderNumber, token, formData)
          setMessage({ ok: r.ok, text: r.message })
        })
      }
      className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <TextField name="reference" label="Transaction ID" defaultValue={current ?? ''} placeholder="e.g. 0123456789" className="flex-1" required />
      <Button type="submit" disabled={pending}>
        {pending ? 'Sending...' : 'Submit'}
      </Button>
      {message && <p className={message.ok ? 'text-sm text-success' : 'text-sm text-danger'}>{message.text}</p>}
    </form>
  )
}

export function SwitchToCodButton({ orderNumber, token }: { orderNumber: string; token: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <div>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await switchToCashOnDelivery(orderNumber, token)
            if (r.ok) router.refresh()
            else setError(r.message)
          })
        }
      >
        Pay with Cash on Delivery instead
      </Button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  )
}

/** Clears the device cart once an order is confirmed (covers gateway redirects that skip the checkout form). */
export function ClearCart() {
  useEffect(() => cart.clear(), [])
  return null
}
