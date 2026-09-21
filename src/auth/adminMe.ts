import { z } from 'zod'
import { apiFetch } from '../api/httpClient'
import { permissions, type Permission } from './permissions'

const adminMeSchema = z.object({
  displayName: z.string(),
  authorizationMode: z.string(),
  effectivePermissions: z.array(z.string()),
})

const knownPermissions = new Set<string>(permissions)

export type AdminMe = {
  displayName: string
  authorizationMode: string
  effectivePermissions: readonly Permission[]
}

export function parseAdminMe(value: unknown): AdminMe {
  const response = adminMeSchema.parse(value)
  return {
    ...response,
    effectivePermissions: response.effectivePermissions.filter(
      (permission): permission is Permission => knownPermissions.has(permission),
    ),
  }
}

export async function fetchAdminMe(): Promise<AdminMe> {
  const response = await apiFetch('/api/v1/admin/me')
  return parseAdminMe(await response.json())
}