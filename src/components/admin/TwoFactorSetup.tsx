'use client'

import { Button, toast } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const input = { minHeight: 40, padding: '0 12px', fontSize: 16, letterSpacing: 2, border: '1px solid var(--theme-elevation-150)', borderRadius: 4, background: 'var(--theme-input-bg)', color: 'inherit', width: 180 } as const

async function post(path: string, body?: unknown) {
  const res = await fetch(`/api/users/2fa/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

/** Turn on (scan, confirm, save recovery codes) or turn off two-factor authentication. */
export function TwoFactorSetup({ enabled, recoveryCodesLeft }: { enabled: boolean; recoveryCodesLeft: number }) {
  const router = useRouter()
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null)
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)

  const start = async () => {
    setBusy(true)
    const { ok, data } = await post('setup')
    setBusy(false)
    if (ok) setSetup(data)
    else toast.error(data.error ?? 'Could not start the setup.')
  }

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { ok, data } = await post('enable', { code })
    setBusy(false)
    setCode('')
    if (ok) setRecoveryCodes(data.recoveryCodes)
    else toast.error(data.error ?? 'That code is not correct.')
  }

  const disable = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { ok, data } = await post('disable', { code })
    setBusy(false)
    setCode('')
    if (ok) {
      toast.success('Two-factor authentication is off.')
      setSetup(null)
      router.refresh()
    } else toast.error(data.error ?? 'That code is not correct.')
  }

  if (recoveryCodes) {
    return (
      <section>
        <h2>Save your recovery codes</h2>
        <p>
          <strong>Two-factor authentication is on.</strong> If you lose your phone, each of these codes lets you log in once. They will not be shown again:
          store them somewhere safe, away from your phone.
        </p>
        <ul data-testid="tf-recovery" style={{ fontFamily: 'monospace', fontSize: 16, listStyle: 'none', padding: 0, columns: 2 }}>
          {recoveryCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <Button
          onClick={() => {
            setRecoveryCodes(null)
            router.refresh()
          }}
        >
          I have saved them
        </Button>
      </section>
    )
  }

  if (enabled) {
    return (
      <section>
        <p>
          <strong style={{ color: '#2f6b3a' }}>On.</strong> {recoveryCodesLeft} recovery codes left.
        </p>
        <form onSubmit={disable} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label htmlFor="tf-disable">Current code to turn it off</label>
          <input id="tf-disable" style={input} autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
          <Button type="submit" buttonStyle="secondary" margin={false} disabled={busy}>
            Turn off
          </Button>
        </form>
      </section>
    )
  }

  if (!setup) {
    return (
      <section>
        <p>
          <strong style={{ color: '#a3262f' }}>Off.</strong> You need an authenticator app, such as Google Authenticator or Authy.
        </p>
        <Button onClick={start} disabled={busy}>
          Turn on
        </Button>
      </section>
    )
  }

  return (
    <section>
      <h2>Scan this with your authenticator app</h2>
      {/* SVG produced on our server from the QR library, containing only the otpauth link. */}
      <div style={{ width: 220, background: '#fff', padding: 8 }} data-testid="tf-qr" dangerouslySetInnerHTML={{ __html: setup.qr }} />
      <p>
        Cannot scan? Enter this key: <code data-testid="tf-secret">{setup.secret}</code>
      </p>
      <form onSubmit={confirm} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label htmlFor="tf-code">6-digit code from the app</label>
        <input id="tf-code" style={input} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
        <Button type="submit" margin={false} disabled={busy}>
          Confirm
        </Button>
      </form>
    </section>
  )
}
