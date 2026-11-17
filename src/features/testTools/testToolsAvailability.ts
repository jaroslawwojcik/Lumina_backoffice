import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { environment } from '../../app/environment'
import { fetchTestToolsStatus, isTestToolsUnavailableError } from './testToolsApi'

/**
 * Availability comes from `GET /api/v1/admin/test-tools/status`, never from guessing on other 404s.
 * - `production`: a PROD build never offers the tools and never calls the API for them.
 * - `checking`: status request in flight (or not requested because the caller lacks the permission).
 * - `enabled`: API answered 200; `apiEnvironment` is the environment name reported by the API.
 * - `disabled`: API answered 404 `test-tools-disabled`.
 * - `error`: status could not be determined (network, 401/403, 5xx, other 404).
 */
export type TestToolsAvailability =
  | { state: 'production' | 'checking' | 'disabled' }
  | { state: 'enabled'; apiEnvironment: string }
  | { state: 'error'; error: unknown; retry: () => void }

export const testToolsStatusQueryKey = ['test-tools', 'status'] as const

/** `active` should be false when the caller lacks `testtools.use`, so the status endpoint is not called for nothing. */
export function useTestToolsAvailability(active = true): TestToolsAvailability {
  const isProduction = environment.name === 'PROD'
  const query = useQuery({
    queryKey: testToolsStatusQueryKey,
    queryFn: ({ signal }) => fetchTestToolsStatus(signal),
    enabled: active && !isProduction,
    retry: false,
    staleTime: 60_000,
  })
  if (isProduction) return { state: 'production' }
  if (query.isError) return isTestToolsUnavailableError(query.error) ? { state: 'disabled' } : { state: 'error', error: query.error, retry: () => { void query.refetch() } }
  if (query.isSuccess) return query.data.enabled ? { state: 'enabled', apiEnvironment: query.data.environment } : { state: 'disabled' }
  return { state: 'checking' }
}

/** Mutation `onError` helper: a `test-tools-disabled` answer means the status changed mid-session, so re-check it. */
export function useTestToolsErrorReporter(): (error: unknown) => void {
  const queryClient = useQueryClient()
  return useCallback((error: unknown) => {
    if (isTestToolsUnavailableError(error)) void queryClient.invalidateQueries({ queryKey: testToolsStatusQueryKey })
  }, [queryClient])
}
