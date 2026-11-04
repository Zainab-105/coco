/**
 * Runs a project-local PostgreSQL 17 for development (no Docker or system install needed).
 * Data lives in .data/postgres (git-ignored). Stop with Ctrl+C.
 *
 *   npm run db:dev
 *   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/coco
 */
import EmbeddedPostgres from 'embedded-postgres'
import fs from 'node:fs'
import path from 'node:path'

const databaseDir = path.resolve('.data/postgres')
const port = Number(process.env.DEV_DB_PORT ?? 5433)

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
  onLog: () => {},
})

const fresh = !fs.existsSync(path.join(databaseDir, 'PG_VERSION'))
if (fresh) {
  console.log('Initialising dev database cluster in .data/postgres ...')
  await pg.initialise()
}
try {
  await pg.start()
} catch (error) {
  // Postgres refuses a second copy on the same data folder, and reports no useful error here.
  const pidFile = path.join(databaseDir, 'postmaster.pid')
  if (fs.existsSync(pidFile)) {
    console.log(`The dev database is already running (process ${fs.readFileSync(pidFile, 'utf8').split('\n')[0].trim()}) on port ${port}. Nothing to do.`)
    process.exit(0)
  }
  console.error('Could not start the dev database:', error ?? 'see the Postgres log in .data/postgres')
  process.exit(1)
}

const client = pg.getPgClient()
await client.connect()
// `coco` for the app, `coco_test` for integration tests (wiped by the tests).
const { rows } = await client.query("SELECT datname FROM pg_database WHERE datname IN ('coco', 'coco_test')")
await client.end()
for (const name of ['coco', 'coco_test']) {
  if (!rows.some((r) => r.datname === name)) await pg.createDatabase(name)
}

console.log(`Dev Postgres ready: postgres://postgres:postgres@127.0.0.1:${port}/coco  (Ctrl+C to stop)`)

let stopping = false
const shutdown = async () => {
  if (stopping) return
  stopping = true
  await pg.stop()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
setInterval(() => {}, 1 << 30)
