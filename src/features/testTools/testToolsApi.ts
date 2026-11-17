import { z } from 'zod'
import { ApiError } from '../../api/apiError'
import { apiFetch } from '../../api/httpClient'
import { adminUserSubscriptionSchema, type AdminUserSubscription } from '../users/userApi'

const basePath = '/api/v1/admin/test-tools'
const jsonHeaders = { 'Content-Type': 'application/json' }

export const testStores = ['app_store', 'play_store', 'payu'] as const
export type TestStore = (typeof testStores)[number]
export const subscriptionEvents = ['cancel', 'uncancel', 'billing_issue', 'expire', 'refund', 'renew'] as const
export type SubscriptionEvent = (typeof subscriptionEvents)[number]

export const createTestUserPayloadSchema = z.object({ email: z.string().trim().email(), password: z.string().min(6).optional(), displayName: z.string().trim().min(1).optional() })
export type CreateTestUserPayload = z.infer<typeof createTestUserPayloadSchema>
/** Contains a one-time password. Never persist, cache or log this value. */
const createdTestUserSchema = z.object({ userId: z.string().uuid(), firebaseUid: z.string(), email: z.string(), password: z.string() })
export type CreatedTestUser = z.infer<typeof createdTestUserSchema>

const purchasePayloadSchema = z.object({ userId: z.string().uuid(), productId: z.string().uuid(), store: z.enum(testStores) })
export type SimulatePurchasePayload = z.infer<typeof purchasePayloadSchema>
const purchaseResultSchema = z.object({ transactionId: z.string().uuid(), grantId: z.string().uuid(), subscriptionId: z.string().uuid().nullable().default(null) })
export type SimulatedPurchase = z.infer<typeof purchaseResultSchema>

/** ProblemDetails `type` sent by every test-tools route while the tools are disabled (Production or `TestTools:Enabled` != true). */
export const testToolsDisabledProblemType = 'test-tools-disabled'

/**
 * Only a 404 typed `test-tools-disabled` means the tools are switched off.
 * Other 404s (`not-found`: missing user or subscription) are ordinary errors and must stay visible.
 */
export function isTestToolsUnavailableError(error: unknown): boolean { return error instanceof ApiError && error.status === 404 && error.problemType === testToolsDisabledProblemType }

const statusSchema = z.object({ enabled: z.boolean(), environment: z.string() })
export type TestToolsStatus = z.infer<typeof statusSchema>

/** `GET /status`: 200 when enabled; 404 `test-tools-disabled` (an ApiError) when disabled. */
export async function fetchTestToolsStatus(signal?: AbortSignal): Promise<TestToolsStatus> {
  const response = await apiFetch(`${basePath}/status`, { signal })
  return statusSchema.parse(await response.json())
}

export async function createTestUser(payload: CreateTestUserPayload): Promise<CreatedTestUser> {
  const values = createTestUserPayloadSchema.parse(payload)
  const response = await apiFetch(`${basePath}/users`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email: values.email, password: values.password ?? null, displayName: values.displayName ?? null }) })
  return createdTestUserSchema.parse(await response.json())
}

export async function simulateTestPurchase(payload: SimulatePurchasePayload): Promise<SimulatedPurchase> {
  const response = await apiFetch(`${basePath}/purchases`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(purchasePayloadSchema.parse(payload)) })
  return purchaseResultSchema.parse(await response.json())
}

export async function simulateSubscriptionEvent(subscriptionId: string, event: SubscriptionEvent): Promise<AdminUserSubscription> {
  const response = await apiFetch(`${basePath}/subscriptions/${z.string().uuid().parse(subscriptionId)}/simulate`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ event: z.enum(subscriptionEvents).parse(event) }) })
  return adminUserSubscriptionSchema.parse(await response.json())
}

export async function clearTestAccess(userId: string): Promise<void> {
  await apiFetch(`${basePath}/users/${z.string().uuid().parse(userId)}/access`, { method: 'DELETE' })
}
