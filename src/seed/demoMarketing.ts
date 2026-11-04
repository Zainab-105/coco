import type { Payload } from 'payload'

/**
 * Demo expenses, subscribers and abandoned carts for the last 90 days so the Finance and
 * Marketing reports have something to show. Runs only when there are no expenses yet.
 * Names, numbers and emails are fictitious.
 */
const day = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()

export async function seedDemoMarketing(payload: Payload) {
  if ((await payload.count({ collection: 'expenses' })).totalDocs > 0) {
    payload.logger.info('Expenses already exist; skipping demo marketing data')
    return
  }

  const expenses = [
    ['Instagram ads (demo)', 'advertising', 6000],
    ['Packaging boxes (demo)', 'packaging', 4500],
    ['TCS courier invoice (demo)', 'courier', 3800],
    ['Hosting (demo)', 'hosting', 2500],
  ] as const
  for (const month of [0, 30, 60]) {
    for (const [title, category, amount] of expenses) {
      await payload.create({ collection: 'expenses', data: { title, category, amount, date: day(month + 5) } })
    }
  }

  for (let i = 1; i <= 18; i++) {
    await payload.create({
      collection: 'subscribers',
      data: {
        email: `subscriber${i}@example.com`,
        status: i % 9 === 0 ? 'unsubscribed' : 'subscribed',
        source: i % 3 === 0 ? 'checkout' : 'footer',
        createdAt: day(i * 5),
        consentAt: day(i * 5),
      } as never,
    })
  }

  const products = (await payload.find({ collection: 'products', where: { status: { equals: 'published' } }, depth: 0, limit: 6 })).docs
  for (const [i, product] of products.entries()) {
    const unitPrice = product.salePrice ?? product.price ?? 0
    const at = day(i * 6 + 1)
    await payload.create({
      collection: 'carts',
      overrideAccess: true,
      data: {
        token: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
        name: ['Nadia Shah', 'Kamran Butt', 'Rabia Aslam', 'Imran Qureshi', 'Amna Riaz', 'Tariq Mehmood'][i],
        phone: `+92300990${String(i + 1).padStart(4, '0')}`,
        city: ['Lahore', 'Karachi', 'Islamabad', 'Multan', 'Lahore', 'Sialkot'][i],
        items: [{ product: product.id, title: product.title, quantity: 1, unitPrice }],
        subtotal: unitPrice,
        status: i === 0 ? 'contacted' : 'open',
        marketingConsent: i % 2 === 0,
        lastActivityAt: at,
        createdAt: at,
      } as never,
    })
  }
  payload.logger.info('Seeded demo expenses, subscribers and abandoned carts')
}

/** A pending review and a few tickets so the moderation and support queues have something to show. */
export async function seedDemoSupport(payload: Payload) {
  if ((await payload.count({ collection: 'support-tickets' })).totalDocs > 0) return

  const [product] = (await payload.find({ collection: 'products', where: { status: { equals: 'published' } }, depth: 0, limit: 1 })).docs
  if (product) {
    await payload.create({
      collection: 'reviews',
      data: { product: product.id, authorName: 'Rabia A. (demo)', rating: 4, title: 'Nice but strong', body: 'Lovely bottle. The scent is strong for the first few days, then settles.', status: 'pending' },
    })
  }
  const tickets = [
    ['complaint', 'high', 'open', 'Complaint: Bottle cracked in the parcel', 'Nadia Shah', '+923009900001', 'The diffuser bottle arrived cracked. Please advise (demo).'],
    ['return', 'normal', 'in_progress', 'Return or exchange: Different fragrance', 'Kamran Butt', '+923009900002', 'Can I exchange Cool Ice for Forest Pine? Unopened (demo).'],
    ['enquiry', 'normal', 'resolved', 'Question: Delivery to Skardu', 'Amna Riaz', '+923009900003', 'Do you deliver to Skardu, and how long does it take? (demo)'],
  ] as const
  for (const [type, priority, status, subject, name, phone, message] of tickets) {
    await payload.create({ collection: 'support-tickets', data: { type, priority, status, subject, name, phone, message } })
  }
  payload.logger.info('Seeded demo review and support tickets')
}
