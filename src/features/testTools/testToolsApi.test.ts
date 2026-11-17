import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/apiError'
import { apiFetch } from '../../api/httpClient'
import { clearTestAccess, createTestUser, fetchTestToolsStatus, isTestToolsUnavailableError, simulateSubscriptionEvent, simulateTestPurchase } from './testToolsApi'

vi.mock('../../api/httpClient', () => ({ apiFetch: vi.fn() }))
const request = vi.mocked(apiFetch)
const userId = 'c0a80101-0000-7000-8000-000000000401'
const productId = 'c0a80101-0000-7000-8000-000000000301'
const subscriptionId = 'c0a80101-0000-7000-8000-000000000701'
function call(index = 0) { const [path, init] = request.mock.calls[index]; return { path, method: init?.method, body: init?.body ? JSON.parse(init.body as string) as unknown : undefined } }
beforeEach(() => { request.mockReset() })

describe('test tools API', () => {
  it('creates a test user, sending explicit nulls for omitted optional fields', async () => {
    request.mockResolvedValue(Response.json({ userId, firebaseUid: 'fb-1', email: 'qa@example.test', password: 'Generated#1' }, { status: 201 }))
    const created = await createTestUser({ email: ' qa@example.test ' })
    expect(call()).toEqual({ path: '/api/v1/admin/test-tools/users', method: 'POST', body: { email: 'qa@example.test', password: null, displayName: null } })
    expect(created.password).toBe('Generated#1')
  })

  it('validates the e-mail before calling the API', async () => {
    await expect(createTestUser({ email: 'not-an-email' })).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })

  it('simulates a purchase and tolerates the optional subscription id', async () => {
    request.mockResolvedValue(Response.json({ transactionId: subscriptionId, grantId: subscriptionId }, { status: 201 }))
    const result = await simulateTestPurchase({ userId, productId, store: 'play_store' })
    expect(call()).toEqual({ path: '/api/v1/admin/test-tools/purchases', method: 'POST', body: { userId, productId, store: 'play_store' } })
    expect(result.subscriptionId).toBeNull()
  })

  it('simulates a subscription event and parses the returned subscription', async () => {
    request.mockResolvedValue(Response.json({ subscriptionId, provider: 'test', store: 'app_store', environment: 'sandbox', productId, productTitle: 'Premium', storeProductId: 'premium_monthly', originalTransactionId: 'test-1', entitlementKey: 'premium', status: 'billing_issue', willRenew: true, currentPeriodStart: '2026-10-01T08:00:00Z', currentPeriodEnd: '2026-10-31T08:00:00Z', gracePeriodEnd: null, cancelledAt: null, billingIssueDetectedAt: '2026-10-20T08:00:00Z', refundedAt: null, lastSyncedAt: '2026-10-20T08:00:00Z', createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-20T08:00:00Z' }))
    const result = await simulateSubscriptionEvent(subscriptionId, 'billing_issue')
    expect(call()).toEqual({ path: `/api/v1/admin/test-tools/subscriptions/${subscriptionId}/simulate`, method: 'POST', body: { event: 'billing_issue' } })
    expect(result.status).toBe('billing_issue')
  })

  it('clears test and support access with DELETE', async () => {
    request.mockResolvedValue(new Response(null, { status: 204 }))
    await clearTestAccess(userId)
    expect(call()).toEqual({ path: `/api/v1/admin/test-tools/users/${userId}/access`, method: 'DELETE', body: undefined })
  })

  it('recognizes only a 404 typed test-tools-disabled as the tools being disabled', () => {
    expect(isTestToolsUnavailableError(new ApiError('Disabled', 404, undefined, 'test-tools-disabled'))).toBe(true)
    expect(isTestToolsUnavailableError(new ApiError('User was not found.', 404, undefined, 'not-found'))).toBe(false)
    expect(isTestToolsUnavailableError(new ApiError('Not Found', 404))).toBe(false)
    expect(isTestToolsUnavailableError(new ApiError('Conflict', 409, undefined, 'conflict'))).toBe(false)
    expect(isTestToolsUnavailableError(new Error('network'))).toBe(false)
  })

  it('reads the availability status with GET and parses the environment name', async () => {
    request.mockResolvedValue(Response.json({ enabled: true, environment: 'Staging' }))
    await expect(fetchTestToolsStatus()).resolves.toEqual({ enabled: true, environment: 'Staging' })
    expect(call()).toEqual({ path: '/api/v1/admin/test-tools/status', method: undefined, body: undefined })
  })
})
