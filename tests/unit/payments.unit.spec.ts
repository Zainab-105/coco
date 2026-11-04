import { createDecipheriv, createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { buildEasypaisaRequest, easypaisaHash, type EasypaisaConfig } from '@/lib/payments/easypaisa'
import { buildJazzCashRequest, jazzcashHash, pkTimestamp, verifyJazzCashResponse, type JazzCashConfig } from '@/lib/payments/jazzcash'

const jc: JazzCashConfig = { merchantId: 'MC123', password: 'pass', integritySalt: 'salt123', environment: 'sandbox' }

describe('JazzCash', () => {
  it('hashes sorted non-empty pp_ fields prefixed with the salt', () => {
    const fields = { pp_B: '2', pp_A: '1', pp_Empty: '', other: 'x', pp_SecureHash: 'ignored' }
    const expected = createHmac('sha256', 'salt123').update('salt123&1&2').digest('hex').toUpperCase()
    expect(jazzcashHash(fields, 'salt123')).toBe(expected)
  })

  it('builds a signed request in paisa with Pakistan time', () => {
    const now = new Date('2026-11-02T10:00:00Z')
    const { action, fields } = buildJazzCashRequest(jc, { orderNumber: 'COCO-261102-ABCD', total: 1449 }, 'https://coco.pk/api/payments/jazzcash/return', now)
    expect(action).toContain('sandbox.jazzcash.com.pk')
    expect(fields.pp_Amount).toBe('144900')
    expect(fields.pp_TxnDateTime).toBe('20261102150000')
    expect(fields.pp_BillReference).toBe('COCO-261102-ABCD')
    expect(fields.pp_SecureHash).toBe(jazzcashHash(fields, jc.integritySalt))
    expect(pkTimestamp(now)).toBe('20261102150000')
  })

  const response = (over: Record<string, string> = {}) => {
    const fields: Record<string, string> = {
      pp_Amount: '144900',
      pp_BillReference: 'COCO-261102-ABCD',
      pp_MerchantID: 'MC123',
      pp_ResponseCode: '000',
      pp_ResponseMessage: 'Thank you for Using JazzCash',
      pp_RetreivalReferenceNo: '261102123456',
      pp_TxnRefNo: 'T20261102150000ABCD',
      ...over,
    }
    return { ...fields, pp_SecureHash: jazzcashHash(fields, jc.integritySalt) }
  }

  it('accepts a correctly signed successful response', () => {
    expect(verifyJazzCashResponse(jc, response())).toMatchObject({
      valid: true,
      paid: true,
      orderNumber: 'COCO-261102-ABCD',
      amount: 1449,
      transactionId: '261102123456',
    })
  })

  it('reports failed and pending payments', () => {
    expect(verifyJazzCashResponse(jc, response({ pp_ResponseCode: '199' }))).toMatchObject({ valid: true, paid: false, pending: false })
    expect(verifyJazzCashResponse(jc, response({ pp_ResponseCode: '124' }))).toMatchObject({ valid: true, paid: false, pending: true })
  })

  it('rejects tampered responses', () => {
    const tampered = { ...response(), pp_Amount: '100' }
    expect(verifyJazzCashResponse(jc, tampered)).toEqual({ valid: false, reason: 'Signature mismatch' })
    expect(verifyJazzCashResponse({ ...jc, integritySalt: 'other' }, response()).valid).toBe(false)
    expect(verifyJazzCashResponse(jc, { ...response(), pp_SecureHash: '' }).valid).toBe(false)
  })
})

describe('Easypaisa', () => {
  const ep: EasypaisaConfig = { storeId: '1234', hashKey: 'ABCDEFGHIJKLMNOP', environment: 'sandbox' }

  it('encrypts the sorted request with AES-128-ECB', () => {
    const fields = { storeId: '1', amount: '10.0', empty: '' }
    const decipher = createDecipheriv('aes-128-ecb', Buffer.from(ep.hashKey), null)
    const plain = Buffer.concat([decipher.update(Buffer.from(easypaisaHash(fields, ep.hashKey), 'base64')), decipher.final()]).toString()
    expect(plain).toBe('amount=10.0&storeId=1')
  })

  it('builds a hosted checkout request', () => {
    const { action, fields } = buildEasypaisaRequest(ep, { orderNumber: 'COCO-1', total: 1449, phone: '+923001234567' }, 'https://coco.pk/r')
    expect(action).toBe('https://easypaystg.easypaisa.com.pk/easypay/Index.jsf')
    expect(fields).toMatchObject({ amount: '1449.0', orderRefNum: 'COCO-1', mobileNum: '03001234567', storeId: '1234' })
    expect(fields.merchantHashedReq).toBeTruthy()
  })
})
