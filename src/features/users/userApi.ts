import { z } from 'zod'
import { apiFetch } from '../../api/httpClient'

export type UserListSearch = { search?: string; pageSize?: 25 | 50 | 100; cursor?: string }

const userListItemSchema = z.object({ userId: z.string().uuid(), authProvider: z.string(), authSubject: z.string(), email: z.string().nullable(), displayName: z.string().nullable(), createdAt: z.string() })
const userDetailSchema = userListItemSchema.extend({ firstName: z.string().nullable(), lastName: z.string().nullable(), locale: z.string(), timeZone: z.string(), notificationsEnabled: z.boolean(), theme: z.string(), updatedAt: z.string() })
const accessGrantSchema = z.object({ grantId: z.string().uuid(), scope: z.string(), entitlementKey: z.string().nullable(), resourceId: z.string().uuid().nullable(), resourceKey: z.string().nullable(), source: z.string(), validFrom: z.string(), validUntil: z.string().nullable(), createdAt: z.string(), revokedAt: z.string().nullable() })
const accessSchema = z.object({ userId: z.string().uuid(), items: z.array(accessGrantSchema) })
const orderSchema = z.object({ orderId: z.string().uuid(), productId: z.string().uuid(), productTitle: z.string(), targetProgramResourceId: z.string().uuid(), currency: z.string(), amountInGrosze: z.number().int(), status: z.string(), createdAt: z.string(), updatedAt: z.string(), completedAt: z.string().nullable(), failureCode: z.string().nullable() })
const progressSchema = z.object({ resourceId: z.string().uuid(), resourceKey: z.string(), positionSeconds: z.number().int(), isCompleted: z.boolean(), lastPlayedAt: z.string().nullable(), completedAt: z.string().nullable(), revision: z.number().int(), updatedAt: z.string() })
const userListSchema = z.object({ items: z.array(userListItemSchema), nextCursor: z.string().nullable() })
const orderListSchema = z.object({ items: z.array(orderSchema), nextCursor: z.string().nullable() })
const progressListSchema = z.object({ items: z.array(progressSchema), nextCursor: z.string().nullable() })

export type AdminUser = z.infer<typeof userDetailSchema>
export type AdminUserAccess = z.infer<typeof accessSchema>
export type AdminUserOrder = z.infer<typeof orderSchema>
export type AdminUserProgress = z.infer<typeof progressSchema>
export type CursorPage<T> = { items: T[]; nextCursor: string | null }
function queryParams(search: UserListSearch): URLSearchParams { const params = new URLSearchParams(); if (search.search) params.set('search', search.search); if (search.pageSize) params.set('pageSize', String(search.pageSize)); if (search.cursor) params.set('cursor', search.cursor); return params }
function userPath(userId?: string): string { return `/api/v1/admin/users${userId ? `/${userId}` : ''}` }

export function formatGroszeAsPln(amountInGrosze: number): string { const absolute = Math.abs(amountInGrosze); return `${amountInGrosze < 0 ? '-' : ''}${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, '0')} zł` }

export async function fetchUsers(search: UserListSearch, signal?: AbortSignal): Promise<CursorPage<z.infer<typeof userListItemSchema>>> {
  const response = await apiFetch(`${userPath()}?${queryParams(search).toString()}`, { signal })
  return userListSchema.parse(await response.json())
}

export async function fetchUser(userId: string, signal?: AbortSignal): Promise<AdminUser> { const response = await apiFetch(userPath(userId), { signal }); return userDetailSchema.parse(await response.json()) }
export async function fetchUserAccess(userId: string, signal?: AbortSignal): Promise<AdminUserAccess> { const response = await apiFetch(`${userPath(userId)}/access`, { signal }); return accessSchema.parse(await response.json()) }
export async function fetchUserOrders(userId: string, search: UserListSearch, signal?: AbortSignal): Promise<CursorPage<AdminUserOrder>> { const response = await apiFetch(`${userPath(userId)}/orders?${queryParams(search).toString()}`, { signal }); return orderListSchema.parse(await response.json()) }
export async function fetchUserProgress(userId: string, search: UserListSearch, signal?: AbortSignal): Promise<CursorPage<AdminUserProgress>> { const response = await apiFetch(`${userPath(userId)}/progress?${queryParams(search).toString()}`, { signal }); return progressListSchema.parse(await response.json()) }
