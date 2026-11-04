/**
 * Seeds the database. Safe to re-run: existing records (matched by slug/code/alt) are skipped.
 *
 *   npm run seed          categories, launch fragrances, Store Settings defaults
 *   npm run seed:sample   + sample catalogue (products, media, banners, coupons), demo orders,
 *                         expenses, subscribers, abandoned carts, a pending review and tickets
 */
import config from '@payload-config'
import { getPayload } from 'payload'

import { seedBase } from './base'
import { seedCatalogue } from './catalogue'
import { seedDemoMarketing, seedDemoSupport } from './demoMarketing'
import { seedDemoOrders } from './demoOrders'

const payload = await getPayload({ config })

const base = await seedBase(payload)
payload.logger.info('Seeded categories, fragrances and store settings')

if (process.env.SEED_SAMPLE === '1') {
  await seedCatalogue(payload, base)
  payload.logger.info('Seeded sample catalogue')
  await seedDemoOrders(payload)
  await seedDemoMarketing(payload)
  await seedDemoSupport(payload)
}

payload.logger.info('Seed complete')
process.exit(0)
