import DeleteSweepOutlined from '@mui/icons-material/DeleteSweepOutlined'
import { Alert, Box, Button, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/forms/ConfirmDialog'
import { userQueryKeys } from '../users/userApi'
import { apiErrorMessage, pickedUserLabel, type PickedUser } from '../users/userFormat'
import { clearTestAccess, isTestToolsUnavailableError } from './testToolsApi'
import { useTestToolsErrorReporter } from './testToolsAvailability'
import { ToolCard } from './ToolCard'

export function ClearAccessCard({ user }: { user: PickedUser | null }) {
  const queryClient = useQueryClient()
  const reportToolError = useTestToolsErrorReporter()
  const [confirming, setConfirming] = useState(false)
  const mutation = useMutation({
    mutationFn: (userId: string) => clearTestAccess(userId),
    retry: false,
    onSuccess: async (_, userId) => { setConfirming(false); await queryClient.invalidateQueries({ queryKey: userQueryKeys.detail(userId) }) },
    onError: reportToolError,
  })
  return <ToolCard description="Odbiera wszystkie uprawnienia ze źródeł „test” i „wsparcie”. Uprawnienia ze sklepów i PayU pozostają bez zmian." title="Wyczyść dostęp testowy">
    {!user && <Alert severity="info">Najpierw wybierz użytkownika testowego.</Alert>}
    {mutation.isSuccess && <Alert role="status" severity="success">Wyczyszczono dostęp testowy i wsparcia.</Alert>}
    <Box><Button color="error" disabled={!user || mutation.isPending} onClick={() => { mutation.reset(); setConfirming(true) }} startIcon={<DeleteSweepOutlined />} variant="outlined">Wyczyść dostęp</Button></Box>
    {confirming && user && <ConfirmDialog confirmLabel="Wyczyść dostęp" errorMessage={mutation.isError && !isTestToolsUnavailableError(mutation.error) ? apiErrorMessage(mutation.error, 'Nie udało się wyczyścić dostępu.') : undefined} onClose={() => setConfirming(false)} onConfirm={() => mutation.mutate(user.userId)} pending={mutation.isPending} title="Wyczyścić dostęp?">
      <Typography>Wszystkie uprawnienia testowe i nadane przez wsparcie użytkownika <strong>{pickedUserLabel(user)}</strong> zostaną odebrane. Operacji nie można cofnąć.</Typography>
    </ConfirmDialog>}
  </ToolCard>
}
