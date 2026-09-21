import { describe, expect, it } from 'vitest'

import { formatShortId } from './format'

describe('formatShortId', () => {
  it('uses the random tail of a uuid v7, not its timestamp prefix', () => {
    expect(formatShortId('01a0c54f-48c8-7718-b74b-eb2915cc43ba')).toBe('#15CC43BA')
  })
})
