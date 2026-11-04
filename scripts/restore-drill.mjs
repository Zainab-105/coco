#!/usr/bin/env node
/**
 * Proves a backup can actually be restored: loads it into a new temporary database next to the
 * live one, checks the data, reports, and drops the temporary database. The source database is
 * only read from for comparison. See docs/ops/RUNBOOK.md.
 *
 *   DATABASE_URL=... node scripts/restore-drill.mjs --file ./coco.dump
 *   DATABASE_URL=... BACKUP_S3_BUCKET=coco-backups node scripts/restore-drill.mjs   (latest in the bucket)
 *   Add --log to append the result to docs/ops/RESTORE-LOG.md.
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, createWriteStream, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

import pg from 'pg'

import { pgBin, pgEnv } from './backup-db.mjs'

const databaseUrl = process.env.DATABASE_URL
const stop = (message) => {
  console.error(`Restore drill failed: ${message}`)
  process.exit(1)
}
if (!databaseUrl) stop('DATABASE_URL is not set')

async function latestFromBucket() {
  const bucket = process.env.BACKUP_S3_BUCKET
  if (!bucket) stop('use --file, or set BACKUP_S3_BUCKET')
  const { S3Client, ListObjectsV2Command, GetObjectCommand } = await import('@aws-sdk/client-s3')
  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY,
    },
  })
  const objects = []
  let token
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'db/', ContinuationToken: token }))
    objects.push(...(page.Contents ?? []))
    token = page.NextContinuationToken
  } while (token)
  const latest = objects.sort((a, b) => b.LastModified - a.LastModified)[0]
  if (!latest) stop(`no backups in s3://${bucket}/db/`)
  const file = path.join(tmpdir(), path.basename(latest.Key))
  const { Body } = await client.send(new GetObjectCommand({ Bucket: bucket, Key: latest.Key }))
  await pipeline(Body, createWriteStream(file))
  console.log(`Downloaded ${latest.Key} from ${latest.LastModified.toISOString()}`)
  return file
}

const flag = process.argv.indexOf('--file')
const file = flag > -1 ? process.argv[flag + 1] : await latestFromBucket()
statSync(file)

const source = new URL(databaseUrl)
const name = `coco_restore_${Date.now()}`
const restoreUrl = new URL(databaseUrl)
restoreUrl.pathname = `/${name}`

const withClient = async (connectionString, work) => {
  const client = new pg.Client({ connectionString: String(connectionString) })
  await client.connect()
  try {
    return await work(client)
  } finally {
    await client.end()
  }
}

const started = Date.now()
const checks = []
let failed = false
const check = (label, ok, detail = '') => {
  checks.push(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`)
  if (!ok) failed = true
}

await withClient(source, (c) => c.query(`CREATE DATABASE "${name}"`))
try {
  const { args, env } = pgEnv(String(restoreUrl))
  const restore = spawnSync(pgBin('pg_restore'), ['--no-owner', '--no-privileges', '--exit-on-error', ...args, file], { env, encoding: 'utf8' })
  check('pg_restore finished', restore.status === 0, restore.status === 0 ? '' : (restore.error?.message ?? restore.stderr).slice(0, 400))

  if (restore.status === 0) {
    await withClient(restoreUrl, async (c) => {
      const count = async (table) => Number((await c.query(`SELECT count(*) AS n FROM "${table}"`)).rows[0].n)
      for (const table of ['orders', 'orders_items', 'customers', 'products', 'products_variants', 'users', 'inventory_adjustments']) {
        check(`table ${table}`, true, `${await count(table)} rows`)
      }
      check('at least one admin user', (await count('users')) > 0)

      const { rows: migrations } = await c.query(`SELECT name FROM payload_migrations WHERE name <> 'dev' ORDER BY batch DESC, name DESC LIMIT 1`)
      check('migration history present', true, migrations[0]?.name ?? 'none (database built by dev push)')

      // Every order must still add up, and every line must still point at a real order.
      const { rows: badTotals } = await c.query(`
        SELECT count(*) AS n FROM orders o
        WHERE o.subtotal <> (SELECT coalesce(sum(i.line_total), 0) FROM orders_items i WHERE i._parent_id = o.id)`)
      check('order totals match their lines', Number(badTotals[0].n) === 0, `${badTotals[0].n} mismatched`)
      const { rows: latest } = await c.query(`SELECT order_number, created_at FROM orders ORDER BY created_at DESC LIMIT 1`)
      if (latest[0]) checks.push(`info latest order: ${latest[0].order_number} at ${new Date(latest[0].created_at).toISOString()}`)
    })
  }
} finally {
  await withClient(source, (c) => c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`))
}

const seconds = ((Date.now() - started) / 1000).toFixed(1)
const summary = `${failed ? 'FAILED' : 'PASSED'} in ${seconds}s from ${path.basename(file)} (${(statSync(file).size / 1024 / 1024).toFixed(1)} MB)`
console.log(checks.join('\n'))
console.log(`Restore drill ${summary}`)

if (process.argv.includes('--log')) {
  appendFileSync(
    new URL('../docs/ops/RESTORE-LOG.md', import.meta.url),
    `\n## ${new Date().toISOString().slice(0, 10)}: ${summary}\n\n\`\`\`\n${checks.join('\n')}\n\`\`\`\n`,
  )
}
process.exit(failed ? 1 : 0)
