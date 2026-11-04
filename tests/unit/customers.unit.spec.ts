import { describe, expect, it } from 'vitest'

import { customerSegment, holdsStock } from '@/lib/orderStatus'
import { normalizePkPhone } from '@/lib/phone'

describe('normalizePkPhone', () => {
  it.each([
    ['0300-1234567', '+923001234567'],
    ['0300 123 4567', '+923001234567'],
    ['+92 300 1234567', '+923001234567'],
    ['923001234567', '+923001234567'],
    ['00923001234567', '+923001234567'],
    ['3001234567', '+923001234567'],
  ])('normalises %s', (input, expected) => {
    expect(normalizePkPhone(input)).toBe(expected)
  })

  it('rejects landlines and short numbers', () => {
    expect(normalizePkPhone('042-35761234')).toBeNull()
    expect(normalizePkPhone('0300123')).toBeNull()
  })
})

describe('holdsStock', () => {
  it('respects the configured deduction point for new orders', () => {
    expect(holdsStock('new', 'placed')).toBe(true)
    expect(holdsStock('new', 'confirmed')).toBe(false)
    expect(holdsStock('shipped', 'confirmed')).toBe(true)
  })

  it('releases stock for cancelled and returned orders', () => {
    expect(holdsStock('cancelled', 'placed')).toBe(false)
    expect(holdsStock('returned', 'placed')).toBe(false)
  })
})

describe('customerSegment', () => {
  const opts = { highValueThreshold: 15000, inactiveAfterDays: 90, now: new Date('2026-10-30') }

  it('classifies customers', () => {
    const recent = new Date('2026-10-01')
    expect(customerSegment({ orderCount: 1, totalSpent: 2000, lastOrderAt: recent }, opts)).toBe('new')
    expect(customerSegment({ orderCount: 3, totalSpent: 6000, lastOrderAt: recent }, opts)).toBe('repeat')
    expect(customerSegment({ orderCount: 4, totalSpent: 20000, lastOrderAt: recent }, opts)).toBe(
      'high_value',
    )
    expect(
      customerSegment({ orderCount: 4, totalSpent: 20000, lastOrderAt: new Date('2026-05-01') }, opts),
    ).toBe('inactive')
  })
})
