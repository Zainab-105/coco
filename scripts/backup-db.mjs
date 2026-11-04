#!/usr/bin/env node
/**
 * Nightly database backup: pg_dump (custom format), check the file is readable, upload to R2/S3,
 * delete copies older than the retention period. Exits non-zero on any failure so cron or Coolify
 * can alert. See docs/ops/RUNBOOK.md.
 *
 *   DATABASE_URL=... BACKUP_S3_BUCKET=coco-backups node scripts/backup-db.mjs
 *   DATABASE_URL=... node scripts/backup-db.mjs --file ./coco.dump     (local file, no upload)
 *
 * Also uses S3_ENDPOINT, S3_REGION, BACKUP_S3_ACCESS_KEY_ID / _SECRET_ACCESS_KEY (falling back to
 * S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY) and BACKUP_RETENTION_DAYS (default 30).
 * The database password is passed through the environment, never the command line.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const fail = (message) => {
  console.error(`Backup failed: ${message}`)
  process.exit(1)
}

/** Splits a connection URL so the password goes in PGPASSWORD. */
export function pgEnv(connectionString) {
  const url = new URL(connectionString)
  return {
    args: ['-h', url.hostname, '-p', url.port || '5432', '-U', decodeURIComponent(url.username), '-d', url.pathname.slice(1)],
    env: {
      ...process.env,
      PGPASSWORD: decodeURIComponent(url.password),
      ...(url.searchParams.get('sslmode') ? { PGSSLMODE: url.searchParams.get('sslmode') } : {}),
    },
  }
}

export const pgBin = (name) => (process.env.PG_BIN ? path.join(process.env.PG_BIN, name) : name)

function run(name, args, env) {
  const result = spawnSync(pgBin(name), args, { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (result.error) fail(`could not run ${name}: ${result.error.message}`)
  if (result.status !== 0) fail(`${name} exited with ${result.status}: ${result.stderr}`)
  return result.stdout
}

async function s3() {
  const { S3Client } = await import('@aws-sdk/client-s3')
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY,
    },
  })
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) fail('DATABASE_URL is not set')

  const flag = process.argv.indexOf('--file')
  const localFile = flag > -1 ? process.argv[flag + 1] : undefined
  const bucket = process.env.BACKUP_S3_BUCKET
  if (!localFile && !bucket) fail('set BACKUP_S3_BUCKET, or use --file for a local copy')

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = localFile ?? path.join(tmpdir(), `coco-${stamp}.dump`)
  const { args, env } = pgEnv(databaseUrl)

  run('pg_dump', ['-Fc', '-f', file, ...args], env)
  // Lists the contents: catches a truncated or corrupt file before it replaces good backups.
  const contents = run('pg_restore', ['--list', file], env)
  if (!contents.includes('TABLE DATA public orders')) fail('the dump has no orders table')
  const size = statSync(file).size
  console.log(`Dump OK: ${file} (${(size / 1024 / 1024).toFixed(1)} MB)`)
  if (localFile) return

  const { PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = await import('@aws-sdk/client-s3')
  const client = await s3()
  const key = `db/coco-${stamp}.dump`
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: readFileSync(file), ContentType: 'application/octet-stream' }))
  rmSync(file)
  console.log(`Uploaded s3://${bucket}/${key}`)

  // Only after a successful upload, so a run of failures never removes the last good copies.
  const cutoff = Date.now() - Number(process.env.BACKUP_RETENTION_DAYS || 30) * 86_400_000
  let token
  let deleted = 0
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'db/', ContinuationToken: token }))
    for (const object of page.Contents ?? []) {
      if (object.LastModified && object.LastModified.getTime() < cutoff) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key }))
        deleted++
      }
    }
    token = page.NextContinuationToken
  } while (token)
  console.log(`Removed ${deleted} expired backups`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  main().catch((error) => fail(error.message))
}
