import { APIError, type CollectionBeforeLoginHook, type PayloadRequest } from 'payload'

import type { User } from '@/payload-types'
import { decryptSecret, hashRecoveryCode, verifyTotp } from '@/lib/security/totp'
import { TWO_FACTOR_INVALID, TWO_FACTOR_REQUIRED } from '@/lib/security/twoFactorMessages'
import { throttled } from '@/lib/throttle'

/** Reads the protected fields, which normal API reads never return. */
export const loadTwoFactor = async (req: PayloadRequest, id: number | string): Promise<User> =>
  req.payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true, showHiddenFields: true, req })

/**
 * Checks a code for a user with two-factor on: an authenticator code (never the same one twice),
 * or a recovery code (each works once). Saves whichever was used. Returns whether it was valid.
 */
export async function consumeTwoFactorCode(req: PayloadRequest, user: User, rawCode: string): Promise<boolean> {
  const code = rawCode.trim()
  const tf = user.twoFactor
  if (!tf?.secret) return false

  const counter = verifyTotp(decryptSecret(tf.secret), code, { lastCounter: tf.lastCounter ?? -1 })
  if (counter !== null) {
    await req.payload.update({ collection: 'users', id: user.id, data: { twoFactor: { lastCounter: counter } }, overrideAccess: true, req })
    return true
  }

  const hashes = (tf.recoveryCodes ?? []) as string[]
  const hash = hashRecoveryCode(code)
  if (!hashes.includes(hash)) return false
  await req.payload.update({
    collection: 'users',
    id: user.id,
    data: { twoFactor: { recoveryCodes: hashes.filter((h) => h !== hash) } },
    overrideAccess: true,
    req,
  })
  return true
}

/**
 * Runs after the password is accepted, before any session exists. Any way of logging in without
 * the code (REST, GraphQL, local API) therefore fails closed for users with two-factor on.
 */
export const enforceTwoFactor: CollectionBeforeLoginHook<User> = async ({ req, user }) => {
  // Our reset-password endpoint never issues a session; see endpoints/twoFactor.ts.
  if (req.context?.passwordReset === true) return user

  const full = await loadTwoFactor(req, user.id)
  if (!full.twoFactor?.enabled) return user

  const code = (req.data as { totp?: unknown } | undefined)?.totp
  if (typeof code !== 'string' || !code.trim()) throw new APIError(TWO_FACTOR_REQUIRED, 401, undefined, true)
  if (throttled(`2fa:${user.id}`, 10, 15 * 60_000)) throw new APIError('Too many attempts. Please wait 15 minutes.', 429, undefined, true)
  if (!(await consumeTwoFactorCode(req, full, code))) throw new APIError(TWO_FACTOR_INVALID, 401, undefined, true)
  return user
}
