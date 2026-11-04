import type { Endpoint, PayloadRequest } from 'payload'

import { hasRole } from '@/access/roles'
import { normalizePkPhone } from '@/lib/phone'

/**
 * POST /api/customers/:id/merge  { phone }  (manager or owner)
 * Merges a duplicate profile (found by its phone number) into this one: moves its orders,
 * combines addresses, notes and marketing consent, then deletes the duplicate.
 */
export const mergeCustomer: Endpoint = {
  path: '/:id/merge',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!hasRole(req.user, ['owner', 'manager'])) return Response.json({ error: 'Forbidden' }, { status: 403 })
    const targetId = Number(req.routeParams?.id)
    const body = (await req.json?.()) as { phone?: string } | undefined
    const phone = normalizePkPhone(body?.phone ?? '')
    if (!targetId || !phone) return Response.json({ error: 'Enter the phone number of the duplicate profile.' }, { status: 400 })

    const target = await req.payload.findByID({ collection: 'customers', id: targetId, depth: 0, req }).catch(() => null)
    const { docs } = await req.payload.find({ collection: 'customers', where: { phone: { equals: phone } }, limit: 1, depth: 0, req })
    const source = docs[0]
    if (!target) return Response.json({ error: 'Customer not found.' }, { status: 404 })
    if (!source) return Response.json({ error: `No customer with phone ${phone}.` }, { status: 404 })
    if (source.id === target.id) return Response.json({ error: 'That is this same customer.' }, { status: 400 })

    const moved = await req.payload.update({
      collection: 'orders',
      where: { customer: { equals: source.id } },
      data: { customer: target.id },
      req,
    })

    const seen = new Set((target.addresses ?? []).map((a) => `${a.city}|${a.address}`.toLowerCase()))
    const extraAddresses = (source.addresses ?? [])
      .filter((a) => !seen.has(`${a.city}|${a.address}`.toLowerCase()))
      .map(({ label, city, address }) => ({ label, city, address }))

    await req.payload.delete({ collection: 'customers', id: source.id, req })
    const merged = await req.payload.update({
      collection: 'customers',
      id: target.id,
      data: {
        email: target.email ?? source.email,
        addresses: [...(target.addresses ?? []), ...extraAddresses],
        notes: [target.notes, source.notes && `Merged from ${source.phone}: ${source.notes}`].filter(Boolean).join('\n\n') || undefined,
        marketing: {
          emailConsent: Boolean(target.marketing?.emailConsent || source.marketing?.emailConsent),
          whatsappConsent: Boolean(target.marketing?.whatsappConsent || source.marketing?.whatsappConsent),
          consentUpdatedAt: new Date().toISOString(),
        },
      },
      req,
    })

    await req.payload.create({
      collection: 'activity-logs',
      data: {
        user: req.user!.id,
        action: 'update',
        targetCollection: 'customers',
        targetId: String(target.id),
        summary: `Merged duplicate ${source.name} (${source.phone}), ${moved.docs.length} orders moved`,
      },
      req,
    })

    return Response.json({ ok: true, ordersMoved: moved.docs.length, customer: { id: merged.id, orderCount: merged.orderCount } })
  },
}
