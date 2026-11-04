'use client'

import { Button, toast, useDocumentInfo } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'

const ACTIONS = [
  { status: 'approved', label: 'Approve' },
  { status: 'hidden', label: 'Hide' },
  { status: 'spam', label: 'Spam' },
]

/** One-click moderation on a review. Approving also makes its photos and videos public. */
export function ReviewActions() {
  const { id, savedDocumentData } = useDocumentInfo()
  const router = useRouter()
  const current = (savedDocumentData as { status?: string } | undefined)?.status
  if (!id) return null

  const update = async (status: string) => {
    const res = await fetch(`/api/reviews/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast.success(`Review marked ${status}.`)
      router.refresh()
    } else toast.error('Could not update the review.')
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {ACTIONS.filter((a) => a.status !== current).map((a) => (
        <Button key={a.status} size="small" margin={false} buttonStyle={a.status === 'approved' ? 'primary' : 'secondary'} onClick={() => update(a.status)}>
          {a.label}
        </Button>
      ))}
    </div>
  )
}
