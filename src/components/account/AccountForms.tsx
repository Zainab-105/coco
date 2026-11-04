'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition } from 'react'

import {
  addAddressAction,
  deleteAccountAction,
  removeAddressAction,
  requestCodeAction,
  saveProfileAction,
  setOffersAction,
  signOutAction,
  verifyCodeAction,
  type FormResult,
} from '@/app/(frontend)/account/actions'
import { useTurnstile } from '@/components/support/useTurnstile'
import { Button } from '@/components/ui/Button'
import { TextAreaField, TextField } from '@/components/ui/Field'

import { clearDeviceAccountData } from './AccountSync'

/** Email first, then the six-digit code. */
export function SignInForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const turnstile = useTurnstile()

  const request = () =>
    start(async () => {
      const result = await requestCodeAction(email, turnstile.token)
      turnstile.reset()
      setMessage({ ok: result.ok, text: result.message })
      if (result.ok) setSent(true)
    })

  const verify = () =>
    start(async () => {
      const result = await verifyCodeAction(email, code)
      if (result.ok) router.refresh()
      else setMessage({ ok: false, text: result.message ?? 'Please try again.' })
    })

  return (
    <form
      className="mt-6 space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (sent) verify()
        else request()
      }}
    >
      {!sent ? (
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      ) : (
        <TextField
          label="6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          autoFocus
        />
      )}
      {message && (
        <p role="status" className={message.ok ? 'text-sm' : 'text-sm text-danger'}>
          {message.text}
        </p>
      )}
      {turnstile.element}
      <Button type="submit" block disabled={pending}>
        {pending ? 'Please wait...' : sent ? 'Sign in' : 'Email me a code'}
      </Button>
      {sent && (
        <div className="flex justify-between text-sm">
          <button type="button" className="min-h-11 underline" onClick={() => (setSent(false), setCode(''), setMessage(null))}>
            Use another email
          </button>
          <button type="button" className="min-h-11 underline" disabled={pending} onClick={request}>
            Send a new code
          </button>
        </div>
      )}
    </form>
  )
}

export function SignOut() {
  const [pending, start] = useTransition()
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await signOutAction()
          clearDeviceAccountData()
        })
      }
    >
      Sign out
    </Button>
  )
}

export function AccountDetails({ name, phone }: { name: string; phone: string }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(saveProfileAction, {})
  const [deleting, startDelete] = useTransition()
  return (
    <section aria-labelledby="details-title">
      <h2 id="details-title" className="text-2xl text-burgundy-700">
        Your details
      </h2>
      <form action={action} className="mt-3 space-y-3">
        <TextField label="Full name" name="name" autoComplete="name" defaultValue={name} />
        <TextField label="Mobile number" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="03XX XXXXXXX" defaultValue={phone} error={state.error} />
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            Save
          </Button>
          {state.saved && <span role="status" className="text-sm text-success">Saved</span>}
        </div>
      </form>
      <button
        type="button"
        className="mt-4 min-h-11 text-xs text-muted underline"
        disabled={deleting}
        onClick={() => {
          if (!window.confirm('Delete your account? Saved addresses and your wishlist are removed. Your past orders stay with COCO for our records.')) return
          startDelete(async () => {
            await deleteAccountAction()
            clearDeviceAccountData()
          })
        }}
      >
        Delete my account
      </button>
    </section>
  )
}

export function AddressBook({ addresses }: { addresses: { id: string; label: string; city: string; address: string }[] }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(addAddressAction, {})
  const [removing, startRemove] = useTransition()
  return (
    <section aria-labelledby="addresses-title">
      <h2 id="addresses-title" className="text-2xl text-burgundy-700">
        Saved addresses
      </h2>
      {addresses.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 border border-blush-200 bg-white p-3">
              <span>
                {a.label && <span className="block font-medium">{a.label}</span>}
                <span className="whitespace-pre-line">{a.address}</span>
                <span className="block text-muted">{a.city}</span>
              </span>
              <button type="button" className="min-h-11 shrink-0 text-xs underline" disabled={removing} onClick={() => startRemove(() => removeAddressAction(a.id))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No saved addresses yet. Your first order address is saved automatically.</p>
      )}
      <form key={state.saved ? addresses.length : 'form'} action={action} className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Label (optional)" name="label" placeholder="Home" maxLength={30} />
          <TextField label="City" name="city" autoComplete="address-level2" required />
        </div>
        <TextAreaField label="Complete address" name="address" autoComplete="street-address" error={state.error} required />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Add address
        </Button>
      </form>
    </section>
  )
}

export function OffersToggle({ subscribed }: { subscribed: boolean }) {
  const [pending, start] = useTransition()
  return (
    <section aria-labelledby="offers-title">
      <h2 id="offers-title" className="text-2xl text-burgundy-700">
        Emails
      </h2>
      <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={subscribed}
          disabled={pending}
          onChange={(e) => {
            const enabled = e.target.checked
            start(() => setOffersAction(enabled))
          }}
          className="mt-0.5 size-4 accent-burgundy-700"
        />
        Send me new scents and offers by email. Order emails are not affected.
      </label>
    </section>
  )
}
