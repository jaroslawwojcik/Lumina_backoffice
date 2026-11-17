import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined'
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/forms/ConfirmDialog'
import { labelFor, subscriptionStatusLabels } from '../users/monetizationLabels'
import { fetchUserSubscriptions, userQueryKeys } from '../users/userApi'
import { apiErrorMessage, formatDate, type PickedUser } from '../users/userFormat'
import { isTestToolsUnavailableError, simulateSubscriptionEvent, subscriptionEvents, type SubscriptionEvent } from './testToolsApi'
import { useTestToolsErrorReporter } from './testToolsAvailability'
import { ToolCard } from './ToolCard'

const eventLabels: Record<SubscriptionEvent, string> = { cancel: 'Anulowanie (wyłączenie odnawiania)', uncancel: 'Przywrócenie odnawiania', billing_issue: 'Problem z płatnością', expire: 'Wygaśnięcie', refund: 'Zwrot', renew: 'Odnowienie' }

export function SimulateSubscriptionCard({ user }: { user: PickedUser | null }) {
  const queryClient = useQueryClient()
  const reportToolError = useTestToolsErrorReporter()
  const userId = user?.userId ?? ''
  const subscriptions = useQuery({ queryKey: userQueryKeys.subscriptions(userId), queryFn: ({ signal }) => fetchUserSubscriptions(userId, signal), enabled: Boolean(user) })
  const testSubscriptions = (subscriptions.data ?? []).filter((item) => item.provider === 'test')
  const [subscriptionId, setSubscriptionId] = useState('')
  const [event, setEvent] = useState<SubscriptionEvent>('renew')
  const [confirming, setConfirming] = useState(false)
  const selected = testSubscriptions.find((item) => item.subscriptionId === subscriptionId)
  const mutation = useMutation({
    mutationFn: (request: { subscriptionId: string; event: SubscriptionEvent }) => simulateSubscriptionEvent(request.subscriptionId, request.event),
    retry: false,
    onSuccess: async () => { setConfirming(false); await queryClient.invalidateQueries({ queryKey: userQueryKeys.detail(userId) }) },
    onError: reportToolError,
  })
  return <ToolCard description="Zmienia stan subskrypcji testowej (dostawca „test”) tak, jak zrobiłby to sklep. Prawdziwych subskrypcji nie można tu zmieniać." title="Symuluj zdarzenie subskrypcji">
    {!user && <Alert severity="info">Najpierw wybierz użytkownika testowego.</Alert>}
    {user && subscriptions.isPending && <Typography aria-live="polite">Ładowanie subskrypcji...</Typography>}
    {user && subscriptions.isError && <Alert action={<Button color="inherit" onClick={() => void subscriptions.refetch()}>Spróbuj ponownie</Button>} severity="error">{apiErrorMessage(subscriptions.error, 'Nie udało się pobrać subskrypcji użytkownika.')}</Alert>}
    {user && subscriptions.isSuccess && testSubscriptions.length === 0 && <Alert severity="info">Użytkownik nie ma subskrypcji testowych. Zasymuluj zakup produktu typu „Subskrypcja”.</Alert>}
    {testSubscriptions.length > 0 && <>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField disabled={mutation.isPending} label="Subskrypcja testowa" onChange={(changeEvent) => { setSubscriptionId(changeEvent.target.value); mutation.reset() }} select sx={{ minWidth: 300, flex: 2 }} value={selected ? subscriptionId : ''}>
          {testSubscriptions.map((item) => <MenuItem key={item.subscriptionId} value={item.subscriptionId}>{item.productTitle ?? item.storeProductId} — {labelFor(subscriptionStatusLabels, item.status)} (do {formatDate(item.currentPeriodEnd)})</MenuItem>)}
        </TextField>
        <TextField disabled={mutation.isPending} label="Zdarzenie" onChange={(changeEvent) => { setEvent(changeEvent.target.value as SubscriptionEvent); mutation.reset() }} select sx={{ minWidth: 240, flex: 1 }} value={event}>
          {subscriptionEvents.map((value) => <MenuItem key={value} value={value}>{eventLabels[value]}</MenuItem>)}
        </TextField>
      </Stack>
      {mutation.isSuccess && <Alert role="status" severity="success">Zdarzenie zastosowane. Nowy status: {labelFor(subscriptionStatusLabels, mutation.data.status)}, okres do {formatDate(mutation.data.currentPeriodEnd)}.</Alert>}
      <Box><Button disabled={!selected || mutation.isPending} onClick={() => { mutation.reset(); setConfirming(true) }} startIcon={<EventRepeatOutlined />} variant="contained">Symuluj zdarzenie</Button></Box>
    </>}
    {confirming && selected && <ConfirmDialog confirmLabel="Zastosuj zdarzenie" errorMessage={mutation.isError && !isTestToolsUnavailableError(mutation.error) ? apiErrorMessage(mutation.error, 'Nie udało się zastosować zdarzenia.') : undefined} onClose={() => setConfirming(false)} onConfirm={() => mutation.mutate({ subscriptionId: selected.subscriptionId, event })} pending={mutation.isPending} title="Zastosować zdarzenie?">
      <Typography>Zdarzenie „{eventLabels[event]}” zmieni subskrypcję „{selected.productTitle ?? selected.storeProductId}” i powiązany dostęp Premium użytkownika.</Typography>
    </ConfirmDialog>}
  </ToolCard>
}
