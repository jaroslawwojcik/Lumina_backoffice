import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '../../api/httpClient'
import { canRefundOrder } from './orderRefund'
import { fetchUserAccess, fetchUserSubscriptions, fetchUserTransactions, grantUserAccess, refundOrder, revokeUserAccessGrant, syncUserRevenueCat } from './userApi'

vi.mock('../../api/httpClient', () => ({ apiFetch: vi.fn() }))
const request = vi.mocked(apiFetch)
const userId = 'c0a80101-0000-7000-8000-000000000401'
const grantId = 'c0a80101-0000-7000-8000-000000000501'
const programId = 'c0a80101-0000-7000-8000-000000000003'
const orderId = 'c0a80101-0000-7000-8000-000000000402'
const grant = { grantId, scope: 'entitlement', entitlementKey: 'premium', resourceId: null, resourceKey: null, source: 'support', validFrom: '2026-10-01T08:00:00Z', validUntil: null, createdAt: '2026-10-01T08:00:00Z', revokedAt: null, revokeReason: null }
const subscription = { subscriptionId: grantId, provider: 'revenuecat', store: 'app_store', environment: 'production', productId: null, productTitle: null, storeProductId: 'premium_monthly', originalTransactionId: '1000', entitlementKey: 'premium', status: 'cancelled', willRenew: false, currentPeriodStart: '2026-10-01T08:00:00Z', currentPeriodEnd: '2026-11-01T08:00:00Z', gracePeriodEnd: null, cancelledAt: '2026-10-05T08:00:00Z', billingIssueDetectedAt: null, refundedAt: null, lastSyncedAt: '2026-10-05T08:00:00Z', createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-05T08:00:00Z' }
const transaction = { transactionId: 'c0a80101-0000-7000-8000-000000000601', provider: 'payu', store: 'payu', environment: 'production', type: 'refund', productId: null, productTitle: 'Premium 30 dni', productKind: 'access_pass', storeProductId: null, storeTransactionId: null, originalTransactionId: null, currency: 'PLN', amountInGrosze: -4990, providerEventId: null, occurredAt: '2026-10-02T08:00:00Z', createdAt: '2026-10-02T08:00:00Z' }
const order = { orderId, productId: programId, productTitle: 'Premium 30 dni', targetProgramResourceId: null, currency: 'PLN', amountInGrosze: 4990, status: 'refund_pending', createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-02T08:00:00Z', completedAt: '2026-10-01T08:05:00Z', failureCode: null, provider: 'payu', productKind: 'access_pass' }
function call(index = 0) { const [path, init] = request.mock.calls[index]; return { path, method: init?.method, body: init?.body ? JSON.parse(init.body as string) as unknown : undefined } }
beforeEach(() => { request.mockReset() })

describe('user monetization API', () => {
  it('grants a premium entitlement with explicit nulls and a trimmed reason', async () => {
    request.mockResolvedValue(Response.json(grant, { status: 201 }))
    await grantUserAccess(userId, { scope: 'entitlement', entitlementKey: 'premium', validUntil: '2027-01-01T00:00:00Z', reason: '  Reklamacja klienta  ' })
    expect(call()).toEqual({ path: `/api/v1/admin/users/${userId}/access-grants`, method: 'POST', body: { scope: 'entitlement', entitlementKey: 'premium', resourceId: null, validUntil: '2027-01-01T00:00:00Z', reason: 'Reklamacja klienta' } })
  })

  it('grants a resource without an expiry', async () => {
    request.mockResolvedValue(Response.json({ ...grant, scope: 'resource', entitlementKey: null, resourceId: programId, resourceKey: 'tydzien-spokoju' }, { status: 201 }))
    const created = await grantUserAccess(userId, { scope: 'resource', resourceId: programId, reason: 'Prezent od zespołu' })
    expect(call().body).toEqual({ scope: 'resource', entitlementKey: null, resourceId: programId, validUntil: null, reason: 'Prezent od zespołu' })
    expect(created.revokeReason).toBeNull()
  })

  it('rejects reasons outside 5–500 characters before calling the API', async () => {
    await expect(grantUserAccess(userId, { scope: 'entitlement', entitlementKey: 'premium', reason: 'abc' })).rejects.toThrow()
    await expect(revokeUserAccessGrant(userId, grantId, 'x'.repeat(501))).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })

  it('revokes a grant and parses the revoke reason', async () => {
    request.mockResolvedValue(Response.json({ ...grant, revokedAt: '2026-10-03T08:00:00Z', revokeReason: 'Nadużycie promocji' }))
    const revoked = await revokeUserAccessGrant(userId, grantId, 'Nadużycie promocji')
    expect(call()).toEqual({ path: `/api/v1/admin/users/${userId}/access-grants/${grantId}/revoke`, method: 'POST', body: { reason: 'Nadużycie promocji' } })
    expect(revoked.revokeReason).toBe('Nadużycie promocji')
  })

  it('keeps reading access lists from APIs that do not send revokeReason yet', async () => {
    const legacyGrant: Record<string, unknown> = { ...grant }
    delete legacyGrant.revokeReason
    request.mockResolvedValue(Response.json({ userId, items: [legacyGrant] }))
    expect((await fetchUserAccess(userId)).items[0].revokeReason).toBeNull()
  })

  it('parses subscription items exactly as the API sends them (subscriptionId, no userId)', async () => {
    request.mockResolvedValueOnce(Response.json({ items: [subscription] }))
    expect((await fetchUserSubscriptions(userId))[0]).toMatchObject({ subscriptionId: grantId, status: 'cancelled', willRenew: false, createdAt: '2026-10-01T08:00:00Z' })
    expect(request.mock.calls[0][0]).toBe(`/api/v1/admin/users/${userId}/subscriptions`)
    const withoutId: Record<string, unknown> = { ...subscription }
    delete withoutId.subscriptionId
    request.mockResolvedValueOnce(Response.json({ items: [withoutId] }))
    await expect(fetchUserSubscriptions(userId)).rejects.toThrow()
  })

  it('pages transactions with an opaque cursor and reads productTitle/productKind from the ledger row', async () => {
    request.mockResolvedValue(Response.json({ items: [transaction], nextCursor: 'next' }))
    const page = await fetchUserTransactions(userId, { pageSize: 25, cursor: 'abc' })
    expect(request.mock.calls[0][0]).toBe(`/api/v1/admin/users/${userId}/transactions?pageSize=25&cursor=abc`)
    expect(page).toMatchObject({ nextCursor: 'next', items: [{ transactionId: transaction.transactionId, amountInGrosze: -4990, productTitle: 'Premium 30 dni', productKind: 'access_pass' }] })
  })

  it('rejects ledger rows without transactionId', async () => {
    const withoutId: Record<string, unknown> = { ...transaction }
    delete withoutId.transactionId
    request.mockResolvedValue(Response.json({ items: [withoutId], nextCursor: null }))
    await expect(fetchUserTransactions(userId, {})).rejects.toThrow()
  })

  it('synchronizes RevenueCat and parses the entitlements body', async () => {
    request.mockResolvedValue(Response.json({ premium: { isActive: true, validUntil: '2026-11-01T08:00:00Z', source: 'revenuecat', status: 'active', willRenew: true, store: 'app_store', productId: null }, courses: [] }))
    const entitlements = await syncUserRevenueCat(userId)
    expect(call()).toEqual({ path: `/api/v1/admin/users/${userId}/revenuecat/sync`, method: 'POST', body: undefined })
    expect(entitlements.premium?.isActive).toBe(true)
  })

  it('requests a full refund and accepts the refund_pending order with no target program', async () => {
    request.mockResolvedValue(Response.json(order, { status: 202 }))
    const result = await refundOrder(orderId, 'Klient zrezygnował')
    expect(call()).toEqual({ path: `/api/v1/admin/orders/${orderId}/refund`, method: 'POST', body: { reason: 'Klient zrezygnował' } })
    expect(result).toMatchObject({ status: 'refund_pending', targetProgramResourceId: null, provider: 'payu', productKind: 'access_pass' })
  })

  it('exposes the refund rule: only completed PayU orders', () => {
    expect(canRefundOrder({ provider: 'payu', status: 'completed' })).toBe(true)
    expect(canRefundOrder({ provider: 'payu', status: 'refund_pending' })).toBe(true)
    for (const status of ['refunded', 'failed', 'cancelled', 'pending']) expect(canRefundOrder({ provider: 'payu', status })).toBe(false)
    expect(canRefundOrder({ provider: 'revenuecat', status: 'refund_pending' })).toBe(false)
    expect(canRefundOrder({ provider: 'revenuecat', status: 'completed' })).toBe(false)
  })
})
