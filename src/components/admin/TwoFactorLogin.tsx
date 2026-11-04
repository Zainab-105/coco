'use client'

import { Button } from '@payloadcms/ui'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { TWO_FACTOR_REQUIRED } from '@/lib/security/twoFactorMessages'

const field = { display: 'grid', gap: 4, marginBottom: 16 } as const
const control = { minHeight: 40, padding: '0 12px', fontSize: 14, border: '1px solid var(--theme-elevation-150)', borderRadius: 4, background: 'var(--theme-input-bg)', color: 'inherit' } as const

/**
 * Admin login with an optional second step. Payload's own form has no place for a code, so this
 * replaces it (hidden in custom.scss); login itself is still Payload's endpoint, and the code is
 * enforced there by hooks/twoFactor.ts whichever form is used.
 */
export function TwoFactorLogin() {
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [needCode, setNeedCode] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, ...(needCode ? { totp: code } : {}) }),
      })
      if (res.ok) {
        // Same-site paths only, so a crafted link cannot send someone elsewhere after login.
        const target = params.get('redirect')
        window.location.assign(target?.startsWith('/admin') ? target : '/admin')
        return
      }
      const body = await res.json().catch(() => ({}))
      const message: string = body.errors?.[0]?.message ?? 'Could not log in. Please try again.'
      if (message === TWO_FACTOR_REQUIRED) setNeedCode(true)
      else setError(message)
      setCode('')
    } catch {
      setError('Could not reach the server. Check your connection.')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} aria-label="Log in" style={{ width: '100%' }}>
      {!needCode ? (
        <>
          <div style={field}>
            <label htmlFor="field-email">Email</label>
            <input id="field-email" type="email" style={control} autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div style={field}>
            <label htmlFor="field-password">Password</label>
            <input id="field-password" type="password" style={control} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </>
      ) : (
        <div style={field}>
          <label htmlFor="field-totp">Code from your authenticator app (or a recovery code)</label>
          <input id="field-totp" style={control} autoComplete="one-time-code" autoFocus required value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
      )}
      {error && (
        <p role="alert" style={{ color: 'var(--theme-error-500)', margin: '0 0 12px' }}>
          {error}
        </p>
      )}
      <Link href="/admin/forgot" style={{ display: 'inline-block', marginBottom: 16, fontSize: 13 }}>
        Forgot password?
      </Link>
      <div>
        <Button type="submit" buttonStyle="primary" margin={false} disabled={busy}>
          {needCode ? 'Verify' : 'Login'}
        </Button>
      </div>
    </form>
  )
}
