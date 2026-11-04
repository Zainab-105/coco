import type { Payload } from 'payload'

import type { Order, Product } from '@/payload-types'
import { effectivePrice } from '@/lib/pricing'

/**
 * ~40 demo orders spread over the last 90 days so the dashboard, CRM segments and reports have
 * realistic data to show. Customer names and numbers are fictitious (0300-00000xx range).
 * Runs only when the orders collection is empty.
 */
const customers = [
  ['Ayesha Khan', 'Lahore'],
  ['Hamza Ali', 'Karachi'],
  ['Fatima Noor', 'Islamabad'],
  ['Bilal Ahmed', 'Rawalpindi'],
  ['Zainab Hussain', 'Lahore'],
  ['Usman Tariq', 'Faisalabad'],
  ['Mariam Siddiqui', 'Karachi'],
  ['Ali Raza', 'Multan'],
  ['Hira Javed', 'Lahore'],
  ['Saad Malik', 'Peshawar'],
  ['Sana Iqbal', 'Islamabad'],
  ['Omar Farooq', 'Karachi'],
] as const

// Deterministic PRNG so every run seeds identical data.
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export async function seedDemoOrders(payload: Payload) {
  if ((await payload.count({ collection: 'orders' })).totalDocs > 0) {
    payload.logger.info('Orders already exist; skipping demo orders')
    return
  }

  const loadProducts = async () =>
    (
      await payload.find({
        collection: 'products',
        where: { status: { equals: 'published' } },
        depth: 0,
        limit: 50,
      })
    ).docs
  const random = rng(20261102)
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)]

  const line = (product: Product): NonNullable<Order['items']>[number] | null => {
    const unitPrice = effectivePrice(product.price, product.salePrice)
    if (product.productType === 'variable') {
      const inStock = (product.variants ?? []).filter((v) => (v.stock ?? 0) > 2)
      if (!inStock.length) return null
      const v = pick(inStock)
      return {
        product: product.id,
        variantId: v.id,
        title: product.title,
        variantLabel: v.label,
        sku: v.sku,
        unitPrice: effectivePrice(v.price ?? product.price, v.salePrice ?? product.salePrice),
        unitCost: v.costPrice ?? product.costPrice,
        quantity: random() < 0.25 ? 2 : 1,
      }
    }
    if ((product.stock ?? 0) < 3) return null
    return { product: product.id, title: product.title, sku: product.sku, unitPrice, unitCost: product.costPrice, quantity: 1 }
  }

  const total = 40
  for (let i = 0; i < total; i++) {
    // Older orders first; ~ one every 2 days, with some repeat customers.
    const daysAgo = Math.round(((total - i) / total) * 90 - random() * 2)
    const createdAt = new Date(Date.now() - daysAgo * 86_400_000 - Math.floor(random() * 10) * 3_600_000)
    const customerIndex = i < customers.length ? i : Math.floor(random() * customers.length)
    const [fullName, city] = customers[customerIndex]

    // Reload each time so lines respect the stock left after earlier demo orders.
    const products = await loadProducts()
    const items = Array.from({ length: random() < 0.3 ? 2 : 1 }, () => line(pick(products))).filter(
      (l): l is NonNullable<typeof l> => l !== null,
    )
    if (!items.length) continue

    const subtotal = items.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
    const status: Order['status'] =
      daysAgo > 14
        ? random() < 0.08
          ? 'cancelled'
          : random() < 0.05
            ? 'returned'
            : 'delivered'
        : pick(['new', 'confirmed', 'processing', 'shipped', 'delivered'] as const)
    const method = random() < 0.75 ? 'cod' : pick(['jazzcash', 'easypaisa'] as const)
    const paid = method !== 'cod' || status === 'delivered'

    await payload.create({
      collection: 'orders',
      depth: 0,
      data: {
        status,
        items,
        discount: i % 7 === 0 ? Math.min(500, Math.round(subtotal * 0.1)) : 0,
        shippingFee: subtotal >= 3000 ? 0 : 250,
        shippingAddress: {
          fullName,
          phone: `0300${String(customerIndex + 1).padStart(7, '0')}`,
          city,
          address: `House ${10 + customerIndex}, Street ${customerIndex + 3}, ${city}`,
        },
        payment: {
          method,
          status: status === 'cancelled' ? 'failed' : status === 'returned' ? 'refunded' : paid ? 'paid' : 'pending',
          paidAt: paid ? createdAt.toISOString() : undefined,
        },
        fulfilment: ['shipped', 'delivered'].includes(status)
          ? { courier: pick(['TCS', 'Leopards', 'PostEx'] as const), trackingNumber: `TRK${100000 + i}` }
          : undefined,
        refund: status === 'returned' ? { amount: subtotal, reason: 'Fragrance not as expected (demo data)' } : undefined,
        source: random() < 0.85 ? 'website' : 'whatsapp',
        createdAt: createdAt.toISOString(),
      } as never,
    })
  }
  payload.logger.info(`Seeded ${total} demo orders`)
}
