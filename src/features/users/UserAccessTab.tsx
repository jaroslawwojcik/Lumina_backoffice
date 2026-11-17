import AddOutlined from '@mui/icons-material/AddOutlined'
import { Alert, Button, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ReasonConfirmDialog } from '../../components/forms/ReasonConfirmDialog'
import { GrantAccessDialog } from './GrantAccessDialog'
import { grantScopeLabels, labelFor, providerLabels } from './monetizationLabels'
import { RevenueCatSyncButton, type SyncFeedback } from './RevenueCatSyncButton'
import { fetchUserAccess, revokeUserAccessGrant, userQueryKeys, type AdminUserAccessGrant } from './userApi'
import { accessMutationErrorMessage, formatDate, isPast } from './userFormat'
import { QueryPanel } from './UserTabPanels'

function grantStatus(grant: AdminUserAccessGrant): { label: string; color: 'success' | 'default' | 'warning' } {
  if (grant.revokedAt) return { label: 'Cofnięty', color: 'default' }
  if (isPast(grant.validUntil)) return { label: 'Wygasł', color: 'default' }
  if (!isPast(grant.validFrom)) return { label: 'Zaplanowany', color: 'warning' }
  return { label: 'Aktywny', color: 'success' }
}

function grantSubject(grant: AdminUserAccessGrant): string { return grant.entitlementKey ?? grant.resourceKey ?? grant.resourceId ?? grant.scope }

export function UserAccessTab({ userId, canGrant }: { userId: string; canGrant: boolean }) {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: userQueryKeys.access(userId), queryFn: ({ signal }) => fetchUserAccess(userId, signal) })
  const [grantOpen, setGrantOpen] = useState(false)
  const [revoking, setRevoking] = useState<AdminUserAccessGrant>()
  const [feedback, setFeedback] = useState<SyncFeedback>()
  const revokeMutation = useMutation({
    mutationFn: ({ grantId, reason }: { grantId: string; reason: string }) => revokeUserAccessGrant(userId, grantId, reason),
    retry: false,
    onSuccess: async (grant) => {
      setRevoking(undefined)
      setFeedback({ severity: 'success', message: `Odebrano dostęp: ${grantSubject(grant)}.` })
      await Promise.all([queryClient.invalidateQueries({ queryKey: userQueryKeys.access(userId) }), queryClient.invalidateQueries({ queryKey: userQueryKeys.transactions(userId) })])
    },
  })
  return <Stack spacing={2}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
      <Typography component="h2" variant="h5">Dostęp</Typography>
      {canGrant && <Stack direction="row" spacing={1}><RevenueCatSyncButton onResult={setFeedback} userId={userId} /><Button onClick={() => { setFeedback(undefined); setGrantOpen(true) }} startIcon={<AddOutlined />} variant="contained">Nadaj dostęp</Button></Stack>}
    </Stack>
    {feedback && <Alert onClose={() => setFeedback(undefined)} role={feedback.severity === 'error' ? 'alert' : 'status'} severity={feedback.severity}>{feedback.message}</Alert>}
    <QueryPanel query={query} empty="Brak aktywnego lub historycznego dostępu do wyświetlenia." failure="Nie udało się pobrać dostępu użytkownika." render={(data) => <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}><Table aria-label="Dostęp użytkownika"><TableHead><TableRow><TableCell>Zakres</TableCell><TableCell>Źródło</TableCell><TableCell>Obowiązuje</TableCell><TableCell>Status</TableCell>{canGrant && <TableCell align="right">Działania</TableCell>}</TableRow></TableHead><TableBody>{data.items.map((item) => { const status = grantStatus(item); return <TableRow key={item.grantId}>
      <TableCell><Typography sx={{ fontWeight: 600 }}>{grantSubject(item)}</Typography><Typography color="text.secondary" variant="body2">{labelFor(grantScopeLabels, item.scope)}</Typography></TableCell>
      <TableCell>{labelFor(providerLabels, item.source)}</TableCell>
      <TableCell>{formatDate(item.validFrom)} – {item.validUntil ? formatDate(item.validUntil) : 'bezterminowo'}</TableCell>
      <TableCell><Chip color={status.color} label={status.label} size="small" />{item.revokedAt && <Typography color="text.secondary" sx={{ mt: .5 }} variant="body2">{formatDate(item.revokedAt)}{item.revokeReason ? ` · Powód: ${item.revokeReason}` : ''}</Typography>}</TableCell>
      {canGrant && <TableCell align="right">{!item.revokedAt && <Button aria-label={`Odbierz dostęp ${grantSubject(item)}`} color="error" disabled={revokeMutation.isPending} onClick={() => { revokeMutation.reset(); setFeedback(undefined); setRevoking(item) }}>Odbierz</Button>}</TableCell>}
    </TableRow> })}</TableBody></Table></TableContainer>} />
    {grantOpen && <GrantAccessDialog onClose={() => setGrantOpen(false)} onGranted={(grant) => { setGrantOpen(false); setFeedback({ severity: 'success', message: `Nadano dostęp: ${grantSubject(grant)}.` }) }} userId={userId} />}
    {revoking && <ReasonConfirmDialog confirmLabel="Odbierz dostęp" errorMessage={revokeMutation.isError ? accessMutationErrorMessage(revokeMutation.error, 'Nie udało się odebrać dostępu. Stan zapisu jest nieznany.') : undefined} onClose={() => setRevoking(undefined)} onConfirm={(reason) => revokeMutation.mutate({ grantId: revoking.grantId, reason })} pending={revokeMutation.isPending} title="Odebrać dostęp?">
      <Typography>Odbierzesz dostęp <strong>{grantSubject(revoking)}</strong> (źródło: {labelFor(providerLabels, revoking.source)}). Zmiana działa natychmiast.</Typography>
      <Alert severity="warning">{revoking.source === 'revenuecat' ? 'To uprawnienie pochodzi ze sklepu (RevenueCat). Jeśli zakup lub subskrypcja są nadal ważne, kolejna synchronizacja utworzy je ponownie. Trwałe zakończenie wymaga zwrotu lub anulowania w sklepie.' : 'Uprawnienia ze sklepów (App Store, Google Play) mogą zostać ponownie utworzone przez synchronizację z RevenueCat, jeśli zakup jest nadal ważny.'}</Alert>
    </ReasonConfirmDialog>}
  </Stack>
}
