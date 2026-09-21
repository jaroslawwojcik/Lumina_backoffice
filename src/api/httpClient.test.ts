import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from './httpClient'
const { getIdToken } = vi.hoisted(() => ({ getIdToken: vi.fn() }))
vi.mock('../app/environment', () => ({ environment: { apiBaseUrl: 'http://localhost:5236' } }))
vi.mock('../auth/firebase', () => ({ getFirebaseAuth: () => ({ currentUser: { getIdToken } }) }))
const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); getIdToken.mockResolvedValue('test-token') })
afterEach(() => vi.unstubAllGlobals())
describe('authenticated API transport', () => {
  it('attaches Firebase authorization and preserves custom headers', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await apiFetch('/api/v1/admin/me', { headers: { 'Content-Type': 'application/json' } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url.href).toBe('http://localhost:5236/api/v1/admin/me')
    expect(init.headers.get('Authorization')).toBe('Bearer test-token')
    expect(init.headers.get('Content-Type')).toBe('application/json')
    expect(init.headers.get('X-Correlation-Id')).toBeTruthy()
    expect(init.redirect).toBe('error')
  })
  it('rejects requests without a token', async () => {
    getIdToken.mockResolvedValue(undefined)
    await expect(apiFetch('/api/v1/admin/me')).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('does not send credentials to another origin', async () => {
    await expect(apiFetch('https://example.test/private')).rejects.toThrow('Nieprawidłowy adres')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it.each([401, 403, 500])('propagates API status %s', async (status) => {
    fetchMock.mockResolvedValue(Response.json({ title: 'Server error' }, { status }))
    await expect(apiFetch('/api/v1/admin/me')).rejects.toMatchObject({ status })
  })
  it('reports network failure without fabricated data', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(apiFetch('/api/v1/admin/me')).rejects.toThrow('Nie można połączyć')
  })
  it('preserves cancellation', async () => {
    const controller = new AbortController(); controller.abort()
    fetchMock.mockRejectedValue(controller.signal.reason)
    await expect(apiFetch('/api/v1/admin/me', { signal: controller.signal })).rejects.toBe(controller.signal.reason)
  })
})
