import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { Client } from 'pg'

import { testDatabaseUrl } from './test-database-url'

async function ensureDatabase(url: URL): Promise<void> {
  const databaseName = url.pathname.slice(1)
  const maintenanceUrl = new URL(url)
  maintenanceUrl.pathname = '/postgres'
  const client = new Client({ connectionString: maintenanceUrl.toString() })
  await client.connect()
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      databaseName,
    ])
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${databaseName.replaceAll('"', '""')}"`)
    }
  } finally {
    await client.end()
  }
}

export default async function setup(): Promise<void> {
  const url = new URL(testDatabaseUrl())
  await ensureDatabase(url)
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: resolve(__dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'inherit',
  })
}
