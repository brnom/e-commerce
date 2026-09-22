import { describe, expect, it } from 'vitest'

import { parseApiEnv } from './api-env'

describe('parseApiEnv', () => {
  it('applies defaults for optional variables', () => {
    const env = parseApiEnv({ DATABASE_URL: 'postgresql://localhost/app' })

    expect(env.API_PORT).toBe(5001)
    expect(env.WEB_ORIGIN).toBe('http://localhost:3005')
  })

  it('names the missing variable when DATABASE_URL is absent', () => {
    expect(() => parseApiEnv({})).toThrow(/DATABASE_URL/)
  })

  it('rejects a non-numeric API_PORT', () => {
    expect(() =>
      parseApiEnv({ DATABASE_URL: 'postgresql://localhost/app', API_PORT: 'abc' }),
    ).toThrow(/API_PORT/)
  })
})
