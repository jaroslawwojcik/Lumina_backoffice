import { z } from 'zod'
import { apiFetch } from '../../api/httpClient'

const base = '/api/v1/admin/media/video-uploads'
const configurationSchema = z.object({ enabled: z.boolean(), maximumBytes: z.number().positive(), mimeTypes: z.array(z.string()) })
const preparedSchema = z.object({ ticket: z.string(), credentials: z.object({ endpoint: z.literal('https://video.bunnycdn.com/tusupload'), libraryId: z.string(), videoId: z.string().uuid(), signature: z.string(), expiresAt: z.number() }) })
const statusSchema = z.object({ status: z.enum(['processing', 'ready', 'failed']), encodeProgress: z.number(), durationSeconds: z.number().nullable(), width: z.number().nullable(), height: z.number().nullable() })
const completedSchema = z.object({ asset: z.object({ id: z.string().uuid(), displayName: z.string(), durationSeconds: z.number().int().positive(), providerStatus: z.literal('ready') }), resourceId: z.string().uuid().nullable(), revisionId: z.string().uuid().nullable() })
export type CompletedVideo = z.infer<typeof completedSchema>
export type PreparedVideo = z.infer<typeof preparedSchema>
export async function videoUploadConfiguration(signal?: AbortSignal) { return configurationSchema.parse(await (await apiFetch(`${base}/configuration`, { signal })).json()) }
export async function prepareVideoUpload(file: File, displayName: string, resourceId?: string, expectedRevisionId?: string) {
  return preparedSchema.parse(await (await apiFetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: displayName.trim(), originalFileName: file.name, mimeType: file.type, sizeBytes: file.size, resourceId: resourceId ?? null, expectedRevisionId: expectedRevisionId ?? null }) })).json())
}
export async function videoUploadStatus(ticket: string, signal?: AbortSignal) {
  return statusSchema.parse(await (await apiFetch(`${base}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket }), signal })).json())
}
export async function completeVideoUpload(ticket: string, saveToLibrary = false) {
  return completedSchema.parse(await (await apiFetch(`${base}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket, saveToLibrary }) })).json())
}
export function videoFileError(file: File, maximumBytes: number, mimeTypes: string[]): string | undefined {
  if (!mimeTypes.includes(file.type)) return 'Wybierz obsługiwany plik wideo (MP4, MOV, WebM, MKV lub AVI).'
  if (!file.size || file.size > maximumBytes) return `Plik musi mieć od 1 bajta do ${Math.floor(maximumBytes / 1024 / 1024)} MB.`
  return undefined
}
