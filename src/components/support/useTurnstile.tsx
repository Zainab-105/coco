'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let loading: Promise<void> | null = null
const loadScript = () =>
  (loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loading = null
      reject(new Error('Turnstile failed to load'))
    }
    document.head.appendChild(script)
  }))

/**
 * The anti-bot widget for a form. Renders nothing without a site key. `active` delays loading
 * Cloudflare's script until needed, so it never slows pages where the form goes unused. Tokens
 * work once: call `reset` after any failed submission.
 */
export function useTurnstile(active = true) {
  const box = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const [token, setToken] = useState('')

  useEffect(() => {
    if (!SITE_KEY || !active) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return
        widget.current = window.turnstile.render(box.current, {
          sitekey: SITE_KEY,
          appearance: 'interaction-only',
          'refresh-expired': 'auto',
          callback: setToken,
          'expired-callback': () => setToken(''),
          'error-callback': () => setToken(''),
        })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [active])

  const reset = useCallback(() => {
    setToken('')
    if (widget.current) window.turnstile?.reset(widget.current)
  }, [])

  return { token, reset, element: SITE_KEY ? <div ref={box} /> : null }
}
