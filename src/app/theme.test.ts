import { alpha } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'
import { paletteTokens } from './designTokens'
import { theme } from './theme'

describe('application theme', () => {
  it('uses MUI-compatible palette tokens for derived colors', () => {
    expect(theme.palette.primary.main).toBe(paletteTokens.accent)
    expect(() => alpha(theme.palette.primary.main, 0.12)).not.toThrow()
  })
})
