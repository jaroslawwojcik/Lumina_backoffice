import { Alert, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { commerceEnvironmentLabels, labelFor, providerLabels, storeLabels, subscriptionStatusColor, subscriptionStatusLabels } from './monetizationLabels'
import { RevenueCatSyncButton, type SyncFeedback } from './RevenueCatSyncButton'
import { fetchUserSubscriptions, userQueryKeys, type AdminUserSubscription } from './userApi'
import { formatDate } from './userFormat'
import { QueryPanel } from './UserTabPanels'

function SubscriptionRow({ item }: { item: AdminUserSubscription }) {
  return <TableRow>
    <TableCell><Typography sx={{ fontWeight: 600 }}>{item.productTitle ?? item.storeProductId}</Typography><Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }} variant="body2">{item.storeProductId} · {item.entitlementKey}</Typography></TableCell>
    <TableCell><Stack spacing={.5} sx={{ alignItems: 'flex-start' }}><span>{labelFor(storeLabels, item.store)} ({labelFor(providerLabels, item.provider)})</span>{item.environment !== 'production' && <Chip color="warning" label={labelFor(commerceEnvironmentLabels, item.environment)} size="small" variant="outlined" />}</Stack></TableCell>
    <TableCell><Chip color={subscriptionStatusColor(item.status)} label={labelFor(subscriptionStatusLabels, item.status)} size="small" /><Typography color="text.secondary" sx={{ mt: .5 }} variant="body2">{item.willRenew ? 'Odnawia się automatycznie' : 'Bez odnowienia'}</Typography></TableCell>
    <TableCell>{formatDate(item.currentPeriodStart)} – {formatDate(item.currentPeriodEnd)}{item.gracePeriodEnd && <Typography color="text.secondary" variant="body2">Karencja do {formatDate(item.gracePeriodEnd)}</Typography>}</TableCell>
    <TableCell>{[item.billingIssueDetectedAt && `Problem z płatnością: ${formatDate(item.billingIssueDetectedAt)}`, item.cancelledAt && `Anulowano: ${formatDate(item.cancelledAt)}`, item.refundedAt && `Zwrot: ${formatDate(item.refundedAt)}`].filter(Boolean).map((text) => <Typography key={String(text)} variant="body2">{text}</Typography>)}</TableCell>
    <TableCell>{formatDate(item.lastSyncedAt)}</TableCell>
  </TableRow>
}

export function UserSubscriptionsTab({ userId, canSync }: { userId: string; canSync: boolean }) {
  const query = useQuery({ queryKey: userQueryKeys.subscriptions(userId), queryFn: ({ signal }) => fetchUserSubscriptions(userId, signal) })
  const [feedback, setFeedback] = useState<SyncFeedback>()
  return <Stack spacing={2}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
      <Typography component="h2" variant="h5">Subskrypcje</Typography>
      {canSync && <RevenueCatSyncButton onResult={setFeedback} userId={userId} />}
    </Stack>
    <Typography color="text.secondary">Stan subskrypcji pochodzi od dostawcy płatności. Panel go nie zmienia — użyj synchronizacji, aby pobrać aktualny stan z RevenueCat.</Typography>
    {feedback && <Alert onClose={() => setFeedback(undefined)} role={feedback.severity === 'error' ? 'alert' : 'status'} severity={feedback.severity}>{feedback.message}</Alert>}
    <QueryPanel query={query} empty="Użytkownik nie ma subskrypcji." failure="Nie udało się pobrać subskrypcji użytkownika." render={(items) => <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}><Table aria-label="Subskrypcje użytkownika"><TableHead><TableRow><TableCell>Produkt</TableCell><TableCell>Sklep</TableCell><TableCell>Status</TableCell><TableCell>Bieżący okres (UTC)</TableCell><TableCell>Zdarzenia</TableCell><TableCell>Ostatnia synchronizacja</TableCell></TableRow></TableHead><TableBody>{items.map((item) => <SubscriptionRow item={item} key={item.subscriptionId} />)}</TableBody></Table></TableContainer>} />
  </Stack>
}
