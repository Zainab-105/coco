'use client'

import { useAuth } from '@payloadcms/ui'

/** Initials instead of Gravatar, so admin email addresses are never sent to a third party. */
export function AdminAvatar() {
  const { user } = useAuth<{ name?: string; email?: string }>()
  const initials = (user?.name || user?.email?.split('@')[0] || '?')
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  return (
    <span className="coco-avatar" aria-hidden>
      {initials}
    </span>
  )
}
