/**
 * Drops and recreates the local dev database (embedded Postgres on 5433 only).
 * Use before `npm run seed:sample` to start from a clean slate.
 */
import pg from 'pg'

const url = new URL(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/coco')
if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
  console.error(`Refusing to reset non-local database at ${url.hostname}`)
  process.exit(1)
}
const name = url.pathname.slice(1)
const admin = new URL(url)
admin.pathname = '/postgres'

const client = new pg.Client(admin.toString())
await client.connect()
await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
await client.query(`CREATE DATABASE "${name}"`)
await client.end()
console.log(`Reset database "${name}"`)
