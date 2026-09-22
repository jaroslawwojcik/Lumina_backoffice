import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '../../api/httpClient'
import { createResourceRevision, createSession, fetchResources } from './resourceApi'
import { createProgram, createProgramSection } from './programApi'
import { fetchAssets } from '../media/mediaApi'
import { fetchProducts } from '../commerce/productApi'
import { fetchUsers } from '../users/userApi'

vi.mock('../../api/httpClient', () => ({ apiFetch: vi.fn() }))
const request = vi.mocked(apiFetch)
const id = 'c0a80101-0000-7000-8000-000000000001'
beforeEach(() => { request.mockReset() })
describe('API authoring contracts', () => {
  it('sends session fields and nullable metadata to the real endpoint', async () => {
    request.mockResolvedValue(Response.json({ resourceId: id, revisionId: id, revisionNumber: 1 }))
    await createSession({ canonicalKey: 'oddech', locale: 'pl', slug: 'oddech', title: 'Oddech', mediaKind: 'audio', durationSeconds: 600, snapshot: {} })
    expect(request.mock.calls[0][0]).toBe('/api/v1/admin/sessions')
    expect(JSON.parse(request.mock.calls[0][1]!.body as string)).toMatchObject({ locale: 'pl', summary: null, description: null, durationSeconds: 600 })
  })
  it('sends nullable program and section fields', async () => {
    request.mockResolvedValue(Response.json({ resourceId: id, revisionId: id, revisionNumber: 1 }))
    await createProgram({ canonicalKey: 'oddech', locale: 'pl', slug: 'oddech', title: 'Oddech', snapshot: {} })
    expect(JSON.parse(request.mock.calls[0][1]!.body as string)).toMatchObject({ summary: null, description: null, level: null, estimatedDays: null })
    await createProgramSection({ programId: id, locale: 'pl', title: 'Dzień', entries: [{ resourceId: id, inheritProgramAccess: true, isOptional: false }] })
    expect(JSON.parse(request.mock.calls[1][1]!.body as string).description).toBeNull()
  })
  it('sends a revision with an explicit nullable note', async () => {
    request.mockResolvedValue(new Response(null, { status: 204 }))
    await createResourceRevision({ resourceId: id, resourceType: 'session' }, { durationSeconds: 60 })
    expect(JSON.parse(request.mock.calls[0][1]!.body as string)).toEqual({ resourceId: id, snapshot: { durationSeconds: 60 }, note: null })
    await createResourceRevision({ resourceId: id, resourceType: 'program' }, { publicMetadata: { intents: ['sen'] } })
    expect(request.mock.calls[1][0]).toBe(`/api/v1/admin/programs/${id}/revisions`)
  })
  it('maps resource type and preserves an opaque paging cursor', async () => {
    request.mockResolvedValue(Response.json({ items: [], nextCursor: 'opaque-cursor' }))
    expect(await fetchResources({ type: 'session', locale: 'pl' })).toEqual({ items: [], nextCursor: 'opaque-cursor' })
    expect(request.mock.calls[0][0]).toContain('resourceType=session&locale=pl')
  })
  it('never replaces failed reads with demonstration records', async () => {
    request.mockRejectedValue(new Error('API unavailable'))
    for (const read of [() => fetchResources({}), () => fetchAssets({}), () => fetchProducts({}), () => fetchUsers({})]) await expect(read()).rejects.toThrow('API unavailable')
  })
})

