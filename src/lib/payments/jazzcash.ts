import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * JazzCash Hosted Checkout (page redirection, API v1.1).
 * The customer is redirected to JazzCash with a signed form; JazzCash posts the result back
 * to our return URL, signed the same way. Signature: HMAC-SHA256 keyed with the integrity salt
 * over `salt&value1&value2...` where values are the non-empty pp_* fields sorted by name.
 *
 * Validate against the JazzCash sandbox with real merchant credentials before going live.
 */
export type JazzCashConfig = {
  merchantId: string
  password: string
  integritySalt: string
  environment: 'sandbox' | 'live'
}

export const JAZZCASH_URL = {
  sandbox: 'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/',
  live: 'https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/',
}

export function jazzcashConfig(env: NodeJS.ProcessEnv = process.env): JazzCashConfig | null {
  const { JAZZCASH_MERCHANT_ID, JAZZCASH_PASSWORD, JAZZCASH_INTEGRITY_SALT, JAZZCASH_ENV } = env
  if (!JAZZCASH_MERCHANT_ID || !JAZZCASH_PASSWORD || !JAZZCASH_INTEGRITY_SALT) return null
  return {
    merchantId: JAZZCASH_MERCHANT_ID,
    password: JAZZCASH_PASSWORD,
    integritySalt: JAZZCASH_INTEGRITY_SALT,
    environment: JAZZCASH_ENV === 'live' ? 'live' : 'sandbox',
  }
}

export function jazzcashHash(fields: Record<string, string>, integritySalt: string): string {
  const values = Object.keys(fields)
    .filter((k) => k.toLowerCase().startsWith('pp') && k !== 'pp_SecureHash' && fields[k] !== '' && fields[k] != null)
    .sort()
    .map((k) => fields[k])
  return createHmac('sha256', integritySalt).update([integritySalt, ...values].join('&')).digest('hex').toUpperCase()
}

/** Pakistan time, yyyyMMddHHmmss, as JazzCash expects. */
export function pkTimestamp(date: Date) {
  const pk = new Date(date.getTime() + 5 * 3_600_000)
  return pk.toISOString().replace(/[-:T]/g, '').slice(0, 14)
}

export function buildJazzCashRequest(
  cfg: JazzCashConfig,
  order: { orderNumber: string; total: number },
  returnUrl: string,
  now = new Date(),
) {
  const fields: Record<string, string> = {
    pp_Version: '1.1',
    pp_TxnType: '',
    pp_Language: 'EN',
    pp_MerchantID: cfg.merchantId,
    pp_Password: cfg.password,
    // Unique per attempt so a customer can retry a failed payment.
    pp_TxnRefNo: `T${pkTimestamp(now)}${order.orderNumber.slice(-4)}`,
    pp_Amount: String(Math.round(order.total * 100)),
    pp_TxnCurrency: 'PKR',
    pp_TxnDateTime: pkTimestamp(now),
    pp_BillReference: order.orderNumber,
    pp_Description: `COCO order ${order.orderNumber}`,
    pp_TxnExpiryDateTime: pkTimestamp(new Date(now.getTime() + 60 * 60 * 1000)),
    pp_ReturnURL: returnUrl,
  }
  fields.pp_SecureHash = jazzcashHash(fields, cfg.integritySalt)
  return { action: JAZZCASH_URL[cfg.environment], fields }
}

export type JazzCashResult =
  | { valid: false; reason: string }
  | { valid: true; paid: boolean; pending: boolean; orderNumber: string; amount: number; transactionId: string; message: string }

/** Verifies the signed response JazzCash posts to our return URL. */
export function verifyJazzCashResponse(cfg: JazzCashConfig, response: Record<string, string>): JazzCashResult {
  const received = response.pp_SecureHash ?? ''
  const expected = jazzcashHash(response, cfg.integritySalt)
  const a = Buffer.from(received.toUpperCase())
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { valid: false, reason: 'Signature mismatch' }
  if (response.pp_MerchantID && response.pp_MerchantID !== cfg.merchantId) return { valid: false, reason: 'Merchant mismatch' }

  const code = response.pp_ResponseCode
  return {
    valid: true,
    paid: code === '000',
    // 124: voucher issued / awaiting customer payment at a shop.
    pending: code === '124',
    orderNumber: response.pp_BillReference ?? '',
    amount: Number(response.pp_Amount ?? 0) / 100,
    transactionId: response.pp_RetreivalReferenceNo || response.pp_TxnRefNo || '',
    message: response.pp_ResponseMessage ?? '',
  }
}
