import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

/** Signed session tokens and one-time-code hashes for customer accounts. */
export const SESSION_DAYS = 30

function key(purpose: string) {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET is required for customer sessions')
  return createHmac('sha256', secret).update(`coco-account:${purpose}`).digest()
}

const sign = (body: string) => createHmac('sha256', key('session')).update(body).digest('base64url')

const same = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export type SessionClaims = { id: number; version: number; expires: number }

export function createSessionToken(id: number, version: number, now = Date.now()): string {
  const claims: SessionClaims = { id, version, expires: now + SESSION_DAYS * 86_400_000 }
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${body}.${sign(body)}`
}

/** The claims of a genuine, unexpired token; otherwise null. */
export function readSessionToken(token: string | undefined, now = Date.now()): SessionClaims | null {
  const [body, signature, ...rest] = (token ?? '').split('.')
  if (!body || !signature || rest.length || !same(signature, sign(body))) return null
  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionClaims
    return claims.expires > now ? claims : null
  } catch {
    return null
  }
}

export const generateLoginCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

export const hashLoginCode = (email: string, code: string) => createHmac('sha256', key('login-code')).update(`${email}:${code}`).digest('hex')

export const sameLoginCode = (stored: string, email: string, code: string) => same(stored, hashLoginCode(email, code))
