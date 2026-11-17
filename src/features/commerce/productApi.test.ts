import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '../../api/httpClient'
import { createProduct, fetchProduct, fetchProducts, parsePlnToGrosze, updateProduct } from './productApi'

vi.mock('../../api/httpClient', () => ({ apiFetch: vi.fn() }))
const request = vi.mocked(apiFetch)
const productId = 'c0a80101-0000-7000-8000-000000000301'
const programId = 'c0a80101-0000-7000-8000-000000000003'
const detail = { productId, kind: 'course', targetResourceId: programId, entitlementKey: null, accessDurationDays: null, title: 'Kurs', description: null, appleProductId: null, googleProductId: null, isActive: true, createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-01T08:00:00Z', prices: [] }
function sentBody(call = 0): unknown { return JSON.parse(request.mock.calls[call][1]!.body as string) }
beforeEach(() => { request.mockReset() })

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

describe('product kind contract', () => {
  it('sends a course with its target program and explicit nulls for other kinds', async () => {
    request.mockResolvedValue(Response.json(detail))
    await createProduct({ kind: 'course', targetResourceId: programId, title: 'Kurs', appleProductId: 'pl.lumina.course1' })
    expect(request.mock.calls[0][0]).toBe('/api/v1/admin/products')
    expect(sentBody()).toEqual({ kind: 'course', targetResourceId: programId, entitlementKey: null, accessDurationDays: null, title: 'Kurs', description: null, appleProductId: 'pl.lumina.course1', googleProductId: null })
  })

  it('sends a subscription without a target program and keeps the Google base plan id verbatim', async () => {
    request.mockResolvedValue(Response.json({ ...detail, kind: 'subscription', targetResourceId: null, entitlementKey: 'premium' }))
    await updateProduct(productId, { kind: 'subscription', entitlementKey: 'premium', title: 'Premium miesięcznie', googleProductId: 'premium:monthly', isActive: true })
    expect(request.mock.calls[0][1]!.method).toBe('PUT')
    expect(sentBody()).toEqual({ kind: 'subscription', targetResourceId: null, entitlementKey: 'premium', accessDurationDays: null, title: 'Premium miesięcznie', description: null, appleProductId: null, googleProductId: 'premium:monthly', isActive: true })
  })

  it('sends an access pass with its duration and rejects out-of-range durations before calling the API', async () => {
    request.mockResolvedValue(Response.json({ ...detail, kind: 'access_pass', targetResourceId: null, entitlementKey: 'premium', accessDurationDays: 30 }))
    const product = await createProduct({ kind: 'access_pass', entitlementKey: 'premium', accessDurationDays: 30, title: 'Premium 30 dni' })
    expect(sentBody()).toMatchObject({ kind: 'access_pass', targetResourceId: null, entitlementKey: 'premium', accessDurationDays: 30 })
    expect(product.accessDurationDays).toBe(30)
    await expect(createProduct({ kind: 'access_pass', entitlementKey: 'premium', accessDurationDays: 367, title: 'Za długo' })).rejects.toThrow()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('treats products from an API without kind as courses and accepts a null target for non-course items', async () => {
    const legacy: Record<string, unknown> = { ...detail }
    for (const key of ['kind', 'entitlementKey', 'accessDurationDays']) delete legacy[key]
    request.mockResolvedValueOnce(Response.json(legacy))
    expect((await fetchProduct(productId)).kind).toBe('course')
    request.mockResolvedValueOnce(Response.json({ items: [{ productId, kind: 'access_pass', targetResourceId: null, title: 'Premium 365', isActive: true, updatedAt: '2026-10-01T08:00:00Z' }], nextCursor: null }))
    expect((await fetchProducts({})).items[0]).toMatchObject({ kind: 'access_pass', targetResourceId: null })
  })

  it('rejects an unknown product kind instead of guessing', async () => {
    request.mockResolvedValue(Response.json({ ...detail, kind: 'bundle' }))
    await expect(fetchProduct(productId)).rejects.toThrow()
  })
})
