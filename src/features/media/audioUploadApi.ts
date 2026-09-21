import { z } from 'zod'
import { apiFetch } from '../../api/httpClient'

const base = '/api/v1/admin/media/audio-uploads'
const configuration = z.object({ enabled: z.boolean(), maximumBytes: z.number().positive(), mimeTypes: z.array(z.string()) })
const prepared = z.object({ ticket: z.string(), audio: z.object({ durationSeconds: z.number().int().positive(), bytes: z.number().positive(), mimeType: z.string() }) })
const completed = z.object({ asset: z.object({ id: z.string().uuid(), displayName: z.string(), durationSeconds: z.number().int().positive(), providerStatus: z.literal('ready') }), resourceId: z.string().uuid().nullable(), revisionId: z.string().uuid().nullable() })
export type CompletedAudio = z.infer<typeof completed>
export type PreparedAudio = z.infer<typeof prepared>
export async function audioUploadConfiguration(signal?: AbortSignal) {
  return configuration.parse(await (await apiFetch(`${base}/configuration`, { signal })).json())
}
export async function uploadAudio(file: File, displayName: string, signal: AbortSignal, resourceId?: string, expectedRevisionId?: string) {
  const body = new FormData()
  body.set('file', file); body.set('displayName', displayName.trim())
  if (resourceId) body.set('resourceId', resourceId)
  if (expectedRevisionId) body.set('expectedRevisionId', expectedRevisionId)
  return prepared.parse(await (await apiFetch(base, { method: 'POST', body, signal })).json())
}
export async function completeAudioUpload(ticket: string, saveToLibrary = false) {
  return completed.parse(await (await apiFetch(`${base}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket, saveToLibrary }) })).json())
}
export function audioFileError(file: File, maximumBytes: number, mimeTypes: string[]) {
  if (!mimeTypes.includes(file.type)) return 'Wybierz nagranie MP3 lub M4A (AAC).'
  if (!file.size || file.size > maximumBytes) return `Nagranie musi mieć od 1 bajta do ${Math.floor(maximumBytes / 1024 / 1024)} MB.`
  return undefined
}
