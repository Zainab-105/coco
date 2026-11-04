import 'dotenv/config'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: { 'server-only': fileURLToPath(new URL('./tests/helpers/server-only.ts', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    // Set here (not in a setup file): Payload loads env through @next/env, which resets
    // process.env to its startup snapshot and would undo a later override.
    env: process.env.TEST_DATABASE_URL ? { DATABASE_URL: process.env.TEST_DATABASE_URL } : {},
    // Integration specs share one test database.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts', 'tests/unit/**/*.unit.spec.{ts,tsx}'],
  },
})
