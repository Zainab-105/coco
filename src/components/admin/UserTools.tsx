'use client'

import { Button, toast, useAuth, useDocumentInfo } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'

/** On a user's screen: the owner can clear two-factor for someone who lost their phone. */
export function UserTools() {
  const { id, savedDocumentData } = useDocumentInfo()
  const { user } = useAuth<{ id: number; roles?: string[] }>()
  const router = useRouter()
  const target = (savedDocumentData ?? {}) as { email?: string; twoFactor?: { enabled?: boolean } }
  if (!id || !target.twoFactor?.enabled || !user?.roles?.includes('owner')) return null

  const reset = async () => {
    if (!window.confirm(`Reset two-factor authentication for ${target.email}? Confirm their identity first: they can then log in with only their password until they set it up again.`)) return
    const res = await fetch(`/api/users/${id}/2fa/reset`, { method: 'POST', credentials: 'include' })
    if (res.ok) {
      toast.success('Two-factor authentication reset.')
      router.refresh()
    } else toast.error('Could not reset it.')
  }

  return (
    <Button size="small" margin={false} buttonStyle="secondary" onClick={reset}>
      Reset 2FA
    </Button>
  )
}
