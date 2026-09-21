import { z } from 'zod'
import { apiFetch } from '../../api/httpClient'

const releaseRevisionSchema = z.object({
  resourceId: z.string().min(1),
  revisionId: z.string().min(1),
})

export const buildReleaseSchema = z.object({
  locale: z.string().trim().min(1),
  revisions: z.array(releaseRevisionSchema).min(1),
})

export type BuildReleaseRequest = z.infer<typeof buildReleaseSchema>

const buildReleaseResponseSchema = z.object({
  releaseId: z.string().min(1),
  locale: z.string().min(1),
  catalogStorageKey: z.string().min(1),
  catalogEtag: z.string().min(1),
})

export type BuildReleaseResponse = z.infer<typeof buildReleaseResponseSchema>

const activateReleaseResponseSchema = z.object({
  releaseId: z.string().min(1),
  locale: z.string().min(1),
  publishedAt: z.string().min(1),
})

export type ActivateReleaseResponse = z.infer<typeof activateReleaseResponseSchema>

export const releaseListSearchSchema = z.object({
  pageSize: z.coerce.number().int().refine((value) => [25, 50, 100].includes(value)).optional(),
  cursor: z.string().min(1).optional(),
})

export type ReleaseListSearch = z.infer<typeof releaseListSearchSchema>

const contentReleaseSchema = z.object({
  id: z.string().uuid(),
  locale: z.string().min(1),
  status: z.string().min(1),
  createdAt: z.string().min(1),
  publishedAt: z.string().min(1).nullable(),
  activatedAt: z.string().min(1).nullable(),
  itemCount: z.number().int().nonnegative(),
  catalogStorageKey: z.string().min(1).nullable(),
  catalogEtag: z.string().min(1).nullable(),
  isActive: z.boolean(),
})

export type ContentRelease = z.infer<typeof contentReleaseSchema>

const releaseListResponseSchema = z.object({
  items: z.array(contentReleaseSchema),
  nextCursor: z.string().min(1).nullable().optional(),
})

function toSearchParams(search: ReleaseListSearch): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) if (value !== undefined) params.set(key, String(value))
  return params
}

export async function fetchReleases(search: ReleaseListSearch, signal?: AbortSignal): Promise<{ items: ContentRelease[]; nextCursor: string | null }> {
  const parsedSearch = releaseListSearchSchema.parse(search)
  const response = await apiFetch(`/api/v1/admin/releases?${toSearchParams(parsedSearch).toString()}`, { signal })
  const data = releaseListResponseSchema.parse(await response.json())
  return { items: data.items, nextCursor: data.nextCursor ?? null }
}

export async function fetchReleaseDetail(releaseId: string, signal?: AbortSignal): Promise<ContentRelease> {
  const response = await apiFetch(`/api/v1/admin/releases/${releaseId}`, { signal })
  return contentReleaseSchema.parse(await response.json())
}

export async function buildRelease(request: BuildReleaseRequest): Promise<BuildReleaseResponse> {
  const payload = buildReleaseSchema.parse(request)
  const response = await apiFetch('/api/v1/admin/releases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return buildReleaseResponseSchema.parse(await response.json())
}

export async function activateRelease(releaseId: string): Promise<ActivateReleaseResponse> {
  const response = await apiFetch(`/api/v1/admin/releases/${releaseId}/activate`, { method: 'POST' })
  return activateReleaseResponseSchema.parse(await response.json())
}