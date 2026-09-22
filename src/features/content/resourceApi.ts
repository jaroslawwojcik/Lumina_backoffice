import { z } from 'zod'
import { apiFetch } from '../../api/httpClient'

export const resourceListSearchSchema = z.object({
  search: z.string().trim().min(2).optional(),
  type: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  accessTier: z.string().min(1).optional(),
  locale: z.string().min(1).optional(),
  sort: z.string().min(1).optional(),
  pageSize: z.coerce.number().int().refine((value) => [25, 50, 100].includes(value)).optional(),
  cursor: z.string().min(1).optional(),
})

export type ResourceListSearch = z.infer<typeof resourceListSearchSchema>

const resourceSchema = z.object({
  resourceId: z.string(),
  canonicalKey: z.string(),
  title: z.string(),
  resourceType: z.string(),
  status: z.string(),
  accessTier: z.string(),
  defaultLocale: z.string(),
  currentRevisionNumber: z.number().int().nullable(),
  updatedAt: z.string(),
})

export type Resource = z.infer<typeof resourceSchema>

const resourceDetailSchema = z.object({
  resourceId: z.string(),
  canonicalKey: z.string(),
  resourceType: z.enum(['session', 'material', 'program']),
  status: z.string(),
  accessTier: z.string(),
  defaultLocale: z.string(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  translation: z.object({ locale: z.string(), slug: z.string(), title: z.string(), summary: z.string().nullable(), description: z.string().nullable(), seoTitle: z.string().nullable(), seoDescription: z.string().nullable() }),
  session: z.object({ mediaKind: z.string(), durationSeconds: z.number().int(), featured: z.boolean(), intensity: z.string().nullable() }).nullable(),
  material: z.object({ materialKind: z.string(), downloadable: z.boolean() }).nullable(),
  program: z.object({ level: z.string().nullable(), estimatedDays: z.number().int().nullable(), sortOrder: z.number().int(), featured: z.boolean() }).nullable().optional(),
  currentRevision: z.object({ revisionId: z.string(), revisionNumber: z.number().int(), note: z.string().nullable(), createdAt: z.string(), snapshot: z.record(z.string(), z.unknown()) }).nullable(),
})

export type ResourceDetail = z.infer<typeof resourceDetailSchema>

export const updateResourceSchema = z.object({
  resourceId: z.string().uuid(), expectedVersion: z.number().int().positive(), locale: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), title: z.string().trim().min(1),
  summary: z.string().nullable(), description: z.string().nullable(), seoTitle: z.string().nullable(), seoDescription: z.string().nullable(),
  accessTier: z.enum(['free', 'premium', 'purchase']), level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).nullable(),
  estimatedDays: z.number().int().positive().nullable(), sortOrder: z.number().int().nonnegative().nullable(), featured: z.boolean().nullable(), intensity: z.string().nullable(),
})
export type UpdateResource = z.infer<typeof updateResourceSchema>

const revisionHistorySchema = z.object({
  resourceId: z.string(),
  revisions: z.array(z.object({ revisionId: z.string(), revisionNumber: z.number().int(), note: z.string().nullable(), createdAt: z.string() })),
})

export type ResourceRevision = z.infer<typeof revisionHistorySchema>['revisions'][number]

const accessTierSchema = z.enum(['free', 'premium', 'purchase'])
const baseCreateResourceSchema = z.object({
  thumbnailAssetId: z.string().uuid().optional(),
  canonicalKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  locale: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  snapshot: z.record(z.string(), z.unknown()),
  accessTier: accessTierSchema.optional(),
})

export const createSessionSchema = baseCreateResourceSchema.extend({
  primaryAssetId: z.string().uuid().optional(),
  mediaKind: z.enum(['video', 'audio']),
  durationSeconds: z.number().int().positive(),
})

export const createMaterialSchema = baseCreateResourceSchema.extend({
  materialKind: z.enum(['pdf', 'audio', 'video', 'image', 'document']),
  downloadable: z.boolean(),
})

export type CreateSession = z.infer<typeof createSessionSchema>
export type CreateMaterial = z.infer<typeof createMaterialSchema>

const createResourceResponseSchema = z.object({
  resourceId: z.string().min(1),
  revisionId: z.string().min(1),
  revisionNumber: z.number().int().positive(),
})

export type CreateResourceResponse = z.infer<typeof createResourceResponseSchema>

const resourceListResponseSchema = z.object({
  items: z.array(resourceSchema),
  nextCursor: z.string().nullable().optional(),
})

function toSearchParams(search: ResourceListSearch): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) if (value !== undefined) params.set(key === 'type' ? 'resourceType' : key, String(value))
  return params
}

export async function fetchResources(search: ResourceListSearch, signal?: AbortSignal): Promise<{ items: Resource[]; nextCursor: string | null }> {
  const parsedSearch = resourceListSearchSchema.parse(search)
  const response = await apiFetch(`/api/v1/admin/resources?${toSearchParams(parsedSearch).toString()}`, { signal })
  const data = resourceListResponseSchema.parse(await response.json())
  return { items: data.items, nextCursor: data.nextCursor ?? null }
}

export async function fetchResourceDetail(resourceId: string, locale: string | undefined, signal?: AbortSignal): Promise<ResourceDetail> {
  const params = new URLSearchParams()
  if (locale) params.set('locale', locale)
  const response = await apiFetch(`/api/v1/admin/resources/${resourceId}?${params.toString()}`, { signal })
  return resourceDetailSchema.parse(await response.json())
}

export async function fetchResourceRevisionHistory(resourceId: string, signal?: AbortSignal): Promise<ResourceRevision[]> {
  const response = await apiFetch(`/api/v1/admin/resources/${resourceId}/revisions`, { signal })
  return revisionHistorySchema.parse(await response.json()).revisions.sort((first, second) => second.createdAt.localeCompare(first.createdAt))
}

export async function createResourceRevision(resource: Pick<ResourceDetail, 'resourceId' | 'resourceType'>, snapshot: Record<string, unknown>, note?: string): Promise<void> {
  const endpoint = resource.resourceType === 'session' ? 'sessions' : resource.resourceType === 'program' ? 'programs' : 'materials'
  await apiFetch(`/api/v1/admin/${endpoint}/${resource.resourceId}/revisions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resourceId: resource.resourceId, snapshot, note: note ?? null }) })
}

async function createResource(endpoint: 'sessions' | 'materials', payload: CreateSession | CreateMaterial): Promise<CreateResourceResponse> {
  const response = await apiFetch(`/api/v1/admin/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, summary: payload.summary ?? null, description: payload.description ?? null }) })
  return createResourceResponseSchema.parse(await response.json())
}

export async function createSession(payload: CreateSession): Promise<CreateResourceResponse> {
  return createResource('sessions', createSessionSchema.parse(payload))
}

export async function createMaterial(payload: CreateMaterial): Promise<CreateResourceResponse> {
  return createResource('materials', createMaterialSchema.parse(payload))
}

export async function updateResource(payload: UpdateResource): Promise<ResourceDetail> {
  const values = updateResourceSchema.parse(payload)
  const response = await apiFetch(`/api/v1/admin/resources/${values.resourceId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
  return resourceDetailSchema.parse(await response.json())
}


