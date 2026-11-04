// @vitest-environment node
import type { Payload, PayloadRequest } from 'payload'
import { createLocalReq, getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Product, User } from '@/payload-types'
import { resetPasswordWithoutLogin, twoFactorDisable, twoFactorEnable, twoFactorReset, twoFactorSetup } from '@/endpoints/twoFactor'
import { totpCode, totpCounter } from '@/lib/security/totp'
import { TWO_FACTOR_REQUIRED } from '@/lib/security/twoFactorMessages'

import { assertTestDatabase } from '../helpers/testDb'

/** Admin two-factor, password reset, what the public API can read, and automatic redirects. */
let payload: Payload
let owner: User
let staff: User

const PASSWORD = 'Passw0rd!x'
const DOMAIN = '@security.test'

async function call(endpoint: { handler: (req: PayloadRequest) => Promise<Response> | Response }, user: User | null, init: { body?: unknown; routeParams?: Record<string, unknown> } = {}) {
  const req = await createLocalReq({ user: user ?? undefined }, payload)
  if (!user) req.user = null
  req.routeParams = init.routeParams
  req.json = async () => init.body ?? {}
  return endpoint.handler(req)
}

/** What the REST login endpoint does: the fields arrive on req.data. */
async function login(email: string, password: string, totp?: string) {
  const req = await createLocalReq({}, payload)
  req.data = { email, password, ...(totp ? { totp } : {}) }
  return payload.login({ collection: 'users', data: { email, password }, req })
}

async function enrol(user: User) {
  const setup = await call(twoFactorSetup, user)
  const { secret } = await setup.json()
  const res = await call(twoFactorEnable, user, { body: { code: totpCode(secret, totpCounter()) } })
  const { recoveryCodes } = await res.json()
  return { secret: secret as string, recoveryCodes: recoveryCodes as string[] }
}

const stored = (id: number) => payload.findByID({ collection: 'users', id, depth: 0, showHiddenFields: true })

/** Each test user may log in with a step only once, so tests move time forward with a later step. */
const nextCode = (secret: string, steps = 1) => totpCode(secret, totpCounter() + steps)

describe('security', () => {
  beforeAll(async () => {
    assertTestDatabase()
    payload = await getPayload({ config: await config })
    await payload.delete({ collection: 'users', where: { email: { like: DOMAIN } } })
    owner = await payload.create({ collection: 'users', data: { email: `owner${DOMAIN}`, password: PASSWORD, roles: ['owner'] } })
    staff = await payload.create({ collection: 'users', data: { email: `staff${DOMAIN}`, password: PASSWORD, roles: ['staff'] } })
  })

  afterAll(async () => {
    await payload.delete({ collection: 'users', where: { email: { like: DOMAIN } } })
    await payload.delete({ collection: 'redirects', where: { from: { like: '/sectest' } } })
  })

  describe('two-factor', () => {
    it('stays off until confirmed with a correct code', async () => {
      const user = await payload.create({ collection: 'users', data: { email: `pending${DOMAIN}`, password: PASSWORD, roles: ['staff'] } })
      const setup = await call(twoFactorSetup, user)
      expect(setup.status).toBe(200)
      const { secret, qr, url } = await setup.json()
      expect(qr).toContain('<svg')
      expect(url).toContain(secret)
      expect((await stored(user.id)).twoFactor?.pendingSecret).not.toContain(secret)

      // Not active yet: password alone still works.
      expect((await login(user.email, PASSWORD)).token).toBeTruthy()

      expect((await call(twoFactorEnable, user, { body: { code: '000000' } })).status).toBe(400)
      expect((await stored(user.id)).twoFactor?.enabled).toBeFalsy()
      expect((await call(twoFactorSetup, null)).status).toBe(401)
    })

    it('requires the code at login, with no session before it is given', async () => {
      const user = await payload.create({ collection: 'users', data: { email: `login${DOMAIN}`, password: PASSWORD, roles: ['manager'] } })
      const { secret, recoveryCodes } = await enrol(user)
      expect(recoveryCodes).toHaveLength(8)

      await expect(login(user.email, PASSWORD)).rejects.toThrow(TWO_FACTOR_REQUIRED)
      await expect(login(user.email, PASSWORD, '000000')).rejects.toThrow(/not correct/)
      await expect(login(user.email, 'wrong-password', nextCode(secret))).rejects.toThrow()

      const ok = await login(user.email, PASSWORD, nextCode(secret))
      expect(ok.token).toBeTruthy()

      // A local or GraphQL login, which carries no code, fails closed.
      await expect(payload.login({ collection: 'users', data: { email: user.email, password: PASSWORD } })).rejects.toThrow(TWO_FACTOR_REQUIRED)
    })

    it('never accepts the same code twice', async () => {
      const user = await payload.create({ collection: 'users', data: { email: `replay${DOMAIN}`, password: PASSWORD, roles: ['staff'] } })
      const { secret } = await enrol(user)
      const code = nextCode(secret)
      expect((await login(user.email, PASSWORD, code)).token).toBeTruthy()
      await expect(login(user.email, PASSWORD, code)).rejects.toThrow(/not correct/)
    })

    it('accepts each recovery code once', async () => {
      const user = await payload.create({ collection: 'users', data: { email: `recovery${DOMAIN}`, password: PASSWORD, roles: ['staff'] } })
      const { recoveryCodes } = await enrol(user)
      expect((await login(user.email, PASSWORD, recoveryCodes[0])).token).toBeTruthy()
      await expect(login(user.email, PASSWORD, recoveryCodes[0])).rejects.toThrow(/not correct/)
      expect(((await stored(user.id)).twoFactor?.recoveryCodes as string[]).length).toBe(7)
    })

    it('stores secrets encrypted and never returns them through the API', async () => {
      const user = await payload.create({ collection: 'users', data: { email: `secret${DOMAIN}`, password: PASSWORD, roles: ['staff'] } })
      const { secret, recoveryCodes } = await enrol(user)
      const raw = await stored(user.id)
      expect(raw.twoFactor?.secret).toBeTruthy()
      expect(JSON.stringify(raw)).not.toContain(secret)
      expect(JSON.stringify(raw)).not.toContain(recoveryCodes[0])

      const visible = await payload.findByID({ collection: 'users', id: user.id, overrideAccess: false, user: owner, depth: 0 })
      expect(visible.twoFactor?.enabled).toBe(true)
      expect(visible.twoFactor).not.toHaveProperty('secret')
      expect(visible.twoFactor).not.toHaveProperty('recoveryCodes')
      expect(visible.twoFactor).not.toHaveProperty('lastCounter')
    })

    it('cannot be switched off or overwritten by editing the user', async () => {
      const user = await payload.create({ collection: 'users', data: { email: `edit${DOMAIN}`, password: PASSWORD, roles: ['staff'] } })
      await enrol(user)
      const before = (await stored(user.id)).twoFactor?.secret
      await payload.update({
        collection: 'users',
        id: user.id,
        overrideAccess: false,
        user,
        data: { twoFactor: { enabled: false, secret: 'attacker', recoveryCodes: [] } },
      })
      const after = await stored(user.id)
      expect(after.twoFactor?.enabled).toBe(true)
      expect(after.twoFactor?.secret).toBe(before)
    })

    it('needs a valid code to turn off, and lets only the owner reset someone else', async () => {
      const user = await payload.create({ collection: 'users', data: { email: `off${DOMAIN}`, password: PASSWORD, roles: ['staff'] } })
      const { secret } = await enrol(user)
      expect((await call(twoFactorDisable, user, { body: { code: '000000' } })).status).toBe(400)
      expect((await call(twoFactorDisable, user, { body: { code: nextCode(secret) } })).status).toBe(200)
      expect((await stored(user.id)).twoFactor).toMatchObject({ enabled: false, secret: null })
      expect((await login(user.email, PASSWORD)).token).toBeTruthy()

      await enrol(user)
      expect((await call(twoFactorReset, staff, { routeParams: { id: user.id } })).status).toBe(403)
      expect((await stored(user.id)).twoFactor?.enabled).toBe(true)
      expect((await call(twoFactorReset, owner, { routeParams: { id: user.id } })).status).toBe(200)
      expect((await stored(user.id)).twoFactor?.enabled).toBe(false)

      const logs = await payload.find({ collection: 'activity-logs', where: { targetId: { equals: String(user.id) } } })
      expect(logs.docs.map((l) => l.summary)).toContain('Reset two-factor authentication for this user')
    })

    it('password reset works for a two-factor user but gives no session', async () => {
      const user = await payload.create({ collection: 'users', data: { email: `reset${DOMAIN}`, password: PASSWORD, roles: ['staff'] } })
      const { secret } = await enrol(user)
      const token = await payload.forgotPassword({ collection: 'users', data: { email: user.email }, disableEmail: true })

      const res = await call(resetPasswordWithoutLogin, null, { body: { token, password: 'N3w-Passw0rd!' } })
      expect(res.status).toBe(200)
      expect(res.headers.get('set-cookie')).toBeNull()
      expect(JSON.stringify(await res.json())).not.toMatch(/token/i)

      // The new password works, and still needs the code.
      await expect(login(user.email, 'N3w-Passw0rd!')).rejects.toThrow(TWO_FACTOR_REQUIRED)
      expect((await login(user.email, 'N3w-Passw0rd!', nextCode(secret))).token).toBeTruthy()
      await expect(login(user.email, PASSWORD, nextCode(secret, 2))).rejects.toThrow()
    })

    it('replaces the auto-login reset route', () => {
      const route = payload.collections.users.config.endpoints
      expect(route && route.find((e) => e.path === '/reset-password' && e.method === 'post')?.handler).toBe(resetPasswordWithoutLogin.handler)
    })
  })

  describe('public API exposure', () => {
    const closed = ['orders', 'customers', 'carts', 'subscribers', 'expenses', 'inventory-adjustments', 'support-tickets', 'customer-accounts', 'login-codes', 'users', 'activity-logs', 'redirects'] as const

    it.each(closed)('anonymous visitors cannot read %s', async (collection) => {
      await expect(payload.find({ collection, overrideAccess: false, user: null })).rejects.toThrow()
    })

    it('hides cost prices on products from visitors and staff', async () => {
      const cat = await payload.create({ collection: 'categories', data: { title: 'Sec Cat' } })
      const product: Product = await payload.create({
        collection: 'products',
        data: {
          title: 'Sec Product',
          category: cat.id,
          productType: 'variable',
          price: 1000,
          costPrice: 400,
          status: 'published',
          variants: [{ label: 'A', stock: 1, costPrice: 300 }],
        },
      })
      for (const user of [null, staff]) {
        const seen = await payload.findByID({ collection: 'products', id: product.id, depth: 0, overrideAccess: false, user })
        expect(seen).not.toHaveProperty('costPrice')
        expect(seen.variants?.[0]).not.toHaveProperty('costPrice')
      }
      await payload.delete({ collection: 'products', id: product.id })
      await payload.delete({ collection: 'categories', id: cat.id })
    })
  })

  describe('automatic redirects', () => {
    it('keeps old product links working through renames, without chains or loops', async () => {
      const cat = await payload.create({ collection: 'categories', data: { title: 'Sec Redirect Cat' } })
      const product = await payload.create({
        collection: 'products',
        data: { title: 'Sectest One', slug: 'sectest-one', category: cat.id, productType: 'simple', price: 1, stock: 1, status: 'published' },
      })
      const rules = async () =>
        (await payload.find({ collection: 'redirects', where: { from: { like: 'sectest' } }, sort: 'from', depth: 0 })).docs.map((r) => [r.from, r.to])

      await payload.update({ collection: 'products', id: product.id, data: { slug: 'sectest-two' } })
      expect(await rules()).toEqual([['/products/sectest-one', '/products/sectest-two']])

      await payload.update({ collection: 'products', id: product.id, data: { slug: 'sectest-three' } })
      expect(await rules()).toEqual([
        ['/products/sectest-one', '/products/sectest-three'],
        ['/products/sectest-two', '/products/sectest-three'],
      ])

      // Back to an old name: that address is a real page again.
      await payload.update({ collection: 'products', id: product.id, data: { slug: 'sectest-one' } })
      expect(await rules()).toEqual([
        ['/products/sectest-three', '/products/sectest-one'],
        ['/products/sectest-two', '/products/sectest-one'],
      ])

      await payload.delete({ collection: 'products', id: product.id })
      await payload.delete({ collection: 'categories', id: cat.id })
      await payload.delete({ collection: 'redirects', where: { to: { like: 'sectest' } } })
    })

    it('rejects a redirect to itself or an unsafe target', async () => {
      await expect(payload.create({ collection: 'redirects', data: { from: '/sectest-a', to: '/sectest-a' } })).rejects.toThrow()
      await expect(payload.create({ collection: 'redirects', data: { from: '/sectest-b', to: '//evil.example' } })).rejects.toThrow()
    })
  })
})
