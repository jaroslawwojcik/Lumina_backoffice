import { z } from 'zod'
import { apiFetch } from '../../api/httpClient'

const root = '/api/v1/admin/content-assistant'
export const proposalSchema = z.object({
  canonicalKey: z.string(), locale: z.literal('pl'), slug: z.string(), title: z.string(), summary: z.string().nullable(), description: z.string().nullable(),
  mediaKind: z.enum(['video', 'audio']).nullable(), durationSeconds: z.number().nullable(), level: z.string().nullable(), estimatedDays: z.number().nullable(),
  publicMetadata: z.object({ style: z.string().nullable(), intents: z.array(z.string()), focusAreas: z.array(z.string()), equipment: z.array(z.string()), instructorDisplayName: z.string().nullable() }),
  sections: z.array(z.object({ title: z.string(), description: z.string().nullable(), entries: z.array(z.object({ resourceId: z.string().uuid(), inheritProgramAccess: z.boolean(), isOptional: z.boolean() })) })),
})
export const draftSchema = z.object({
  id: z.string().uuid(), kind: z.enum(['session', 'program']), status: z.enum(['draft', 'saved', 'discarded']), version: z.number().int(), proposal: proposalSchema,
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })), primaryAssetId: z.string().uuid().nullable(), thumbnailAssetId: z.string().uuid().nullable(),
  accessTier: z.enum(['free', 'premium', 'purchase']).nullable(), resourceId: z.string().uuid().nullable(), revisionId: z.string().uuid().nullable(), missingFields: z.array(z.string()), updatedAt: z.string(),
})
export type AssistantDraft = z.infer<typeof draftSchema>
export type Proposal = z.infer<typeof proposalSchema>
export type Provider = { id: string; models: string[] }
export type MessageRequest = { expectedVersion: number; requestId: string; message: string }
export type DraftUpdate = Pick<AssistantDraft, 'proposal' | 'primaryAssetId' | 'thumbnailAssetId' | 'accessTier'> & { expectedVersion: number }
async function write(path: string, payload: unknown, method = 'POST'): Promise<AssistantDraft> {
  const response = await apiFetch(`${root}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  return draftSchema.parse(await response.json())
}
export async function fetchProviders(signal?: AbortSignal): Promise<Provider[]> { return z.array(z.object({ id: z.string(), models: z.array(z.string()) })).parse(await (await apiFetch(`${root}/providers`, { signal })).json()) }
export async function fetchDrafts(signal?: AbortSignal): Promise<AssistantDraft[]> { return z.array(draftSchema).parse(await (await apiFetch(`${root}/drafts`, { signal })).json()) }
export async function fetchDraft(id: string, signal?: AbortSignal): Promise<AssistantDraft> { return draftSchema.parse(await (await apiFetch(`${root}/drafts/${id}`, { signal })).json()) }
export const createDraft = (id: string, kind: AssistantDraft['kind']) => write('/drafts', { id, kind })
export const sendMessage = (id: string, request: MessageRequest) => write(`/drafts/${id}/messages`, request)
export const updateDraft = (id: string, request: DraftUpdate) => write(`/drafts/${id}`, request, 'PUT')
export const confirmDraft = (id: string, expectedVersion: number) => write(`/drafts/${id}/confirm`, { expectedVersion })
export const discardDraft = (id: string, expectedVersion: number) => write(`/drafts/${id}/discard`, { expectedVersion })
