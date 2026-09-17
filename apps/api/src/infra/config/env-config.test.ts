import { describe, expect, it } from 'vitest'

import { loadConfig } from './env-config'

describe('loadConfig', () => {
  it('maps validated environment variables onto the Config port', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://app:app@db:5432/app',
      API_PORT: '4000',
      WEB_ORIGIN: 'http://web.test',
    })

    expect(config).toEqual({
      port: 4000,
      databaseUrl: 'postgresql://app:app@db:5432/app',
      webOrigin: 'http://web.test',
    })
  })

  it('fails naming the missing variable', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/)
  })
})
