'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/Button'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { Honeypot } from '@/components/ui/Honeypot'
import { TICKET_TYPES } from '@/lib/support/validate'

import { FilePicker, postForm } from './FilePicker'
import { useTurnstile } from './useTurnstile'

/** Contact and complaints form. Creates a support ticket for the team. */
export function ContactForm({ initialOrder = '' }: { initialOrder?: string }) {
  const [fields, setFields] = useState({ type: 'enquiry', name: '', phone: '', email: '', orderNumber: initialOrder, message: '', company: '' })
  const [files, setFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [reference, setReference] = useState<number | null | undefined>()
  const [sending, startSending] = useTransition()
  const turnstile = useTurnstile()

  const set = (key: keyof typeof fields) => (e: { target: { value: string } }) => setFields((f) => ({ ...f, [key]: e.target.value }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    startSending(async () => {
      const result = await postForm('/api/storefront/contact', { ...fields, turnstile: turnstile.token }, files)
      if (result.ok) return setReference(result.reference ?? null)
      turnstile.reset()
      setErrors(result.errors ?? { form: 'Something went wrong. Please try again.' })
    })
  }

  if (reference !== undefined) {
    return (
      <p role="status" className="bg-nude-100/60 px-4 py-4 text-sm">
        Thank you! We received your message{reference ? ` (reference #${reference})` : ''} and will reply as soon as possible.
      </p>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <label className="block space-y-1.5">
        <span className="block text-xs tracking-[0.16em] text-muted uppercase">What is this about?</span>
        <select value={fields.type} onChange={set('type')} className="min-h-12 w-full border border-blush-200 bg-white px-4 text-base">
          {Object.entries(TICKET_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <TextField label="Your name" autoComplete="name" value={fields.name} onChange={set('name')} error={errors.name} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" placeholder="03XX XXXXXXX" value={fields.phone} onChange={set('phone')} error={errors.phone} />
        <TextField label="Email" type="email" autoComplete="email" value={fields.email} onChange={set('email')} error={errors.email} />
      </div>
      <TextField label="Order number (optional)" placeholder="COCO-261102-ABCD" value={fields.orderNumber} onChange={set('orderNumber')} />
      <TextAreaField label="Your message" value={fields.message} onChange={set('message')} error={errors.message} maxLength={4000} required />
      <FilePicker files={files} onChange={setFiles} error={errors.files} onError={(m) => setErrors((er) => ({ ...er, files: m }))} />

      <Honeypot value={fields.company} onChange={set('company')} />

      {errors.form && (
        <p role="alert" className="border-l-4 border-danger bg-danger/5 px-4 py-3 text-sm text-danger">
          {errors.form}
        </p>
      )}
      {turnstile.element}
      <Button type="submit" disabled={sending}>
        {sending ? 'Sending...' : 'Send message'}
      </Button>
    </form>
  )
}
