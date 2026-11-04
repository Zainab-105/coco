import type { Payload } from 'payload'

import type { CustomerAccount, Order } from '@/payload-types'
import { loginCodeEmail } from '@/lib/email/templates'
import { normalizePkPhone } from '@/lib/phone'

import { createSessionToken, generateLoginCode, hashLoginCode, readSessionToken, sameLoginCode } from './session'

/**
 * Customer account operations, independent of cookies so they can be tested directly.
 * Accounts exist only after someone proves control of the email with a one-time code.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const CODE_MINUTES = 10
const MAX_ATTEMPTS = 5
const MAX_CODES_15_MIN = 3
const MAX_CODES_DAY = 10
const DAY_MS = 86_400_000

const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

export const normalizeAccountEmail = (input: unknown): string | null => {
  if (typeof input !== 'string') return null
  const email = input.trim().toLowerCase().slice(0, 254)
  return EMAIL.test(email) ? email : null
}

export type CodeRequest = { ok: boolean; message: string }

/** Emails a new six-digit code. Limits per mailbox stop email bombing and repeated guessing. */
export async function requestLoginCode(payload: Payload, rawEmail: string): Promise<CodeRequest> {
  const email = normalizeAccountEmail(rawEmail)
  if (!email) return { ok: false, message: 'Please enter a valid email address.' }

  const sentSince = async (ms: number) =>
    (
      await payload.count({
        collection: 'login-codes',
        where: { and: [{ email: { equals: email } }, { createdAt: { greater_than: ago(ms) } }] },
        overrideAccess: true,
      })
    ).totalDocs
  if ((await sentSince(15 * 60_000)) >= MAX_CODES_15_MIN || (await sentSince(DAY_MS)) >= MAX_CODES_DAY) {
    return { ok: false, message: 'Too many codes requested. Please wait a while and try again.' }
  }

  const code = generateLoginCode()
  await payload.update({
    collection: 'login-codes',
    where: { and: [{ email: { equals: email } }, { used: { equals: false } }] },
    data: { used: true },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'login-codes',
    data: { email, codeHash: hashLoginCode(email, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString() },
    overrideAccess: true,
  })
  // Housekeeping: codes are only needed for the daily limit.
  await payload.delete({ collection: 'login-codes', where: { createdAt: { less_than: ago(2 * DAY_MS) } }, overrideAccess: true })

  try {
    await payload.sendEmail({ to: email, ...loginCodeEmail(code, CODE_MINUTES) })
  } catch (error) {
    payload.logger.error({ err: error }, 'Failed to send a sign-in code')
    return { ok: false, message: 'We could not send the email. Please try again shortly.' }
  }
  return { ok: true, message: `We sent a 6-digit code to ${email}. It works for ${CODE_MINUTES} minutes.` }
}

export type CodeCheck = { ok: true; account: CustomerAccount; token: string } | { ok: false; message: string }

const WRONG_CODE = 'That code is not correct or has expired. Please try again or request a new one.'

/** Checks the code and signs in, creating the account on first use. */
export async function verifyLoginCode(payload: Payload, rawEmail: string, rawCode: string): Promise<CodeCheck> {
  const email = normalizeAccountEmail(rawEmail)
  const code = String(rawCode ?? '').replace(/\s/g, '')
  if (!email || !/^\d{6}$/.test(code)) return { ok: false, message: WRONG_CODE }

  const { docs } = await payload.find({
    collection: 'login-codes',
    where: { and: [{ email: { equals: email } }, { used: { equals: false } }] },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const entry = docs[0]
  if (!entry || new Date(entry.expiresAt) < new Date() || (entry.attempts ?? 0) >= MAX_ATTEMPTS) return { ok: false, message: WRONG_CODE }

  if (!sameLoginCode(entry.codeHash, email, code)) {
    await payload.update({ collection: 'login-codes', id: entry.id, data: { attempts: (entry.attempts ?? 0) + 1 }, overrideAccess: true })
    return { ok: false, message: WRONG_CODE }
  }
  await payload.update({ collection: 'login-codes', id: entry.id, data: { used: true }, overrideAccess: true })

  const account = await findOrCreateAccount(payload, email)
  if (account.disabled) return { ok: false, message: 'This account is not available. Please contact us.' }
  await payload.update({ collection: 'customer-accounts', id: account.id, data: { lastLoginAt: new Date().toISOString() }, overrideAccess: true })
  return { ok: true, account, token: createSessionToken(account.id, account.sessionVersion ?? 1) }
}

async function findOrCreateAccount(payload: Payload, email: string): Promise<CustomerAccount> {
  const find = async () =>
    (await payload.find({ collection: 'customer-accounts', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  const existing = await find()
  if (existing) return existing
  try {
    return await payload.create({ collection: 'customer-accounts', data: { email }, overrideAccess: true })
  } catch (error) {
    // Two tabs signing in at once: the other one created it.
    const raced = await find()
    if (raced) return raced
    throw error
  }
}

/** The signed-in account for a session token, or null if it is invalid, ended or disabled. */
export async function accountFromToken(payload: Payload, token: string | undefined): Promise<CustomerAccount | null> {
  const claims = readSessionToken(token)
  if (!claims) return null
  const account = await payload
    .findByID({ collection: 'customer-accounts', id: claims.id, depth: 0, overrideAccess: true, disableErrors: true })
    .catch(() => null)
  if (!account || account.disabled || (account.sessionVersion ?? 1) !== claims.version) return null
  return account
}

/** Ends the session on every device. */
export const endSessions = (payload: Payload, account: CustomerAccount) =>
  payload.update({
    collection: 'customer-accounts',
    id: account.id,
    data: { sessionVersion: (account.sessionVersion ?? 1) + 1 },
    overrideAccess: true,
  })

/** Order history: orders placed with this verified email. */
export async function accountOrders(payload: Payload, account: Pick<CustomerAccount, 'email'>): Promise<Order[]> {
  const { docs } = await payload.find({
    collection: 'orders',
    where: { email: { equals: account.email } },
    sort: '-createdAt',
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  return docs
}

export type ProfileInput = { name?: unknown; phone?: unknown }

export async function saveProfile(payload: Payload, account: CustomerAccount, input: ProfileInput): Promise<string | null> {
  const name = String(input.name ?? '').trim().slice(0, 80)
  const rawPhone = String(input.phone ?? '').trim()
  const phone = rawPhone ? normalizePkPhone(rawPhone.slice(0, 20)) : ''
  if (phone === null) return 'Enter a valid Pakistani mobile number, e.g. 0300 1234567.'
  await payload.update({ collection: 'customer-accounts', id: account.id, data: { name, phone }, overrideAccess: true })
  return null
}

export async function addAddress(
  payload: Payload,
  account: CustomerAccount,
  input: { label?: unknown; city?: unknown; address?: unknown },
): Promise<string | null> {
  const label = String(input.label ?? '').trim().slice(0, 30)
  const city = String(input.city ?? '').trim().slice(0, 60)
  const address = String(input.address ?? '').trim().slice(0, 500)
  if (!city || address.length < 5) return 'Please enter a city and the complete address.'
  const addresses = account.addresses ?? []
  if (addresses.length >= 10) return 'You can save up to 10 addresses. Please remove one first.'
  await payload.update({
    collection: 'customer-accounts',
    id: account.id,
    data: { addresses: [...addresses, { label, city, address }] },
    overrideAccess: true,
  })
  return null
}

export async function removeAddress(payload: Payload, account: CustomerAccount, addressId: string) {
  await payload.update({
    collection: 'customer-accounts',
    id: account.id,
    data: { addresses: (account.addresses ?? []).filter((a) => a.id !== addressId) },
    overrideAccess: true,
  })
}

const productIds = (account: CustomerAccount) => (account.wishlist ?? []).map((p) => (typeof p === 'object' ? p.id : p))

/** Replaces the saved wishlist, or (`merge`) adds to it. Unknown or unpublished products are dropped. */
export async function saveWishlist(payload: Payload, account: CustomerAccount, input: unknown, { merge = false } = {}): Promise<number[]> {
  const incoming = Array.isArray(input) ? input.map(Number).filter((n) => Number.isInteger(n) && n > 0) : []
  const wanted = [...new Set([...incoming, ...(merge ? productIds(account) : [])])].slice(0, 100)
  const { docs } = wanted.length
    ? await payload.find({
        collection: 'products',
        where: { and: [{ id: { in: wanted } }, { status: { equals: 'published' } }] },
        pagination: false,
        depth: 0,
        overrideAccess: true,
        select: {},
      })
    : { docs: [] }
  const valid = new Set(docs.map((d) => d.id))
  const ids = wanted.filter((id) => valid.has(id))
  await payload.update({ collection: 'customer-accounts', id: account.id, data: { wishlist: ids }, overrideAccess: true })
  return ids
}

export const accountWishlist = productIds
