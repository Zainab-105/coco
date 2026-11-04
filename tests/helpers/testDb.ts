/**
 * Integration tests delete data. Refuse to run unless DATABASE_URL points at a database
 * whose name ends in `_test` (set TEST_DATABASE_URL in .env; see .env.example).
 */
export function assertTestDatabase() {
  const url = process.env.DATABASE_URL ?? ''
  const name = url.split('/').pop()?.split('?')[0] ?? ''
  if (!name.endsWith('_test')) {
    throw new Error(
      `Integration tests must run against a *_test database, got "${name || 'none'}". Set TEST_DATABASE_URL in .env.`,
    )
  }
}
