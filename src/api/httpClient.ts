import { environment } from '../app/environment'
import { getFirebaseAuth } from '../auth/firebase'
import { ApiError } from './apiError'

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!environment.apiBaseUrl) throw new ApiError('Ustaw VITE_API_BASE_URL w pliku .env.local i uruchom ponownie aplikację.')
  const url = new URL(path, environment.apiBaseUrl)
  if (url.origin !== new URL(environment.apiBaseUrl).origin) throw new ApiError('Nieprawidłowy adres żądania API.')
  const token = await getFirebaseAuth()?.currentUser?.getIdToken()
  if (!token) throw new ApiError('Zaloguj się, aby połączyć się z API.', 401)
  const correlationId = crypto.randomUUID()
  const headers = new Headers(init.headers)
  headers.set('X-Correlation-Id', correlationId)
  headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  try { response = await fetch(url, { ...init, headers, redirect: 'error' }) }
  catch (error) {
    if (init.signal?.aborted || error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('Nie można połączyć się z API. Sprawdź adres serwera, jego uruchomienie i konfigurację CORS.', undefined, correlationId)
  }
  if (!response.ok) {
    const problem = await response.json().catch(() => undefined) as { detail?: string; title?: string } | undefined
    const message = response.status === 401 ? 'Sesja wygasła lub token pochodzi z innego projektu Firebase. Zaloguj się ponownie.'
      : response.status === 403 ? 'Konto nie ma dostępu administratora do API.'
        : problem?.detail ?? problem?.title ?? `API zwróciło błąd ${response.status}.`
    throw new ApiError(message, response.status, correlationId)
  }
  return response
}
