'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { loadWishlistAction, syncWishlistAction } from '@/app/(frontend)/account/actions'
import { wishlist } from '@/lib/stores/lists'

const MERGED_KEY = 'coco.wishlist.account'

/** Set by the server next to the httpOnly session cookie, so guests never call account actions. */
export const isSignedIn = () => typeof document !== 'undefined' && document.cookie.split('; ').includes('coco_signed_in=1')

function storedAccount() {
  try {
    return window.localStorage.getItem(MERGED_KEY)
  } catch {
    return null
  }
}

/** Forgets the account's wishlist on this device after signing out (phones get shared). */
export function clearDeviceAccountData() {
  try {
    window.localStorage.removeItem(MERGED_KEY)
  } catch {
    // Storage unavailable: nothing stored.
  }
  wishlist.replace([])
}

/**
 * Keeps the wishlist in step with the account. The first time an account is seen on a device,
 * the device's list is merged in; after that the account's list wins on load, and every change
 * is saved. Merging on every load would bring back items removed on another device.
 */
export function AccountSync() {
  const pathname = usePathname()
  const stop = useRef<(() => void) | null>(null)

  // Checked on every page change: signing in or out does not reload the page.
  useEffect(() => {
    if (!isSignedIn()) {
      stop.current?.()
      stop.current = null
      return
    }
    if (stop.current) return

    let active = true
    let unsubscribe: (() => void) | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let lastSaved = ''
    stop.current = () => {
      active = false
      clearTimeout(timer)
      unsubscribe?.()
    }

    const start = async () => {
      const remote = await loadWishlistAction()
      if (!remote || !active) return
      const firstVisit = storedAccount() !== String(remote.accountId)
      const ids = firstVisit ? ((await syncWishlistAction(wishlist.get(), true)) ?? remote.ids) : remote.ids
      if (!active) return
      try {
        window.localStorage.setItem(MERGED_KEY, String(remote.accountId))
      } catch {
        // Storage unavailable: the next load merges again, which is harmless.
      }
      lastSaved = JSON.stringify(ids)
      wishlist.replace(ids)
      unsubscribe = wishlist.subscribe(() => {
        const current = JSON.stringify(wishlist.get())
        if (current === lastSaved || !isSignedIn()) return
        clearTimeout(timer)
        timer = setTimeout(() => {
          lastSaved = current
          void syncWishlistAction(wishlist.get(), false).catch(() => undefined)
        }, 800)
      })
    }
    start().catch(() => undefined)
  }, [pathname])

  useEffect(
    () => () => {
      stop.current?.()
      stop.current = null
    },
    [],
  )

  return null
}
