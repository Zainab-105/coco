#!/usr/bin/env node
/**
 * Performance budget: JavaScript each key page makes the browser download, gzipped, measured the
 * way a phone sees it, from the running site's HTML. Fails CI when a page goes over. Lazy chunks
 * loaded after interaction are not counted.
 *
 *   node scripts/check-budget.mjs http://localhost:3000
 */
import { gzipSync } from 'node:zlib'

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')
const KB = 1024

// Set just above what the pages measure today, to catch regressions. The development plan aimed for
// 170 KB on category pages; React and Next alone are about 118 KB of this. Lower these as pages shrink.
const BUDGETS = [
  { path: '/', kb: 220 },
  { path: '/collections/car-scents', kb: 220 },
  { path: '/products/hanging-car-diffuser', kb: 240 },
  { path: '/checkout', kb: 215 },
]

let failed = false
for (const { path, kb } of BUDGETS) {
  const res = await fetch(`${base}${path}`)
  if (!res.ok) {
    console.error(`FAIL ${path}: HTTP ${res.status}`)
    failed = true
    continue
  }
  const html = await res.text()
  const scripts = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&')))]
  const sizes = await Promise.all(
    scripts.map(async (src) => {
      const script = await fetch(new URL(src, base))
      return gzipSync(Buffer.from(await script.arrayBuffer())).length
    }),
  )
  const total = sizes.reduce((sum, n) => sum + n, 0) / KB
  const ok = total <= kb
  if (!ok) failed = true
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${path}: ${total.toFixed(0)} KB of JS in ${scripts.length} files (budget ${kb} KB)`)
}
process.exit(failed ? 1 : 0)
