import { describe, expect, it } from 'vitest'

import { parseCsv, toCsv } from '@/lib/csv'

describe('toCsv', () => {
  it('writes a BOM, quotes special characters and uses CRLF', () => {
    const csv = toCsv([{ a: 'Hira, "H"', b: 'line1\nline2', c: 5 }], [
      { header: 'Name', value: (r) => r.a },
      { header: 'Note', value: (r) => r.b },
      { header: 'Qty', value: (r) => r.c },
    ])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toBe('﻿Name,Note,Qty\r\n"Hira, ""H""","line1\nline2",5\r\n')
  })

  it('neutralises spreadsheet formulas in text but keeps negative numbers', () => {
    const csv = toCsv([{ v: '=HYPERLINK("x")' }, { v: -3 }, { v: '+923001234567' }], [{ header: 'v', value: (r) => r.v }])
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain('\r\n-3\r\n')
    expect(csv).toContain("'+923001234567")
  })
})

describe('parseCsv', () => {
  it('round-trips exported data', () => {
    const csv = toCsv([{ sku: 'CS-1', title: 'Sweet "Rose", 8ml' }], [
      { header: 'sku', value: (r) => r.sku },
      { header: 'title', value: (r) => r.title },
    ])
    expect(parseCsv(csv)).toEqual({ headers: ['sku', 'title'], rows: [{ sku: 'CS-1', title: 'Sweet "Rose", 8ml' }] })
  })

  it('handles LF files, blank lines and short rows', () => {
    expect(parseCsv('sku,price\nA,10\n\nB\n').rows).toEqual([
      { sku: 'A', price: '10' },
      { sku: 'B', price: '' },
    ])
  })
})
