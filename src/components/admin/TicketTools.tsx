'use client'

import { Button, useDocumentInfo } from '@payloadcms/ui'

/** Reply shortcuts on a support ticket. */
export function TicketTools() {
  const { id, savedDocumentData } = useDocumentInfo()
  const ticket = (savedDocumentData ?? {}) as { phone?: string; email?: string; subject?: string }
  if (!id) return null

  const phone = ticket.phone?.replace(/[^\d]/g, '')
  const reference = `COCO support #${id}`
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {phone && (
        <Button el="anchor" url={`https://wa.me/${phone}?text=${encodeURIComponent(`Hi, this is COCO about your message (${reference}).`)}`} newTab size="small" margin={false} buttonStyle="secondary">
          WhatsApp
        </Button>
      )}
      {ticket.email && (
        <Button el="anchor" url={`mailto:${ticket.email}?subject=${encodeURIComponent(reference)}`} size="small" margin={false} buttonStyle="secondary">
          Email
        </Button>
      )}
    </div>
  )
}
