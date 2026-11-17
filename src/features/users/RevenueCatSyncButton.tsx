import SyncOutlined from '@mui/icons-material/SyncOutlined'
import { Button } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { describeEntitlements } from './monetizationLabels'
import { syncUserRevenueCat, userQueryKeys } from './userApi'
import { revenueCatSyncErrorMessage } from './userFormat'

export type SyncFeedback = { severity: 'success' | 'error'; message: string }

/** Pulls the RevenueCat subscriber snapshot server-side and reconciles grants. Never optimistic: tabs refresh after the server answers. */
export function RevenueCatSyncButton({ userId, onResult }: { userId: string; onResult: (feedback: SyncFeedback) => void }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => syncUserRevenueCat(userId),
    retry: false,
    onSuccess: async (entitlements) => {
      await Promise.all([userQueryKeys.access(userId), userQueryKeys.subscriptions(userId), userQueryKeys.transactions(userId)].map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      onResult({ severity: 'success', message: `Zsynchronizowano z RevenueCat. ${describeEntitlements(entitlements)}` })
    },
    onError: (error) => onResult({ severity: 'error', message: revenueCatSyncErrorMessage(error) }),
  })
  return <Button disabled={mutation.isPending} onClick={() => mutation.mutate()} startIcon={<SyncOutlined />} variant="outlined">{mutation.isPending ? 'Synchronizowanie...' : 'Synchronizuj z RevenueCat'}</Button>
}
