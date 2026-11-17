import { ApiError } from '../../api/apiError'

export function formatDate(value: string | null): string { return value ? new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value)) : 'Brak' }

export function apiErrorMessage(error: unknown, fallback: string): string { return error instanceof ApiError ? error.message : fallback }

/** Grant/revoke: 400 invalid reason, unknown resource or past end date; 404 unknown user or grant (server details are English). */
export function accessMutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 400) return 'Dane odrzucone: sprawdź powód (5–500 znaków), wybrany zasób i datę końca (musi być w przyszłości).'
  if (error instanceof ApiError && error.status === 404) return 'Nie znaleziono użytkownika lub uprawnienia. Odśwież dane i spróbuj ponownie.'
  return apiErrorMessage(error, fallback)
}

/** `POST /admin/users/{id}/revenuecat/sync`: 404 unknown user or no syncable account, 503 RevenueCat unavailable (retry is safe). */
export function revenueCatSyncErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) return 'Nie można zsynchronizować: użytkownik nie istnieje lub nie ma konta powiązanego z RevenueCat.'
  if (error instanceof ApiError && error.status === 503) return 'RevenueCat jest chwilowo niedostępny. Synchronizacja nie została wykonana — spróbuj ponownie później.'
  return apiErrorMessage(error, 'Nie udało się zsynchronizować z RevenueCat.')
}

export function isPast(value: string | null, now = Date.now()): boolean { return value !== null && new Date(value).getTime() <= now }

export type PickedUser = { userId: string; email: string | null; displayName: string | null }

export function pickedUserLabel(user: PickedUser): string { return [user.displayName, user.email].filter(Boolean).join(' · ') || user.userId }
