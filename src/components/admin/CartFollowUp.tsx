'use client'

import { Button, toast, useDocumentInfo } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'

type CartData = {
  status?: string
  name?: string
  phone?: string
  items?: { title?: string; variantLabel?: string; quantity?: number }[]
}

/** WhatsApp follow-up with the cart contents pre-filled, and "mark contacted" on an abandoned cart. */
export function CartFollowUp() {
  const { id, savedDocumentData } = useDocumentInfo()
  const router = useRouter()
  const cart = (savedDocumentData ?? {}) as CartData
  if (!id || !cart.phone) return null

  const items = (cart.items ?? [])
    .map((i) => `${i.title}${i.variantLabel ? ` (${i.variantLabel})` : ''} x${i.quantity ?? 1}`)
    .join(', ')
  const message = `Hi ${cart.name?.split(' ')[0] ?? ''}, this is COCO. We noticed you were checking out ${items}. Can we help you complete your order?`
  const href = `https://wa.me/${cart.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(message)}`

  const markContacted = async () => {
    const res = await fetch(`/api/carts/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'contacted' }),
    })
    if (res.ok) {
      toast.success('Marked as contacted.')
      router.refresh()
    } else toast.error('Could not update the cart.')
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <Button el="anchor" url={href} newTab size="small" margin={false} buttonStyle="secondary">
        WhatsApp
      </Button>
      {cart.status === 'open' && (
        <Button size="small" margin={false} buttonStyle="secondary" onClick={markContacted}>
          Mark contacted
        </Button>
      )}
    </div>
  )
}
