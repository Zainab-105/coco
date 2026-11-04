/** Creates a local development owner account. Never run against staging or production. */
import config from '@payload-config'
import { getPayload } from 'payload'

const email = process.env.DEV_OWNER_EMAIL ?? 'owner@coco.local'
const password = process.env.DEV_OWNER_PASSWORD
if (!password) throw new Error('Set DEV_OWNER_PASSWORD')

const payload = await getPayload({ config })
const existing = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1 })
if (existing.docs[0]) {
  await payload.update({ collection: 'users', id: existing.docs[0].id, data: { password } })
} else {
  await payload.create({ collection: 'users', data: { email, password, name: 'Dev Owner', roles: ['owner'] } })
}
payload.logger.info(`Dev owner ready: ${email}`)
process.exit(0)
