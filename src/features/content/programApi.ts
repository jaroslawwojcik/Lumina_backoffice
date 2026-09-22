import { z } from 'zod'
import { apiFetch } from '../../api/httpClient'

const accessTierSchema = z.enum(['free', 'premium', 'purchase'])
const sectionEntrySchema = z.object({ resourceId: z.string().uuid(), inheritProgramAccess: z.boolean(), isOptional: z.boolean() })

export const createProgramSchema = z.object({
  canonicalKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  locale: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  level: z.string().trim().min(1).optional(),
  estimatedDays: z.number().int().positive().optional(),
  snapshot: z.record(z.string(), z.unknown()),
  accessTier: accessTierSchema.optional(),
})

export type CreateProgram = z.infer<typeof createProgramSchema>

const createProgramResponseSchema = z.object({ resourceId: z.string().uuid(), revisionId: z.string().uuid(), revisionNumber: z.number().int().positive() })
export type CreateProgramResponse = z.infer<typeof createProgramResponseSchema>

const programDraftSchema = z.object({
  programId: z.string().uuid(),
  canonicalKey: z.string(),
  status: z.string(),
  locale: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  description: z.string().nullable(),
  level: z.string().nullable(),
  estimatedDays: z.number().int().nullable(),
  version: z.number().int().positive().default(1),
  accessTier: accessTierSchema.default('free'),
  sortOrder: z.number().int().nonnegative().default(0),
  featured: z.boolean().default(false),
  seoTitle: z.string().nullable().default(null),
  seoDescription: z.string().nullable().default(null),
  currentRevisionSnapshot: z.record(z.string(), z.unknown()).nullable().default(null),
  sections: z.array(z.object({
    sectionId: z.string().uuid(),
    position: z.number().int(),
    title: z.string(),
    description: z.string().nullable(),
    entries: z.array(z.object({
      entryId: z.string().uuid(),
      resourceId: z.string().uuid(),
      canonicalKey: z.string(),
      resourceType: z.string(),
      position: z.number().int(),
      inheritProgramAccess: z.boolean(),
      isOptional: z.boolean(),
    })),
  })),
})

export type ProgramDraft = z.infer<typeof programDraftSchema>

const sectionPayloadSchema = z.object({
  programId: z.string().uuid(),
  locale: z.string().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  entries: z.array(sectionEntrySchema).min(1).refine((entries) => new Set(entries.map((entry) => entry.resourceId)).size === entries.length),
})

export type ProgramSectionPayload = z.infer<typeof sectionPayloadSchema>

export async function createProgram(payload: CreateProgram): Promise<CreateProgramResponse> {
  const values = createProgramSchema.parse(payload)
  const parsed = { ...values, summary: values.summary ?? null, description: values.description ?? null, level: values.level ?? null, estimatedDays: values.estimatedDays ?? null }
  const response = await apiFetch('/api/v1/admin/programs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) })
  return createProgramResponseSchema.parse(await response.json())
}

export async function fetchProgramDraft(programId: string, locale: string, signal?: AbortSignal): Promise<ProgramDraft> {
  const params = new URLSearchParams({ locale })
  const response = await apiFetch(`/api/v1/admin/programs/${programId}?${params.toString()}`, { signal })
  return programDraftSchema.parse(await response.json())
}

export async function createProgramSection(payload: ProgramSectionPayload): Promise<void> {
  const values = sectionPayloadSchema.parse(payload)
  const parsed = { ...values, description: values.description ?? null }
  await apiFetch(`/api/v1/admin/programs/${parsed.programId}/sections`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) })
}

export async function replaceProgramSection(sectionId: string, payload: ProgramSectionPayload): Promise<void> {
  const values = sectionPayloadSchema.parse(payload)
  const parsed = { ...values, description: values.description ?? null }
  await apiFetch(`/api/v1/admin/programs/${parsed.programId}/sections/${sectionId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...parsed, sectionId }) })
}

export async function deleteProgramSection(programId: string, sectionId: string): Promise<void> {
  await apiFetch(`/api/v1/admin/programs/${programId}/sections/${sectionId}`, { method: 'DELETE' })
}

export async function reorderProgramSections(programId: string, sectionIds: string[]): Promise<void> {
  const payload = z.object({ programId: z.string().uuid(), sectionIds: z.array(z.string().uuid()).min(1) }).parse({ programId, sectionIds })
  await apiFetch(`/api/v1/admin/programs/${programId}/sections/order`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
}

