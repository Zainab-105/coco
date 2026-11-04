'use client'

import { Star } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'

import { isSignedIn } from '@/components/account/AccountSync'
import { FilePicker, postForm } from '@/components/support/FilePicker'
import { useTurnstile } from '@/components/support/useTurnstile'
import { Button } from '@/components/ui/Button'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { cn } from '@/lib/cn'

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']

/**
 * Moderated review form. Arriving from an order page (?order=...&t=...) proves the purchase; so
 * does being signed in. Others can add their order number and phone for the Verified badge.
 */
export function ReviewForm({ productId }: { productId: number }) {
  const [open, setOpen] = useState(false)
  const [orderLink, setOrderLink] = useState<{ order: string; token: string } | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [rating, setRating] = useState(0)
  const [fields, setFields] = useState({ authorName: '', title: '', body: '', orderNumber: '', phone: '', company: '' })
  const [files, setFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [done, setDone] = useState(false)
  const [sending, startSending] = useTransition()
  const turnstile = useTurnstile(open)

  // Read here rather than on the server so the product page stays cached.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const order = params.get('order')
    const token = params.get('t')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only values, unknown during server render
    setSignedIn(isSignedIn())
    if (order && token) setOrderLink({ order, token })
    if ((order && token) || window.location.hash === '#write-review') {
      setOpen(true)
      document.getElementById('write-review')?.scrollIntoView({ block: 'start' })
    }
  }, [])

  const set = (key: keyof typeof fields) => (e: { target: { value: string } }) => setFields((f) => ({ ...f, [key]: e.target.value }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    startSending(async () => {
      const result = await postForm(
        '/api/storefront/reviews',
        {
          ...fields,
          turnstile: turnstile.token,
          productId: String(productId),
          rating: String(rating),
          ...(orderLink ? { orderNumber: orderLink.order, orderToken: orderLink.token } : {}),
        },
        files,
      )
      if (result.ok) return setDone(true)
      turnstile.reset()
      setErrors(result.errors ?? { form: 'Something went wrong. Please try again.' })
    })
  }

  return (
    <div id="write-review" className="mt-8 scroll-mt-28 border-t border-blush-200 pt-6">
      {done ? (
        <p role="status" className="bg-nude-100/60 px-4 py-3 text-sm">
          Thank you! Your review will appear here once our team has checked it.
        </p>
      ) : !open ? (
        <Button variant="outline" onClick={() => setOpen(true)}>
          Write a review
        </Button>
      ) : (
        <form onSubmit={submit} noValidate className="max-w-xl space-y-4">
          <h3 className="text-2xl text-burgundy-700">Write a review</h3>

          <fieldset>
            <legend className="text-xs tracking-[0.16em] text-muted uppercase">Your rating</legend>
            <div className="mt-1 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="flex size-11 cursor-pointer items-center justify-center has-[:focus-visible]:outline-2">
                  <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" aria-label={`${n} star${n > 1 ? 's' : ''}: ${LABELS[n]}`} />
                  <Star size={26} strokeWidth={1.5} className={cn(n <= rating ? 'fill-gold-500 text-gold-500' : 'text-blush-200')} />
                </label>
              ))}
              {rating > 0 && <span className="ml-2 text-sm text-muted">{LABELS[rating]}</span>}
            </div>
            {errors.rating && <p className="mt-1 text-xs text-danger">{errors.rating}</p>}
          </fieldset>

          <TextField label="Your name" hint="Shown with your review." autoComplete="name" value={fields.authorName} onChange={set('authorName')} error={errors.authorName} maxLength={60} required />
          <TextField label="Title (optional)" value={fields.title} onChange={set('title')} maxLength={100} />
          <TextAreaField label="Your review" value={fields.body} onChange={set('body')} error={errors.body} maxLength={2000} required />
          <FilePicker files={files} onChange={setFiles} error={errors.files} onError={(m) => setErrors((er) => ({ ...er, files: m }))} />

          {orderLink ? (
            <p className="text-xs text-muted">Reviewing from order {orderLink.order}: your review gets a Verified purchase badge.</p>
          ) : signedIn ? (
            <p className="text-xs text-muted">If you bought this with your account, your review gets a Verified purchase badge.</p>
          ) : (
            <details className="border border-blush-200 bg-white px-4 py-3 text-sm" open={Boolean(errors.orderNumber || errors.phone)}>
              <summary className="cursor-pointer">Bought from us? Add your order for a Verified purchase badge</summary>
              <div className="mt-3 space-y-3">
                <TextField label="Order number" placeholder="COCO-261102-ABCD" value={fields.orderNumber} onChange={set('orderNumber')} error={errors.orderNumber} />
                <TextField label="Mobile number used for the order" type="tel" inputMode="tel" hint="Only used to check your order. Never shown." value={fields.phone} onChange={set('phone')} error={errors.phone} />
              </div>
            </details>
          )}

          {/* Honeypot for bots: hidden from people and screen readers. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
            <label>
              Company
              <input tabIndex={-1} autoComplete="off" value={fields.company} onChange={set('company')} />
            </label>
          </div>

          {(errors.form || (orderLink && errors.orderNumber)) && (
            <p role="alert" className="border-l-4 border-danger bg-danger/5 px-4 py-3 text-sm text-danger">
              {errors.form ?? errors.orderNumber}
            </p>
          )}
          {turnstile.element}
          <Button type="submit" disabled={sending}>
            {sending ? 'Sending...' : 'Submit review'}
          </Button>
          <p className="text-xs text-muted">Reviews and media are checked by our team before they appear.</p>
        </form>
      )}
    </div>
  )
}
