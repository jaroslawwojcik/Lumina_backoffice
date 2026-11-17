import { z } from 'zod'
import { apiFetch } from '../../api/httpClient'

export type UserListSearch = { search?: string; pageSize?: 25 | 50 | 100; cursor?: string }

const userListItemSchema = z.object({ userId: z.string().uuid(), authProvider: z.string(), authSubject: z.string(), email: z.string().nullable(), displayName: z.string().nullable(), createdAt: z.string() })
const userDetailSchema = userListItemSchema.extend({ firstName: z.string().nullable(), lastName: z.string().nullable(), locale: z.string(), timeZone: z.string(), notificationsEnabled: z.boolean(), theme: z.string(), updatedAt: z.string() })
const accessGrantSchema = z.object({ grantId: z.string().uuid(), scope: z.string(), entitlementKey: z.string().nullable(), resourceId: z.string().uuid().nullable(), resourceKey: z.string().nullable(), source: z.string(), validFrom: z.string(), validUntil: z.string().nullable(), createdAt: z.string(), revokedAt: z.string().nullable(), revokeReason: z.string().nullable().default(null) })
const accessSchema = z.object({ userId: z.string().uuid(), items: z.array(accessGrantSchema) })
// targetProgramResourceId is null for access-pass orders; provider/productKind were added with monetization (A2).
const orderSchema = z.object({ orderId: z.string().uuid(), productId: z.string().uuid(), productTitle: z.string(), targetProgramResourceId: z.string().uuid().nullable(), currency: z.string(), amountInGrosze: z.number().int(), status: z.string(), createdAt: z.string(), updatedAt: z.string(), completedAt: z.string().nullable(), failureCode: z.string().nullable(), provider: z.string(), productKind: z.string() })
const progressSchema = z.object({ resourceId: z.string().uuid(), resourceKey: z.string(), positionSeconds: z.number().int(), isCompleted: z.boolean(), lastPlayedAt: z.string().nullable(), completedAt: z.string().nullable(), revision: z.number().int(), updatedAt: z.string() })
const userListSchema = z.object({ items: z.array(userListItemSchema), nextCursor: z.string().nullable() })
const orderListSchema = z.object({ items: z.array(orderSchema), nextCursor: z.string().nullable() })
const progressListSchema = z.object({ items: z.array(progressSchema), nextCursor: z.string().nullable() })

const nullableString = z.string().nullable().default(null)
// Mirrors AdminUserSubscriptionItem. The projection carries no userId (the user is in the request path).
export const adminUserSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  provider: z.string(), store: z.string(), environment: z.string(),
  productId: z.string().uuid().nullable().default(null), productTitle: nullableString,
  storeProductId: z.string(), originalTransactionId: z.string(), entitlementKey: z.string(), status: z.string(), willRenew: z.boolean(),
  currentPeriodStart: z.string(), currentPeriodEnd: z.string(), gracePeriodEnd: nullableString, cancelledAt: nullableString, billingIssueDetectedAt: nullableString, refundedAt: nullableString,
  lastSyncedAt: z.string(), createdAt: z.string(), updatedAt: z.string(),
})
const subscriptionListSchema = z.object({ items: z.array(adminUserSubscriptionSchema) })
// Mirrors AdminUserTransactionItem (append-only ledger row; amounts in grosze, negative for refunds).
const transactionSchema = z.object({
  transactionId: z.string().uuid(),
  provider: z.string(), store: z.string(), environment: z.string(), type: z.string(),
  productId: z.string().uuid().nullable().default(null), productTitle: nullableString, productKind: nullableString,
  storeProductId: nullableString, storeTransactionId: nullableString, originalTransactionId: nullableString,
  currency: nullableString, amountInGrosze: z.number().int().nullable().default(null),
  providerEventId: nullableString, occurredAt: z.string(), createdAt: z.string(),
})
const transactionListSchema = z.object({ items: z.array(transactionSchema), nextCursor: z.string().nullable() })
export const entitlementsSchema = z.object({
  premium: z.object({ isActive: z.boolean(), validUntil: z.string().nullable(), source: z.string(), status: z.string(), willRenew: z.boolean(), store: z.string(), productId: z.string().uuid().nullable().default(null) }).nullable(),
  courses: z.array(z.object({ resourceId: z.string().uuid(), resourceKey: z.string(), source: z.string(), grantedAt: z.string(), validUntil: z.string().nullable() })),
})

/** Support reason accepted by grant, revoke and refund commands. */
export const supportReasonSchema = z.string().trim().min(5).max(500)
const isoDateTimeSchema = z.string().datetime({ offset: true })
export const grantAccessPayloadSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('entitlement'), entitlementKey: z.literal('premium'), validUntil: isoDateTimeSchema.optional(), reason: supportReasonSchema }),
  z.object({ scope: z.literal('resource'), resourceId: z.string().uuid(), validUntil: isoDateTimeSchema.optional(), reason: supportReasonSchema }),
])

export type AdminUser = z.infer<typeof userDetailSchema>
export type AdminUserAccess = z.infer<typeof accessSchema>
export type AdminUserOrder = z.infer<typeof orderSchema>
export type AdminUserProgress = z.infer<typeof progressSchema>
export type AdminUserAccessGrant = z.infer<typeof accessGrantSchema>
export type AdminUserSubscription = z.infer<typeof adminUserSubscriptionSchema>
export type AdminUserTransaction = z.infer<typeof transactionSchema>
export type UserEntitlements = z.infer<typeof entitlementsSchema>
export type GrantAccessPayload = z.infer<typeof grantAccessPayloadSchema>
export type CursorPage<T> = { items: T[]; nextCursor: string | null }

/** Stable query keys. Everything for one user lives under `['user', userId]` so a prefix invalidation reaches every tab. */
export const userQueryKeys = {
  detail: (userId: string) => ['user', userId] as const,
  access: (userId: string) => ['user', userId, 'access'] as const,
  orders: (userId: string) => ['user', userId, 'orders'] as const,
  progress: (userId: string) => ['user', userId, 'progress'] as const,
  subscriptions: (userId: string) => ['user', userId, 'subscriptions'] as const,
  transactions: (userId: string) => ['user', userId, 'transactions'] as const,
}
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

const jsonHeaders = { 'Content-Type': 'application/json' }

export async function fetchUserSubscriptions(userId: string, signal?: AbortSignal): Promise<AdminUserSubscription[]> {
  const response = await apiFetch(`${userPath(userId)}/subscriptions`, { signal })
  return subscriptionListSchema.parse(await response.json()).items
}

export async function fetchUserTransactions(userId: string, search: UserListSearch, signal?: AbortSignal): Promise<CursorPage<AdminUserTransaction>> {
  const params = new URLSearchParams()
  if (search.pageSize) params.set('pageSize', String(search.pageSize))
  if (search.cursor) params.set('cursor', search.cursor)
  const response = await apiFetch(`${userPath(userId)}/transactions?${params.toString()}`, { signal })
  return transactionListSchema.parse(await response.json())
}

export async function grantUserAccess(userId: string, payload: GrantAccessPayload): Promise<AdminUserAccessGrant> {
  const values = grantAccessPayloadSchema.parse(payload)
  const body = { scope: values.scope, entitlementKey: values.scope === 'entitlement' ? values.entitlementKey : null, resourceId: values.scope === 'resource' ? values.resourceId : null, validUntil: values.validUntil ?? null, reason: values.reason }
  const response = await apiFetch(`${userPath(userId)}/access-grants`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) })
  return accessGrantSchema.parse(await response.json())
}

export async function revokeUserAccessGrant(userId: string, grantId: string, reason: string): Promise<AdminUserAccessGrant> {
  const response = await apiFetch(`${userPath(userId)}/access-grants/${grantId}/revoke`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ reason: supportReasonSchema.parse(reason) }) })
  return accessGrantSchema.parse(await response.json())
}

export async function syncUserRevenueCat(userId: string): Promise<UserEntitlements> {
  const response = await apiFetch(`${userPath(userId)}/revenuecat/sync`, { method: 'POST' })
  return entitlementsSchema.parse(await response.json())
}

/** Requests a full PayU refund. The server answers 202 with the order in `refund_pending`; the final state arrives asynchronously. */
export async function refundOrder(orderId: string, reason: string): Promise<AdminUserOrder> {
  const response = await apiFetch(`/api/v1/admin/orders/${orderId}/refund`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ reason: supportReasonSchema.parse(reason) }) })
  return orderSchema.parse(await response.json())
}
