import { createCipheriv } from 'node:crypto'

/**
 * Easypaisa Easypay hosted checkout ("Open Checkout").
 * 1. We post a signed request to Index.jsf; 2. Easypay returns an auth_token to our postback
 * URL, which we post to Confirm.jsf; 3. Easypay redirects back with a status.
 * The final redirect is NOT trusted on its own: an order is marked paid only after the
 * server-side Inquire Transaction API confirms it (see inquireEasypaisaTransaction).
 *
 * Validate against the Easypay staging environment with real merchant credentials before going live.
 */
export type EasypaisaConfig = {
  storeId: string
  hashKey: string
  environment: 'sandbox' | 'live'
  inquiry?: { accountNum: string; username: string; password: string }
}

const HOSTS = {
  sandbox: 'https://easypaystg.easypaisa.com.pk',
  live: 'https://easypay.easypaisa.com.pk',
}

export function easypaisaConfig(env: NodeJS.ProcessEnv = process.env): EasypaisaConfig | null {
  const { EASYPAISA_STORE_ID, EASYPAISA_HASH_KEY, EASYPAISA_ENV } = env
  if (!EASYPAISA_STORE_ID || !EASYPAISA_HASH_KEY) return null
  const inquiry =
    env.EASYPAISA_ACCOUNT_NUM && env.EASYPAISA_API_USERNAME && env.EASYPAISA_API_PASSWORD
      ? { accountNum: env.EASYPAISA_ACCOUNT_NUM, username: env.EASYPAISA_API_USERNAME, password: env.EASYPAISA_API_PASSWORD }
      : undefined
  return { storeId: EASYPAISA_STORE_ID, hashKey: EASYPAISA_HASH_KEY, environment: EASYPAISA_ENV === 'live' ? 'live' : 'sandbox', inquiry }
}

/** AES-128-ECB (PKCS5 padding) of the alphabetically sorted query string, base64-encoded. */
export function easypaisaHash(fields: Record<string, string>, hashKey: string): string {
  const plain = Object.keys(fields)
    .filter((k) => fields[k] !== '' && fields[k] != null)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('&')
  const cipher = createCipheriv('aes-128-ecb', Buffer.from(hashKey, 'utf8').subarray(0, 16), null)
  return Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]).toString('base64')
}

const easypayDate = (d: Date) => {
  const pk = new Date(d.getTime() + 5 * 3_600_000).toISOString()
  return `${pk.slice(0, 10).replace(/-/g, '')} ${pk.slice(11, 19).replace(/:/g, '')}`
}

export function buildEasypaisaRequest(
  cfg: EasypaisaConfig,
  order: { orderNumber: string; total: number; email?: string | null; phone?: string | null },
  postBackURL: string,
  now = new Date(),
) {
  const fields: Record<string, string> = {
    amount: order.total.toFixed(1),
    autoRedirect: '1',
    emailAddr: order.email ?? '',
    expiryDate: easypayDate(new Date(now.getTime() + 60 * 60 * 1000)),
    mobileNum: order.phone ? order.phone.replace('+92', '0') : '',
    orderRefNum: order.orderNumber,
    paymentMethod: 'MA_PAYMENT_METHOD',
    postBackURL,
    storeId: cfg.storeId,
  }
  return {
    action: `${HOSTS[cfg.environment]}/easypay/Index.jsf`,
    fields: { ...fields, merchantHashedReq: easypaisaHash(fields, cfg.hashKey) },
  }
}

export function buildEasypaisaConfirm(cfg: EasypaisaConfig, authToken: string, postBackURL: string) {
  return { action: `${HOSTS[cfg.environment]}/easypay/Confirm.jsf`, fields: { auth_token: authToken, postBackURL } }
}

export type EasypaisaInquiry = { verified: boolean; paid: boolean; transactionId?: string; amount?: number; raw?: unknown }

/** Server-to-server status check. Without inquiry credentials, nothing is auto-confirmed. */
export async function inquireEasypaisaTransaction(cfg: EasypaisaConfig, orderNumber: string): Promise<EasypaisaInquiry> {
  if (!cfg.inquiry) return { verified: false, paid: false }
  const res = await fetch(`${HOSTS[cfg.environment]}/easypay-service/rest/v4/inquire-transaction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Credentials: Buffer.from(`${cfg.inquiry.username}:${cfg.inquiry.password}`).toString('base64'),
    },
    body: JSON.stringify({ orderId: orderNumber, storeId: cfg.storeId, accountNum: cfg.inquiry.accountNum }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return { verified: false, paid: false }
  const body = (await res.json()) as { responseCode?: string; transactionStatus?: string; transactionId?: string; transactionAmount?: number }
  return {
    verified: body.responseCode === '0000',
    paid: body.responseCode === '0000' && body.transactionStatus === 'PAID',
    transactionId: body.transactionId,
    amount: body.transactionAmount,
    raw: body,
  }
}
