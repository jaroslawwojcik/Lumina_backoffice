import { z } from 'zod'
import { apiFetch } from '../../api/httpClient'

const base = '/api/v1/admin/media/image-uploads'
const configuration = z.object({ enabled: z.boolean(), maximumBytes: z.number().positive(), mimeTypes: z.array(z.string()) })
const prepared = z.object({ ticket: z.string(), image: z.object({ publicUrl: z.string().url(), width: z.number().positive(), height: z.number().positive() }) })
const completed = z.object({ asset: z.object({ id: z.string().uuid(), publicUrl: z.string().url(), displayName: z.string(), providerStatus: z.literal('ready') }), resourceId: z.string().uuid().nullable(), revisionId: z.string().uuid().nullable() })
export type CompletedImage = z.infer<typeof completed>
export type PreparedImage = z.infer<typeof prepared>

export async function imageUploadConfiguration(signal?: AbortSignal) {
  return configuration.parse(await (await apiFetch(`${base}/configuration`, { signal })).json())
}
export async function uploadImage(file: File, displayName: string, signal: AbortSignal, resourceId?: string, expectedRevisionId?: string) {
  const body = new FormData()
  body.set('file', file)
  body.set('displayName', displayName.trim())
  if (resourceId) body.set('resourceId', resourceId)
  if (expectedRevisionId) body.set('expectedRevisionId', expectedRevisionId)
  return prepared.parse(await (await apiFetch(base, { method: 'POST', body, signal })).json())
}
export async function completeImageUpload(ticket: string, saveToLibrary = false) {
  return completed.parse(await (await apiFetch(`${base}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket, saveToLibrary }) })).json())
}
export function imageFileError(file: File, maximumBytes: number, mimeTypes: string[]) {
  if (!mimeTypes.includes(file.type)) return 'Wybierz obraz PNG lub JPEG. Film dodaj w osobnym polu wideo.'
  if (!file.size || file.size > maximumBytes) return `Obraz musi mieć od 1 bajta do ${Math.floor(maximumBytes / 1024 / 1024)} MB.`
  return undefined
}
