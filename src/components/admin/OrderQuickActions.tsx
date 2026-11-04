'use client'

import { Button, toast, useDocumentInfo } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const NEXT: Record<string, { status: string; label: string }[]> = {
  new: [
    { status: 'confirmed', label: 'Confirm' },
    { status: 'cancelled', label: 'Cancel' },
  ],
  confirmed: [
    { status: 'processing', label: 'Start packing' },
    { status: 'cancelled', label: 'Cancel' },
  ],
  processing: [{ status: 'shipped', label: 'Mark shipped' }],
  shipped: [
    { status: 'delivered', label: 'Mark delivered' },
    { status: 'returned', label: 'Returned' },
  ],
  delivered: [{ status: 'returned', label: 'Returned' }],
  returned: [{ status: 'refunded', label: 'Refunded' }],
}

type OrderData = {
  status?: string
  orderNumber?: string
  shippingAddress?: { phone?: string; fullName?: string }
  fulfilment?: { courier?: string; trackingNumber?: string }
}

/** One-click status changes, printing and WhatsApp on the order screen. */
export function OrderQuickActions() {
  const { id, savedDocumentData } = useDocumentInfo()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const order = (savedDocumentData ?? {}) as OrderData
  if (!id || !order.status) return null

  const update = async (status: string) => {
    const body: Record<string, unknown> = { status }
    if (status === 'shipped' && !order.fulfilment?.trackingNumber) {
      const tracking = window.prompt('Tracking number (leave empty to add later):')
      if (tracking === null) return
      if (tracking.trim()) body.fulfilment = { ...order.fulfilment, trackingNumber: tracking.trim() }
    }
    if ((status === 'cancelled' || status === 'returned') && !window.confirm(`Mark order ${order.orderNumber} as ${status}? Stock will be restored.`)) return

    setBusy(true)
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (res.ok) {
      toast.success(`Order ${order.orderNumber} is now ${status}.`)
      router.refresh()
    } else {
      const err = (await res.json().catch(() => null)) as { errors?: { message: string }[] } | null
      toast.error(err?.errors?.[0]?.message ?? 'Could not update the order.')
    }
  }

  const phone = order.shippingAddress?.phone?.replace(/[^\d]/g, '')
  const message = encodeURIComponent(`Assalam o Alaikum ${order.shippingAddress?.fullName ?? ''}, this is COCO about your order ${order.orderNumber}.`)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {(NEXT[order.status] ?? []).map((n) => (
        <Button
          key={n.status}
          size="small"
          margin={false}
          buttonStyle={n.status === 'cancelled' || n.status === 'returned' ? 'secondary' : 'primary'}
          disabled={busy}
          onClick={() => update(n.status)}
        >
          {n.label}
        </Button>
      ))}
      <Button el="anchor" url={`/print/orders?doc=invoice&ids=${id}`} newTab size="small" margin={false} buttonStyle="secondary">
        Invoice
      </Button>
      <Button el="anchor" url={`/print/orders?doc=packing&ids=${id}`} newTab size="small" margin={false} buttonStyle="secondary">
        Packing slip
      </Button>
      {phone && (
        <Button el="anchor" url={`https://wa.me/${phone}?text=${message}`} newTab size="small" margin={false} buttonStyle="secondary">
          WhatsApp
        </Button>
      )}
    </div>
  )
}
