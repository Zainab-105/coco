'use client'

import { Button, toast } from '@payloadcms/ui'
import { useState } from 'react'

import type { ImportResult } from '@/endpoints/productImport'
import { parseCsv } from '@/lib/csv'

type Response = { applied: boolean; hasErrors: boolean; results: ImportResult[]; error?: string }

const fmt = (v: unknown) => (v == null || v === '' ? '-' : String(v))

/** Upload CSV -> preview every change (dry run) -> apply. Nothing is written until "Apply". */
export function ImportProducts() {
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<Response | null>(null)
  const [busy, setBusy] = useState(false)

  const send = async (dryRun: boolean) => {
    setBusy(true)
    const res = await fetch('/api/products/import', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, dryRun }),
    })
    const body = (await res.json()) as Response
    setBusy(false)
    if (!res.ok) return toast.error(body.error ?? 'Import failed')
    setPreview(body)
    if (body.applied) {
      toast.success(`Updated ${body.results.filter((r) => r.changes.length).length} items.`)
      setRows([])
    }
  }

  const onFile = async (file?: File) => {
    if (!file) return
    const { headers, rows: parsed } = parseCsv(await file.text())
    if (!headers.includes('sku')) return toast.error('The file needs a "sku" column. Start from "Export CSV" on the Products list.')
    setFileName(file.name)
    setRows(parsed)
    setPreview(null)
  }

  const changed = preview?.results.filter((r) => r.changes.length) ?? []
  const errors = preview?.results.filter((r) => r.errors.length) ?? []

  return (
    <div style={{ maxWidth: 1000, paddingBottom: 48 }}>
      <ol style={{ lineHeight: 1.8, paddingLeft: 18 }}>
        <li>
          On the Products list click <strong>Export CSV</strong> and open the file in Excel or Google Sheets.
        </li>
        <li>
          Edit <code>price</code>, <code>salePrice</code> (use <code>-</code> to remove a sale), <code>costPrice</code>,{' '}
          <code>stock</code> or <code>status</code>. Leave other columns as they are. Rows are matched by <code>sku</code>.
        </li>
        <li>Save as CSV, upload it here, check the preview, then apply.</li>
      </ol>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '20px 0' }}>
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} aria-label="CSV file" />
        {rows.length > 0 && (
          <span>
            {fileName}: {rows.length} rows
          </span>
        )}
      </div>

      {rows.length > 0 && !preview?.applied && (
        <Button disabled={busy} onClick={() => send(true)}>
          {busy ? 'Checking...' : 'Preview changes'}
        </Button>
      )}

      {preview && (
        <div style={{ marginTop: 24 }}>
          <p>
            <strong>{changed.length}</strong> items {preview.applied ? 'updated' : 'will change'},{' '}
            <strong>{preview.results.length - changed.length - errors.length}</strong> unchanged,{' '}
            <strong style={{ color: errors.length ? '#a3262f' : undefined }}>{errors.length}</strong> with errors.
          </p>

          {errors.length > 0 && (
            <div style={{ border: '1px solid #a3262f', padding: 12, margin: '12px 0' }}>
              <strong>Fix these rows and upload again (nothing has been changed):</strong>
              <ul>
                {errors.map((r) => (
                  <li key={r.line}>
                    Line {r.line} ({r.sku || 'no sku'}): {r.errors.join('; ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {changed.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--theme-elevation-150)' }}>
                  <th style={{ padding: 6 }}>Line</th>
                  <th style={{ padding: 6 }}>SKU</th>
                  <th style={{ padding: 6 }}>Product</th>
                  <th style={{ padding: 6 }}>Changes</th>
                </tr>
              </thead>
              <tbody>
                {changed.map((r) => (
                  <tr key={r.line} style={{ borderBottom: '1px solid var(--theme-elevation-100)' }}>
                    <td style={{ padding: 6 }}>{r.line}</td>
                    <td style={{ padding: 6 }}>{r.sku}</td>
                    <td style={{ padding: 6 }}>{r.target}</td>
                    <td style={{ padding: 6 }}>
                      {r.changes.map((c) => (
                        <div key={c.field}>
                          {c.field}: {fmt(c.from)} &rarr; <strong>{fmt(c.to)}</strong>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!preview.applied && !preview.hasErrors && changed.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <Button disabled={busy} onClick={() => send(false)}>
                {busy ? 'Applying...' : `Apply ${changed.length} changes`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
