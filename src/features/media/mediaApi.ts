import { z } from 'zod'
import { apiFetch } from '../../api/httpClient'

const assetKindSchema = z.enum(['image', 'video', 'audio', 'document', 'subtitle', 'transcript'])
const assetSchema = z.object({
  displayName: z.string().nullable().optional(),
  originalFileName: z.string().nullable().optional(),
  providerStatus: z.string().optional(),
  providerLibraryId: z.string().nullable().optional(),
  id: z.string().uuid(),
  kind: assetKindSchema,
  provider: z.string().min(1),
  externalId: z.string().nullable(),
  storageKey: z.string().nullable(),
  publicUrl: z.string().nullable(),
  mimeType: z.string().nullable(),
  bytes: z.number().int().nonnegative().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  createdAt: z.string(),
})

export type MediaAsset = z.infer<typeof assetSchema>
export const assetKindLabels: Record<MediaAsset['kind'], string> = { image: 'Obraz', video: 'Wideo', audio: 'Audio', document: 'Dokument', subtitle: 'Napisy', transcript: 'Transkrypcja' }

const assetListSchema = z.object({ items: z.array(assetSchema), nextCursor: z.string().nullable().optional() })

export const assetListSearchSchema = z.object({
  kind: assetKindSchema.optional(),
  pageSize: z.coerce.number().int().refine((value) => [25, 50, 100].includes(value)).optional(),
  cursor: z.string().min(1).optional(),
})

export type AssetListSearch = z.infer<typeof assetListSearchSchema>

export const registerAssetSchema = z.object({
  kind: assetKindSchema,
  provider: z.string().trim().min(1, 'Dostawca jest wymagany.'),
  externalId: z.string().trim().nullable().optional(),
  storageKey: z.string().trim().nullable().optional(),
  publicUrl: z.string().trim().nullable().optional(),
  displayName: z.string().trim().max(200, 'Nazwa może mieć do 200 znaków.').nullable().optional(),
  providerLibraryId: z.string().trim().nullable().optional(),
  verifyProvider: z.boolean().optional(),
  mimeType: z.string().trim().nullable().optional(),
  bytes: z.number().int().nonnegative().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  durationSeconds: z.number().int().nonnegative().nullable().optional(),
}).superRefine((value, ctx) => {
  if (!value.externalId && !value.storageKey && !value.publicUrl)
    ctx.addIssue({ code: 'custom', path: ['externalId'], message: 'Podaj identyfikator, klucz pliku lub adres URL.' })
  if (value.verifyProvider && (value.kind !== 'video' || value.provider !== 'bunny_stream' || !z.string().uuid().safeParse(value.externalId).success))
    ctx.addIssue({ code: 'custom', path: ['externalId'], message: 'Podaj identyfikator filmu Bunny w formacie UUID.' })
  if (value.providerLibraryId && !/^\d+$/.test(value.providerLibraryId) && value.kind === 'video')
    ctx.addIssue({ code: 'custom', path: ['providerLibraryId'], message: 'Identyfikator biblioteki musi być liczbą.' })
  if (value.mimeType && !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(value.mimeType))
    ctx.addIssue({ code: 'custom', path: ['mimeType'], message: 'Podaj poprawny typ MIME.' })
  if (value.publicUrl) {
    try {
      const url = new URL(value.publicUrl)
      if (!['https:', 'http:'].includes(url.protocol) || url.search || url.hash || url.username || url.password) throw new Error()
    } catch { ctx.addIssue({ code: 'custom', path: ['publicUrl'], message: 'Podaj publiczny adres HTTP(S) bez tokenów i parametrów.' }) }
  }
})

export type RegisterAsset = z.infer<typeof registerAssetSchema>

export const assignmentRoleSchema = z.enum(['thumbnail', 'hero', 'primary', 'artwork', 'download', 'subtitle', 'transcript'])
export const assignResourceAssetSchema = z.object({
  expectedRevisionId: z.string().uuid().optional(),
  assetId: z.string().uuid(),
  role: assignmentRoleSchema,
  locale: z.string().trim().min(1).optional(),
  position: z.number().int().nonnegative(),
})

export type AssignResourceAsset = z.infer<typeof assignResourceAssetSchema>

const resourceAssetSchema = z.object({ resourceId: z.string().uuid(), assetId: z.string().uuid(), role: assignmentRoleSchema, locale: z.string().nullable(), position: z.number().int().nonnegative(), asset: assetSchema })
export type ResourceAsset = z.infer<typeof resourceAssetSchema>
const resourceAssetListSchema = z.object({ resourceId: z.string().uuid(), items: z.array(resourceAssetSchema) })

export async function fetchAssets(search: AssetListSearch, signal?: AbortSignal): Promise<{ items: MediaAsset[]; nextCursor: string | null }> {
  const parsedSearch = assetListSearchSchema.parse(search)
  const params = new URLSearchParams()
  if (parsedSearch.pageSize) params.set('pageSize', String(parsedSearch.pageSize))
  if (parsedSearch.cursor) params.set('cursor', parsedSearch.cursor)
  if (parsedSearch.kind) params.set('kind', parsedSearch.kind)
  const response = await apiFetch(`/api/v1/admin/assets?${params.toString()}`, { signal })
  const data = assetListSchema.parse(await response.json())
  return { items: data.items, nextCursor: data.nextCursor ?? null }
}

export async function registerAsset(request: RegisterAsset): Promise<MediaAsset> {
  const payload = registerAssetSchema.parse(request)
  const response = await apiFetch('/api/v1/admin/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  return assetSchema.parse(await response.json())
}

export async function updateAsset(id: string, request: RegisterAsset): Promise<MediaAsset> {
  const payload = registerAssetSchema.parse(request)
  const response = await apiFetch(`/api/v1/admin/assets/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  return assetSchema.parse(await response.json())
}

export async function fetchAssetPreview(id: string, signal?: AbortSignal) {
  const response = await apiFetch(`/api/v1/admin/assets/${id}/preview`, { method: 'POST', signal })
  return z.object({ kind: z.enum(['video', 'audio']), url: z.string().url(), expiresAt: z.string() }).parse(await response.json())
}

export async function fetchResourceAssets(resourceId: string, signal?: AbortSignal): Promise<ResourceAsset[]> {
  const response = await apiFetch(`/api/v1/admin/resources/${resourceId}/assets`, { signal })
  return resourceAssetListSchema.parse(await response.json()).items
}

export async function assignResourceAsset(resourceId: string, request: AssignResourceAsset, replace: boolean): Promise<ResourceAsset> {
  const payload = assignResourceAssetSchema.parse(request)
  const response = await apiFetch(`/api/v1/admin/resources/${resourceId}/assets`, { method: replace ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, locale: payload.locale ?? null }) })
  return resourceAssetSchema.parse(await response.json())
}
