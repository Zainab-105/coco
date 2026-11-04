import type { Endpoint, PayloadRequest } from 'payload'
import QRCode from 'qrcode'

import { hasRole } from '@/access/roles'
import { consumeTwoFactorCode, loadTwoFactor } from '@/hooks/twoFactor'
import { decryptSecret, encryptSecret, generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, otpauthUrl, verifyTotp } from '@/lib/security/totp'
import { clientIp, throttled } from '@/lib/throttle'

/**
 * Two-factor setup for admin users (TOTP: Google Authenticator, Authy, 1Password...), and the
 * reset-password route. The code is checked at login by hooks/twoFactor.ts.
 */
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

const body = async (req: PayloadRequest) => ((await req.json?.().catch(() => ({}))) ?? {}) as Record<string, unknown>

const audit = (req: PayloadRequest, targetId: number | string, summary: string) =>
  req.payload.create({
    collection: 'activity-logs',
    data: { user: req.user!.id, action: 'update', targetCollection: 'users', targetId: String(targetId), summary },
    overrideAccess: true,
    req,
  })

const clear = { enabled: false, secret: null, pendingSecret: null, recoveryCodes: null, lastCounter: null }

/** POST /api/users/2fa/setup: a new secret to scan. Not active until confirmed with a code. */
export const twoFactorSetup: Endpoint = {
  path: '/2fa/setup',
  method: 'post',
  handler: async (req) => {
    if (!req.user) return json({ error: 'Please sign in.' }, 401)
    const user = await loadTwoFactor(req, req.user.id)
    if (user.twoFactor?.enabled) return json({ error: 'Two-factor authentication is already on.' }, 400)

    const secret = generateTotpSecret()
    await req.payload.update({
      collection: 'users',
      id: user.id,
      data: { twoFactor: { pendingSecret: encryptSecret(secret) } },
      overrideAccess: true,
      req,
    })
    const url = otpauthUrl(secret, user.email)
    return json({ secret, url, qr: await QRCode.toString(url, { type: 'svg', margin: 1 }) })
  },
}

/** POST /api/users/2fa/enable {code}: turns it on. Recovery codes are returned only this once. */
export const twoFactorEnable: Endpoint = {
  path: '/2fa/enable',
  method: 'post',
  handler: async (req) => {
    if (!req.user) return json({ error: 'Please sign in.' }, 401)
    const user = await loadTwoFactor(req, req.user.id)
    const pending = user.twoFactor?.pendingSecret
    if (user.twoFactor?.enabled || !pending) return json({ error: 'Start the setup again.' }, 400)

    const secret = decryptSecret(pending)
    const counter = verifyTotp(secret, String((await body(req)).code ?? '').trim())
    if (counter === null) return json({ error: 'That code is not correct. Check your phone and try again.' }, 400)

    const recoveryCodes = generateRecoveryCodes()
    await req.payload.update({
      collection: 'users',
      id: user.id,
      data: {
        twoFactor: { enabled: true, secret: pending, pendingSecret: null, recoveryCodes: recoveryCodes.map(hashRecoveryCode), lastCounter: counter },
      },
      overrideAccess: true,
      req,
    })
    await audit(req, user.id, 'Turned on two-factor authentication')
    return json({ recoveryCodes })
  },
}

/** POST /api/users/2fa/disable {code}: needs a valid code, so a left-open session cannot weaken login. */
export const twoFactorDisable: Endpoint = {
  path: '/2fa/disable',
  method: 'post',
  handler: async (req) => {
    if (!req.user) return json({ error: 'Please sign in.' }, 401)
    const user = await loadTwoFactor(req, req.user.id)
    if (!user.twoFactor?.enabled) return json({ error: 'Two-factor authentication is off.' }, 400)
    if (throttled(`2fa:${user.id}`, 10, 15 * 60_000)) return json({ error: 'Too many attempts. Please wait 15 minutes.' }, 429)
    if (!(await consumeTwoFactorCode(req, user, String((await body(req)).code ?? '')))) return json({ error: 'That code is not correct.' }, 400)

    await req.payload.update({ collection: 'users', id: user.id, data: { twoFactor: clear }, overrideAccess: true, req })
    await audit(req, user.id, 'Turned off two-factor authentication')
    return json({ ok: true })
  },
}

/** POST /api/users/:id/2fa/reset: owner only, for someone who lost their phone and recovery codes. */
export const twoFactorReset: Endpoint = {
  path: '/:id/2fa/reset',
  method: 'post',
  handler: async (req) => {
    if (!hasRole(req.user, ['owner'])) return json({ error: 'Only the owner can do this.' }, 403)
    const id = String(req.routeParams?.id ?? '')
    await req.payload.update({ collection: 'users', id, data: { twoFactor: clear }, overrideAccess: true, req })
    await audit(req, id, 'Reset two-factor authentication for this user')
    return json({ ok: true })
  },
}

/**
 * Replaces Payload's POST /api/users/reset-password, which signs the user in straight away. That
 * would let anyone with access to the mailbox skip two-factor, so here nobody is signed in: they
 * log in normally with the new password.
 */
export const resetPasswordWithoutLogin: Endpoint = {
  path: '/reset-password',
  method: 'post',
  handler: async (req) => {
    const data = await body(req)
    req.context = { ...req.context, passwordReset: true }
    await req.payload.resetPassword({
      collection: 'users',
      data: { password: String(data.password ?? ''), token: String(data.token ?? '') },
      overrideAccess: true,
      req,
    })
    return json({ message: 'Your password was changed. Please log in.' })
  },
}

/** Stops the forgot-password form being used to flood someone's inbox. */
export const throttleForgotPassword = (req: PayloadRequest) => throttled(`forgot-password:${clientIp(req.headers)}`, 5, 15 * 60_000)
