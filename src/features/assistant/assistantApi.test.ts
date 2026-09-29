import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '../../api/httpClient'
import { sendMessage, updateDraft, type Proposal } from './assistantApi'

vi.mock('../../api/httpClient', () => ({ apiFetch: vi.fn() }))
const request = vi.mocked(apiFetch)
const id = 'c0a80101-0000-7000-8000-000000000001'
const proposal: Proposal = { canonicalKey: '', locale: 'pl', slug: '', title: '', summary: null, description: null, mediaKind: 'video', durationSeconds: null, level: null, estimatedDays: null, publicMetadata: { style: null, intents: [], focusAreas: [], equipment: [], instructorDisplayName: null }, sections: [] }
const response = {
  id, kind: 'session', status: 'draft', version: 2,
  proposal,
  messages: [], primaryAssetId: null, thumbnailAssetId: null, accessTier: null, resourceId: null, revisionId: null, missingFields: ['title'], updatedAt: new Date().toISOString(),
}
beforeEach(() => { request.mockReset(); request.mockResolvedValue(Response.json(response)) })

describe('content assistant API', () => {
  it('sends an idempotent message request to the scoped endpoint', async () => {
    await sendMessage(id, { expectedVersion: 1, requestId: id, message: 'Sesja oddechowa' })
    expect(request.mock.calls[0][0]).toBe(`/api/v1/admin/content-assistant/drafts/${id}/messages`)
    expect(JSON.parse(request.mock.calls[0][1]!.body as string)).toEqual({ expectedVersion: 1, requestId: id, message: 'Sesja oddechowa' })
  })

  it('persists only proposal, media and access selected by the operator', async () => {
    await updateDraft(id, { expectedVersion: 1, proposal, primaryAssetId: null, thumbnailAssetId: null, accessTier: 'premium' })
    const body = JSON.parse(request.mock.calls[0][1]!.body as string)
    expect(body).toMatchObject({ expectedVersion: 1, accessTier: 'premium' })
    expect(body).not.toHaveProperty('userId')
    expect(body).not.toHaveProperty('payment')
  })
})
