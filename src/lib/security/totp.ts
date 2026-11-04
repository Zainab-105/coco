import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** Time-based one-time passwords (RFC 6238), recovery codes and encryption of the stored secret. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const STEP_SECONDS = 30
const DIGITS = 6
/** Accepts the neighbouring 30-second codes, for phone clocks that are slightly off. */
const WINDOW = 1

export function base32Encode(bytes: Buffer) {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
    value &= (1 << bits) - 1
  }
  return bits > 0 ? out + ALPHABET[(value << (5 - bits)) & 31] : out
}

export function base32Decode(text: string) {
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const char of text.toUpperCase().replace(/=+$/, '')) {
    const index = ALPHABET.indexOf(char)
    if (index < 0) throw new Error('Invalid base32')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
    value &= (1 << bits) - 1
  }
  return Buffer.from(out)
}

export const generateTotpSecret = () => base32Encode(randomBytes(20))

export function totpCode(secret: string, counter: number) {
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac('sha1', base32Decode(secret)).update(message).digest()
  const offset = digest[digest.length - 1] & 15
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS).padStart(DIGITS, '0')
}

export const totpCounter = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS)

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

/**
 * The time step of a valid code, or null. A step at or before `lastCounter` is refused, so a code
 * seen once (shoulder surfing, phishing relay) cannot be used again.
 */
export function verifyTotp(secret: string, code: string, { lastCounter = -1, now = Date.now() }: { lastCounter?: number; now?: number } = {}) {
  if (!/^\d{6}$/.test(code)) return null
  const current = totpCounter(now)
  for (let counter = current - WINDOW; counter <= current + WINDOW; counter++) {
    if (counter > lastCounter && same(totpCode(secret, counter), code)) return counter
  }
  return null
}

export function otpauthUrl(secret: string, account: string, issuer = 'COCO Admin') {
  const label = encodeURIComponent(`${issuer}:${account}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`
}

export const generateRecoveryCodes = (count = 8) =>
  Array.from({ length: count }, () => {
    const hex = randomBytes(5).toString('hex')
    return `${hex.slice(0, 5)}-${hex.slice(5)}`
  })

export const normalizeRecoveryCode = (code: string) => code.trim().toLowerCase()

/** Recovery codes are long random values, so a plain hash is enough. */
export const hashRecoveryCode = (code: string) => createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex')

function key() {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET is required for two-factor authentication')
  return createHash('sha256').update(`coco-totp:${secret}`).digest()
}

/** AES-256-GCM, so a database leak alone does not reveal authenticator secrets. */
export function encryptSecret(plain: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.')
}

export function decryptSecret(stored: string) {
  const [iv, tag, data] = stored.split('.').map((part) => Buffer.from(part, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
