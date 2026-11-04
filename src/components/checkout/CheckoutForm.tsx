'use client'

import { ChevronDown, Gift, Lock, ShoppingBag, Tag } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'

import { getCheckoutPrefillAction, type CheckoutPrefill } from '@/app/(frontend)/account/actions'
import { getQuoteAction, placeOrderAction, saveCheckoutDraftAction } from '@/app/(frontend)/checkout/actions'
import { isSignedIn } from '@/components/account/AccountSync'
import { useTurnstile } from '@/components/support/useTurnstile'
import { WhatsAppIcon } from '@/components/ui/BrandIcons'
import { Button, ButtonLink } from '@/components/ui/Button'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { trackEvent } from '@/lib/analytics'
import { PK_CITIES } from '@/lib/checkout/cities'
import type { Quote } from '@/lib/checkout/quote'
import type { CheckoutErrors } from '@/lib/checkout/validate'
import { cn } from '@/lib/cn'
import { formatPKR, whatsappLink } from '@/lib/format'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/orderStatus'
import { normalizePkPhone } from '@/lib/phone'
import { cart, useCart } from '@/lib/stores/cart'
import { checkoutSession } from '@/lib/stores/checkoutSession'

const PAYMENT_HINTS: Record<PaymentMethod, string> = {
  cod: 'Pay in cash when your order arrives.',
  jazzcash: 'Pay securely on the JazzCash page.',
  easypaisa: 'Pay securely on the Easypaisa page.',
  bank_transfer: 'Transfer to our account; we confirm your order once the payment is verified.',
}

type Fields = {
  fullName: string
  phone: string
  email: string
  city: string
  address: string
  landmark: string
  giftNote: string
  website: string
}

export function CheckoutForm({
  giftWrap,
  deliveryEstimate,
  whatsappNumber,
}: {
  giftWrap: { enabled: boolean; price: number }
  deliveryEstimate: string
  whatsappNumber?: string
}) {
  const router = useRouter()
  const lines = useCart()
  const [fields, setFields] = useState<Fields>({ fullName: '', phone: '', email: '', city: '', address: '', landmark: '', giftNote: '', website: '' })
  const [wrap, setWrap] = useState(false)
  const [consent, setConsent] = useState(false)
  const [payment, setPayment] = useState<PaymentMethod>('cod')
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<string | undefined>()
  const [couponMessage, setCouponMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [errors, setErrors] = useState<CheckoutErrors>({})
  const [city, setCity] = useState('')
  const [placing, startPlacing] = useTransition()
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [saved, setSaved] = useState<CheckoutPrefill | null>(null)
  const turnstile = useTurnstile()

  // Once per visit, when prices are known.
  const reportedBegin = useRef(false)
  useEffect(() => {
    if (!quote || reportedBegin.current) return
    reportedBegin.current = true
    trackEvent('begin_checkout', {
      value: quote.total,
      items: quote.lines.map((l) => ({ item_id: String(l.productId), item_name: l.title, item_variant: l.variantLabel ?? undefined, price: l.unitPrice, quantity: l.quantity })),
    })
  }, [quote])

  // Signed-in customers start with their details; anything already typed is kept.
  useEffect(() => {
    if (!isSignedIn()) return
    getCheckoutPrefillAction()
      .then((p) => {
        if (!p) return
        setSaved(p)
        const first = p.addresses[0]
        setFields((f) => ({
          ...f,
          fullName: f.fullName || p.name,
          phone: f.phone || p.phone,
          email: f.email || p.email,
          city: f.city || (first?.city ?? ''),
          address: f.address || (first?.address ?? ''),
        }))
      })
      .catch(() => undefined)
  }, [])

  const quoteLines = useMemo(
    () => lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, expectedUnitPrice: l.unitPrice })),
    [lines],
  )
  const linesKey = JSON.stringify(quoteLines)

  // Debounce city so typing does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setCity(fields.city), 400)
    return () => clearTimeout(t)
  }, [fields.city])

  useEffect(() => {
    if (!quoteLines.length) return
    let cancelled = false
    getQuoteAction({ lines: quoteLines, couponCode: coupon, city, giftWrap: wrap, phone: fields.phone || undefined })
      .then((q) => {
        if (cancelled) return
        setQuote(q)
        if (coupon && q.coupon && !q.coupon.applied) {
          setCoupon(undefined)
          setCouponMessage({ ok: false, text: q.coupon.message })
        }
        // Keep the device cart in line with server prices and stock.
        const changed = q.lines.length !== lines.length || q.lines.some((ql) => lines.find((l) => l.key === ql.key)?.unitPrice !== ql.unitPrice || lines.find((l) => l.key === ql.key)?.quantity !== ql.quantity)
        if (changed) cart.syncFromQuote(q.lines)
      })
      .catch(() => !cancelled && setErrors((e) => ({ ...e, form: 'Could not load prices. Check your connection.' })))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- linesKey captures the cart contents
  }, [linesKey, coupon, city, wrap])

  // Save the checkout in progress once there is a way to reach the visitor (abandoned-cart capture).
  const reachable = Boolean(normalizePkPhone(fields.phone)) || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email.trim())
  useEffect(() => {
    if (!reachable || !quoteLines.length) return
    const t = setTimeout(() => {
      void saveCheckoutDraftAction({
        token: checkoutSession.token(),
        form: { fullName: fields.fullName, phone: fields.phone, email: fields.email, city: fields.city, marketingConsent: consent },
        lines: quoteLines,
      }).catch(() => undefined)
    }, 2000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- linesKey captures the cart contents
  }, [reachable, fields.fullName, fields.phone, fields.email, fields.city, consent, linesKey])

  // If the chosen method becomes unavailable (e.g. COD limit), fall back to the first available one.
  const chosen = quote?.payments.find((p) => p.method === payment)
  const paymentMethod: PaymentMethod =
    chosen && !chosen.available ? (quote?.payments.find((p) => p.available)?.method ?? payment) : payment

  const set = (key: keyof Fields) => (e: { target: { value: string } }) => {
    setFields((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }))
  }

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase()
    if (!code) return
    const q = await getQuoteAction({ lines: quoteLines, couponCode: code, city, giftWrap: wrap, phone: fields.phone || undefined })
    setQuote(q)
    if (q.coupon?.applied) {
      setCoupon(code)
      setCouponMessage({ ok: true, text: q.coupon.message })
    } else {
      setCoupon(undefined)
      setCouponMessage({ ok: false, text: q.coupon?.message ?? 'This code is not valid.' })
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    startPlacing(async () => {
      const result = await placeOrderAction({
        form: { ...fields, paymentMethod, giftWrap: wrap, couponCode: coupon, marketingConsent: consent },
        lines: quoteLines,
        cartToken: checkoutSession.token(),
        turnstile: turnstile.token,
      })
      if (result.ok) {
        cart.clear()
        checkoutSession.reset()
        router.push(result.redirectTo)
        return
      }
      // Tokens work once, so a retry needs a fresh one.
      turnstile.reset()
      setErrors(result.errors)
      if (result.quote) {
        setQuote(result.quote)
        cart.syncFromQuote(result.quote.lines)
      }
      const firstField = Object.keys(result.errors).find((k) => k !== 'form' && k !== 'cart')
      document.getElementById(firstField ? `checkout-${firstField}` : 'checkout-errors')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  if (!lines.length) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <ShoppingBag size={40} strokeWidth={1} className="text-rose-400" />
        <p className="font-display text-3xl text-burgundy-700">Your cart is empty</p>
        <ButtonLink href="/collections" variant="outline">
          Continue shopping
        </ButtonLink>
      </div>
    )
  }

  const total = quote?.total ?? lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)

  const summary = (
    <OrderSummary
      quote={quote}
      lines={lines}
      couponInput={couponInput}
      setCouponInput={setCouponInput}
      couponMessage={couponMessage}
      appliedCoupon={coupon}
      onApply={applyCoupon}
      onRemoveCoupon={() => (setCoupon(undefined), setCouponMessage(null), setCouponInput(''))}
    />
  )

  return (
    <form onSubmit={submit} noValidate className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_400px] lg:items-start">
      <div className="space-y-10">
        {/* Mobile: collapsible summary first so the total is never a surprise. */}
        <div className="border border-blush-200 bg-white lg:hidden">
          <button type="button" onClick={() => setSummaryOpen((o) => !o)} aria-expanded={summaryOpen} className="flex min-h-14 w-full items-center justify-between px-4 text-sm">
            <span className="flex items-center gap-2">
              <ShoppingBag size={16} /> {summaryOpen ? 'Hide' : 'Show'} order summary
              <ChevronDown size={14} className={cn('transition-transform', summaryOpen && 'rotate-180')} />
            </span>
            <span className="font-medium">{formatPKR(total)}</span>
          </button>
          {summaryOpen && <div className="border-t border-blush-200 p-4">{summary}</div>}
        </div>

        <div id="checkout-errors" aria-live="assertive">
          {(errors.form || errors.cart) && <p className="border-l-4 border-danger bg-danger/5 px-4 py-3 text-sm text-danger">{errors.form ?? errors.cart}</p>}
          {quote?.issues.map((i) => (
            <p key={i.key + i.type} className="mt-2 border-l-4 border-gold-500 bg-nude-100 px-4 py-3 text-sm">
              {i.message}
            </p>
          ))}
        </div>

        <Section step={1} title="Contact">
          <TextField id="checkout-fullName" label="Full name" autoComplete="name" value={fields.fullName} onChange={set('fullName')} error={errors.fullName} required />
          <TextField
            id="checkout-phone"
            label="Mobile number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="03XX XXXXXXX"
            value={fields.phone}
            onChange={set('phone')}
            error={errors.phone}
            hint="For delivery updates and order confirmation. We keep your details so we can help if checkout doesn't go through."
            required
          />
          <TextField
            id="checkout-email"
            label="Email (optional)"
            type="email"
            autoComplete="email"
            value={fields.email}
            onChange={set('email')}
            error={errors.email}
            hint="We'll send your order confirmation here."
          />
        </Section>

        <Section step={2} title="Delivery address">
          {saved && saved.addresses.length > 1 && (
            <label className="block space-y-1.5">
              <span className="block text-xs tracking-[0.16em] text-muted uppercase">Saved addresses</span>
              <select
                className="min-h-12 w-full border border-blush-200 bg-white px-4 text-base"
                value={saved.addresses.find((a) => a.address === fields.address)?.id ?? ''}
                onChange={(e) => {
                  const a = saved.addresses.find((x) => x.id === e.target.value)
                  if (a) setFields((f) => ({ ...f, city: a.city, address: a.address }))
                }}
              >
                <option value="">Choose a saved address</option>
                {saved.addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label ? `${a.label}: ` : ''}
                    {a.address.slice(0, 40)}, {a.city}
                  </option>
                ))}
              </select>
            </label>
          )}
          <TextField
            id="checkout-city"
            label="City"
            autoComplete="address-level2"
            list="pk-cities"
            value={fields.city}
            onChange={set('city')}
            error={errors.city}
            required
          />
          <datalist id="pk-cities">
            {PK_CITIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <TextAreaField
            id="checkout-address"
            label="Complete address"
            autoComplete="street-address"
            placeholder="House no., street, block, area"
            value={fields.address}
            onChange={set('address')}
            error={errors.address}
            required
          />
          <TextField id="checkout-landmark" label="Nearest landmark (optional)" value={fields.landmark} onChange={set('landmark')} />
          <p className="text-xs text-muted">Delivery in {deliveryEstimate}.</p>
        </Section>

        {giftWrap.enabled && (
          <Section step={3} title="Gift options">
            <label className="flex cursor-pointer items-start gap-3 border border-blush-200 bg-white p-4">
              <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} className="mt-1 size-4 accent-burgundy-700" />
              <span className="flex-1 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <Gift size={16} className="text-burgundy-700" /> Gift wrap this order (+{formatPKR(giftWrap.price)})
                </span>
                <span className="text-muted">COCO wrapping paper and a handwritten note. Prices are not included in the parcel.</span>
              </span>
            </label>
            {wrap && <TextAreaField id="checkout-giftNote" label="Gift note (optional)" maxLength={300} value={fields.giftNote} onChange={set('giftNote')} />}
          </Section>
        )}

        <Section step={giftWrap.enabled ? 4 : 3} title="Payment">
          <fieldset id="checkout-paymentMethod" className="space-y-2">
            <legend className="sr-only">Payment method</legend>
            {(quote?.payments ?? [{ method: 'cod' as const, available: true }]).map((p) => (
              <label
                key={p.method}
                className={cn(
                  'flex items-start gap-3 border bg-white p-4',
                  p.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
                  paymentMethod === p.method ? 'border-burgundy-700' : 'border-blush-200',
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={p.method}
                  checked={paymentMethod === p.method}
                  disabled={!p.available}
                  onChange={() => setPayment(p.method)}
                  className="mt-1 size-4 accent-burgundy-700"
                />
                <span className="text-sm">
                  <span className="font-medium">{PAYMENT_METHOD_LABELS[p.method]}</span>
                  <span className="block text-muted">{p.available ? PAYMENT_HINTS[p.method] : p.reason}</span>
                </span>
              </label>
            ))}
            {errors.paymentMethod && <p className="text-xs text-danger">{errors.paymentMethod}</p>}
          </fieldset>
        </Section>

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-burgundy-700" />
          Send me new scents and offers by email or WhatsApp. You can unsubscribe at any time.
        </label>

        {/* Honeypot for bots: hidden from people and screen readers. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={fields.website} onChange={set('website')} />
          </label>
        </div>

        <div className="space-y-3">
          {turnstile.element}
          <Button type="submit" block size="lg" disabled={placing || !quote}>
            <Lock size={16} /> {placing ? 'Placing order...' : `Place order  |  ${formatPKR(total)}`}
          </Button>
          <p className="text-center text-xs text-muted">
            By placing your order you agree to our{' '}
            <Link href="/pages/terms" className="underline">
              terms
            </Link>{' '}
            and{' '}
            <Link href="/pages/returns" className="underline">
              returns policy
            </Link>
            .
          </p>
          {whatsappNumber && (
            <a
              href={whatsappLink(whatsappNumber, 'Hi COCO, I need help placing an order.')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-[#1f8f4e]"
            >
              <WhatsAppIcon size={16} /> Need help? Order on WhatsApp
            </a>
          )}
        </div>
      </div>

      <aside className="hidden lg:sticky lg:top-28 lg:block" aria-label="Order summary">
        <div className="border border-blush-200 bg-white p-6">
          <h2 className="mb-4 text-2xl text-burgundy-700">Order summary</h2>
          {summary}
        </div>
      </aside>
    </form>
  )
}

function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-3 text-2xl text-burgundy-700">
        <span className="flex size-7 items-center justify-center rounded-full bg-burgundy-700 font-sans text-xs text-cream-50">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function OrderSummary({
  quote,
  lines,
  couponInput,
  setCouponInput,
  couponMessage,
  appliedCoupon,
  onApply,
  onRemoveCoupon,
}: {
  quote: Quote | null
  lines: ReturnType<typeof useCart>
  couponInput: string
  setCouponInput: (v: string) => void
  couponMessage: { ok: boolean; text: string } | null
  appliedCoupon?: string
  onApply: () => void
  onRemoveCoupon: () => void
}) {
  const [applying, startApplying] = useTransition()
  const rows = quote?.lines ?? lines.map((l) => ({ ...l, lineTotal: l.unitPrice * l.quantity }))

  return (
    <div className="space-y-4 text-sm">
      <ul className="space-y-3">
        {rows.map((l) => (
          <li key={l.key} className="flex gap-3">
            <span className="relative aspect-[4/5] w-14 shrink-0 bg-nude-100">
              {l.image && <Image src={l.image} alt="" fill sizes="56px" className="object-cover" />}
              <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-burgundy-700 text-[10px] text-cream-50">{l.quantity}</span>
            </span>
            <span className="flex-1">
              <span className="block font-display text-base leading-tight">{l.title}</span>
              {l.variantLabel && <span className="text-xs text-muted">{l.variantLabel.replace('Fragrance: ', '')}</span>}
            </span>
            <span>{formatPKR(l.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <div className="border-t border-blush-200 pt-4">
        {appliedCoupon ? (
          <p className="flex items-center justify-between text-success">
            <span className="flex items-center gap-2">
              <Tag size={14} /> {appliedCoupon}
            </span>
            <button type="button" onClick={onRemoveCoupon} className="text-xs text-muted underline">
              Remove
            </button>
          </p>
        ) : (
          <div className="flex gap-2">
            <input
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), startApplying(onApply))}
              placeholder="Discount code"
              aria-label="Discount code"
              className="min-h-11 min-w-0 flex-1 border border-blush-200 px-3 uppercase placeholder:normal-case focus:border-burgundy-700 focus:outline-none"
            />
            <Button variant="outline" size="sm" disabled={!couponInput.trim() || applying} onClick={() => startApplying(onApply)}>
              Apply
            </Button>
          </div>
        )}
        {couponMessage && <p className={cn('mt-2 text-xs', couponMessage.ok ? 'text-success' : 'text-danger')}>{couponMessage.text}</p>}
      </div>

      <dl className="space-y-1.5 border-t border-blush-200 pt-4">
        <Row label="Subtotal" value={quote ? formatPKR(quote.subtotal) : '...'} />
        {quote && quote.discount > 0 && <Row label="Discount" value={`-${formatPKR(quote.discount)}`} accent />}
        <Row label="Delivery" value={quote ? (quote.shipping === 0 ? 'Free' : formatPKR(quote.shipping)) : '...'} />
        {quote && quote.giftWrapFee > 0 && <Row label="Gift wrap" value={formatPKR(quote.giftWrapFee)} />}
        <div className="flex justify-between border-t border-blush-200 pt-3 text-base font-medium">
          <dt>Total</dt>
          <dd>{quote ? formatPKR(quote.total) : '...'}</dd>
        </div>
      </dl>
      {quote && quote.freeShippingRemaining > 0 && quote.shipping > 0 && (
        <p className="text-xs text-muted">Add {formatPKR(quote.freeShippingRemaining)} more for free delivery.</p>
      )}
    </div>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn('flex justify-between', accent && 'text-success')}>
      <dt className={accent ? undefined : 'text-muted'}>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
