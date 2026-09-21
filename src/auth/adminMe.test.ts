import { describe, expect, it } from 'vitest'
import { parseAdminMe } from './adminMe'

describe('parseAdminMe', () => {
  it('keeps only permissions known to the backoffice', () => {
    const context = parseAdminMe({
      displayName: 'Administrator',
      authorizationMode: 'firebase_admin_claim',
      effectivePermissions: ['content.read', 'future.permission'],
    })

    expect(context.effectivePermissions).toEqual(['content.read'])
  })

  it('rejects a malformed server response', () => {
    expect(() => parseAdminMe({ effectivePermissions: [] })).toThrow()
  })
})