'use client'

import { Button, toast, useDocumentInfo } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'

/** WhatsApp shortcut and duplicate-merge tool on the customer screen. */
export function CustomerTools() {
  const { id, savedDocumentData } = useDocumentInfo()
  const router = useRouter()
  const customer = (savedDocumentData ?? {}) as { name?: string; phone?: string }
  if (!id) return null

  const merge = async () => {
    const phone = window.prompt(
      `Merge a duplicate profile into ${customer.name}.\nEnter the duplicate's phone number. Its orders, addresses and notes move here and the duplicate is deleted.`,
    )
    if (!phone) return
    const res = await fetch(`/api/customers/${id}/merge`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    const body = (await res.json().catch(() => ({}))) as { error?: string; ordersMoved?: number }
    if (res.ok) {
      toast.success(`Merged. ${body.ordersMoved ?? 0} orders moved.`)
      router.refresh()
    } else toast.error(body.error ?? 'Merge failed.')
  }

  const phone = customer.phone?.replace(/[^\d]/g, '')
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {phone && (
        <Button el="anchor" url={`https://wa.me/${phone}`} newTab size="small" margin={false} buttonStyle="secondary">
          WhatsApp
        </Button>
      )}
      <Button size="small" margin={false} buttonStyle="secondary" onClick={merge}>
        Merge duplicate
      </Button>
    </div>
  )
}
