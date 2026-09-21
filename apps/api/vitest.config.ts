import { resolve as resolvePath } from 'node:path'
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

import { DEFAULT_TEST_DATABASE_URL } from './test/support/test-database-url'

const swcPlugin = swc.vite({ module: { type: 'es6' } })

const resolve = {
  alias: [{ find: /^@\//, replacement: `${resolvePath(__dirname, 'src')}/` }],
}

const unitEnv = {
  DATABASE_URL: 'postgresql://unit:unit@localhost:5432/unit',
}

const integrationEnv = {
  DATABASE_URL: process.env['TEST_DATABASE_URL'] ?? DEFAULT_TEST_DATABASE_URL,
}

export default defineConfig({
  plugins: [swcPlugin],
  resolve,
  test: {
    passWithNoTests: true,
    projects: [
      {
        plugins: [swcPlugin],
        resolve,
        test: { name: 'unit', include: ['src/**/*.test.ts'], environment: 'node', env: unitEnv },
      },
      {
        plugins: [swcPlugin],
        resolve,
        test: {
          name: 'integration',
          include: ['test/**/*.test.ts'],
          environment: 'node',
          env: integrationEnv,
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          globalSetup: ['./test/support/global-setup.ts'],
        },
      },
    ],
  },
})
