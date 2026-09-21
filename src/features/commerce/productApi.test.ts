import { describe, expect, it } from 'vitest'
import { parsePlnToGrosze } from './productApi'

describe('parsePlnToGrosze', () => {
  it('maps a Polish decimal amount to integer grosze without float arithmetic', () => {
    expect(parsePlnToGrosze('49,90')).toBe(4990)
  })

  it('rejects invalid, non-positive, and overlarge values', () => {
    expect(parsePlnToGrosze('49.90')).toBeUndefined()
    expect(parsePlnToGrosze('0,00')).toBeUndefined()
    expect(parsePlnToGrosze('21474836,48')).toBeUndefined()
  })
})