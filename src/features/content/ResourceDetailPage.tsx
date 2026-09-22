import { SessionAudioUpload } from '../media/SessionAudioUpload'
import { ThumbnailImageUpload } from '../media/ThumbnailImageUpload'
import { SessionVideoUpload } from '../media/SessionVideoUpload'
import { JsonPreview } from '../../components/forms/JsonPreview'
import ReplayOutlined from '@mui/icons-material/ReplayOutlined'
import { ResourceRevisionForm } from './ResourceRevisionForm'
import { ResourceMetadataForm } from './ResourceMetadataForm'
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormHelperText, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { type UseQueryResult, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { hasAnyPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../api/apiError'
import { assignResourceAsset, assignResourceAssetSchema, assignmentRoleSchema, fetchAssets, fetchResourceAssets, type AssignResourceAsset, type ResourceAsset } from '../media/mediaApi'
import { fetchResourceDetail, fetchResourceRevisionHistory } from './resourceApi'

function formatDate(value: string): string { return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }

export function ResourceDetailPage({ expectedType }: { expectedType: 'session' | 'material' }) {
  const { permissions } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { resourceId = '' } = useParams()
  const locale = searchParams.get('locale') ?? undefined
  const detailQuery = useQuery({ queryKey: ['resource', resourceId, locale], queryFn: ({ signal }) => fetchResourceDetail(resourceId, locale, signal) })
  const historyQuery = useQuery({ queryKey: ['resource-revisions', resourceId], queryFn: ({ signal }) => fetchResourceRevisionHistory(resourceId, signal), enabled: detailQuery.isSuccess })
  const canReadMedia = hasAnyPermission(permissions, ['media.read'])
  const assetsQuery = useQuery({ queryKey: ['resource-assets', resourceId], queryFn: ({ signal }) => fetchResourceAssets(resourceId, signal), enabled: detailQuery.isSuccess && canReadMedia })
  if (detailQuery.isPending) return <Box sx={{ p: { xs: 2, md: 4 } }}><Typography aria-live="polite">Ładowanie zasobu...</Typography></Box>
  if (detailQuery.isError) {
    const isNotFound = detailQuery.error instanceof ApiError && detailQuery.error.status === 404
    return <Box sx={{ maxWidth: 900, p: { xs: 2, md: 4 } }}><Alert action={!isNotFound && <Button color="inherit" onClick={() => void detailQuery.refetch()} startIcon={<ReplayOutlined />}>Spróbuj ponownie</Button>} severity="error">{isNotFound ? 'Nie znaleziono tego zasobu.' : 'Nie udało się pobrać zasobu.'}</Alert></Box>
  }
  const detail = detailQuery.data
  if (detail.resourceType !== expectedType) return <Box sx={{ maxWidth: 900, p: { xs: 2, md: 4 } }}><Alert severity="error">Nie znaleziono tego zasobu.</Alert></Box>
  const canEdit = hasAnyPermission(permissions, ['content.edit'])
  const displayedSnapshot = JSON.stringify(detail.currentRevision?.snapshot ?? {}, null, 2)
  const selectedLocale = locale ?? detail.defaultLocale
  return <Box sx={{ maxWidth: 1100, p: { xs: 2, md: 4 } }}>
    <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}><Box><Typography component="h1" variant="h3">{detail.translation.title}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{detail.canonicalKey}</Typography></Box><Stack direction="row" spacing={1}><Chip label={detail.status} /><Chip label={detail.accessTier} /></Stack></Stack>
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3, p: 2.5 }}><Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap' }}><Typography>Typ: {detail.resourceType}</Typography><Typography>Wersja: {detail.version}</Typography><Typography>Utworzono: {formatDate(detail.createdAt)}</Typography><Typography>Aktualizacja: {formatDate(detail.updatedAt)}</Typography><FormControl size="small" sx={{ minWidth: 160 }}><InputLabel>Język</InputLabel><Select label="Język" value={selectedLocale.toLowerCase()} onChange={(event) => { const next = new URLSearchParams(searchParams); next.set('locale', event.target.value); setSearchParams(next) }}><MenuItem value="pl">Polski</MenuItem><MenuItem value="en">Angielski</MenuItem><MenuItem value="pl-pl">Polski (Polska)</MenuItem><MenuItem value="en-us">Angielski (USA)</MenuItem></Select></FormControl></Stack></Paper>
    <Stack spacing={3}>{canEdit && <ResourceMetadataForm detail={detail} />}{canEdit && detail.session?.mediaKind === 'audio' && hasAnyPermission(permissions, ['media.upload']) && <SessionAudioUpload key={`audio-${resourceId}`} resourceId={resourceId} expectedRevisionId={detail.currentRevision?.revisionId} />}{canEdit && hasAnyPermission(permissions, ['media.upload']) && <ThumbnailImageUpload key={`image-${resourceId}`} resourceId={resourceId} expectedRevisionId={detail.currentRevision?.revisionId} currentUrl={assetsQuery.data?.find((item) => item.role === 'thumbnail' && item.locale === null && item.position === 0)?.asset.publicUrl} />}{canEdit && detail.session?.mediaKind === 'video' && hasAnyPermission(permissions, ['media.upload']) && <SessionVideoUpload key={resourceId} resourceId={resourceId} expectedRevisionId={detail.currentRevision?.revisionId} />}{canEdit && <ResourceRevisionForm key={`${resourceId}-${selectedLocale}`} detail={detail} />}<Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', p: 2.5 }}><Typography component="h2" variant="h5" sx={{ mb: 2 }}>Aktualna rewizja</Typography><TextField aria-label="Aktualny zrzut JSON" fullWidth multiline minRows={12} value={displayedSnapshot} slotProps={{ input: { readOnly: true } }} /></Paper>
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', p: 2.5 }}><Typography component="h2" variant="h5" sx={{ mb: 2 }}>Historia rewizji</Typography>{historyQuery.isPending && <Typography>Ładowanie historii...</Typography>}{historyQuery.isError && <Alert severity="error">Nie udało się pobrać historii rewizji.</Alert>}{historyQuery.isSuccess && historyQuery.data.length === 0 && <Typography color="text.secondary">Brak rewizji.</Typography>}{historyQuery.data?.map((revision) => <Typography key={revision.revisionId}>Wersja {revision.revisionNumber} - {formatDate(revision.createdAt)}{revision.note ? ` - ${revision.note}` : ''}</Typography>)}</Paper>
      {canReadMedia && <ResourceMediaSection assignmentsQuery={assetsQuery} resourceId={resourceId} revisionId={detail.currentRevision?.revisionId} />}
      </Stack>
  </Box>
}

function ResourceMediaSection({ assignmentsQuery, resourceId, revisionId }: { assignmentsQuery: UseQueryResult<ResourceAsset[], Error>; resourceId: string; revisionId?: string }) {
  const { permissions } = useAuth()
  const canAssign = hasAnyPermission(permissions, ['media.assign'])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingReplacement, setPendingReplacement] = useState<AssignResourceAsset>()
  const queryClient = useQueryClient()
  const assetsQuery = useQuery({ queryKey: ['assets', 'assignment-picker'], queryFn: ({ signal }) => fetchAssets({ pageSize: 100 }, signal), enabled: dialogOpen })
  const mutation = useMutation({ mutationFn: ({ request, replace }: { request: AssignResourceAsset; replace: boolean }) => assignResourceAsset(resourceId, request, replace), retry: false, onSuccess: async () => { setDialogOpen(false); setPendingReplacement(undefined); await Promise.all([['resource-assets', resourceId], ['resource', resourceId], ['resource-revisions', resourceId]].map((queryKey) => queryClient.invalidateQueries({ queryKey }))) } })
  const submit = (request: AssignResourceAsset) => {
    const locale = request.locale ?? null
    if (assignmentsQuery.data?.some((item) => item.role === request.role && item.locale === locale && item.position === request.position)) setPendingReplacement({ ...request, ...(revisionId ? { expectedRevisionId: revisionId } : {}) })
    else mutation.mutate({ request, replace: false })
  }
  return <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', p: 2.5 }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', mb: 2 }}><Typography component="h2" variant="h5">Media</Typography>{canAssign && <Button onClick={() => setDialogOpen(true)} variant="outlined">Przypisz zasób</Button>}</Stack>{assignmentsQuery.isPending && <Typography aria-live="polite">Ładowanie przypisanych zasobów...</Typography>}{assignmentsQuery.isError && <Alert action={<Button color="inherit" onClick={() => void assignmentsQuery.refetch()}>Spróbuj ponownie</Button>} severity="error">Nie udało się pobrać przypisanych zasobów.</Alert>}{assignmentsQuery.isSuccess && assignmentsQuery.data.length === 0 && <Typography color="text.secondary">Brak przypisanych zasobów.</Typography>}{assignmentsQuery.isSuccess && assignmentsQuery.data.length > 0 && <TableContainer><Table aria-label="Przypisane media"><TableHead><TableRow><TableCell>Rola</TableCell><TableCell>Język</TableCell><TableCell>Pozycja</TableCell><TableCell>Zasób</TableCell><TableCell>Typ</TableCell><TableCell>Dostawca</TableCell></TableRow></TableHead><TableBody>{assignmentsQuery.data.map((item) => <TableRow key={`${item.role}-${item.locale}-${item.position}`}><TableCell>{item.role}</TableCell><TableCell>{item.locale ?? '-'}</TableCell><TableCell>{item.position}</TableCell><TableCell>{item.asset.displayName ?? item.asset.externalId ?? item.asset.id}</TableCell><TableCell>{item.asset.kind}</TableCell><TableCell>{item.asset.provider}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}<AssignAssetDialog assets={assetsQuery.data?.items ?? []} error={mutation.isError} onClose={() => setDialogOpen(false)} onSubmit={submit} open={dialogOpen} pending={mutation.isPending} loadingAssets={assetsQuery.isPending} />{pendingReplacement && <Dialog onClose={mutation.isPending ? undefined : () => setPendingReplacement(undefined)} open><DialogTitle>Zastąpić przypisanie?</DialogTitle><DialogContent><Typography>Wskazana rola, język i pozycja mają już przypisany zasób. Zastąpienie zmieni bieżące przypisanie.</Typography></DialogContent><DialogActions><Button disabled={mutation.isPending} onClick={() => setPendingReplacement(undefined)}>Anuluj</Button><Button disabled={mutation.isPending} onClick={() => mutation.mutate({ request: pendingReplacement, replace: true })} variant="contained">Zastąp</Button></DialogActions></Dialog>}</Paper>
}

function AssignAssetDialog({ assets, error, loadingAssets, onClose, onSubmit, open, pending }: { assets: Awaited<ReturnType<typeof fetchAssets>>['items']; error: boolean; loadingAssets: boolean; onClose: () => void; onSubmit: (request: AssignResourceAsset) => void; open: boolean; pending: boolean }) {
  const [assetId, setAssetId] = useState('')
  const [role, setRole] = useState<AssignResourceAsset['role']>('primary')
  const [assignmentLocale, setAssignmentLocale] = useState('')
  const [position, setPosition] = useState('0')
  const [validationError, setValidationError] = useState<string>()
  const submit = () => { const parsed = assignmentRoleSchema.safeParse(role); const request = { assetId, role: parsed.success ? parsed.data : role, ...(assignmentLocale.trim() ? { locale: assignmentLocale.trim() } : {}), position: position.trim() === '' ? Number.NaN : Number(position) }; const valid = assignResourceAssetSchema.safeParse(request); if (valid.success) { setValidationError(undefined); onSubmit(valid.data) } else setValidationError('Wybierz zasób i podaj prawidłową pozycję.') }
  return <Dialog fullWidth maxWidth="sm" onClose={pending ? undefined : onClose} open={open}><DialogTitle>Przypisz zasób</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{loadingAssets && <Typography>Ładowanie zasobów...</Typography>}{!loadingAssets && <FormControl fullWidth error={Boolean(validationError && !assetId)}><InputLabel id="assignment-asset">Zasób</InputLabel><Select labelId="assignment-asset" label="Zasób" onChange={(event) => setAssetId(event.target.value)} value={assetId}>{assets.map((asset) => <MenuItem key={asset.id} value={asset.id}>{asset.displayName ?? asset.externalId ?? asset.id} ({asset.kind})</MenuItem>)}</Select>{validationError && !assetId && <FormHelperText>Wybierz zasób.</FormHelperText>}</FormControl>}<FormControl fullWidth><InputLabel id="assignment-role">Rola</InputLabel><Select labelId="assignment-role" label="Rola" onChange={(event) => setRole(event.target.value as AssignResourceAsset['role'])} value={role}><MenuItem value="primary">Główne</MenuItem><MenuItem value="thumbnail">Miniatura</MenuItem><MenuItem value="hero">Hero</MenuItem><MenuItem value="artwork">Grafika</MenuItem><MenuItem value="download">Pobranie</MenuItem><MenuItem value="subtitle">Napisy</MenuItem><MenuItem value="transcript">Transkrypcja</MenuItem></Select></FormControl><TextField label="Język (opcjonalnie)" onChange={(event) => setAssignmentLocale(event.target.value)} value={assignmentLocale} /><TextField error={Boolean(validationError && (!position.trim() || !Number.isSafeInteger(Number(position)) || Number(position) < 0))} helperText={validationError && (!position.trim() || !Number.isSafeInteger(Number(position)) || Number(position) < 0) ? 'Podaj nieujemną liczbę całkowitą.' : 'Pierwsza pozycja ma numer 0.'} label="Pozycja" onChange={(event) => setPosition(event.target.value)} slotProps={{ htmlInput: { min: 0 } }} type="number" value={position} /><JsonPreview label="Przypisanie mediów (JSON)" value={{ assetId, role, locale: assignmentLocale.trim() || undefined, position: position.trim() ? Number(position) : null }} />{validationError && <Alert severity="error">{validationError}</Alert>}{error && <Alert severity="error">Nie udało się zapisać przypisania. Stan zapisu jest nieznany.</Alert>}</Stack></DialogContent><DialogActions><Button disabled={pending} onClick={onClose}>Anuluj</Button><Button disabled={pending || loadingAssets || assets.length === 0} onClick={submit} variant="contained">Przypisz</Button></DialogActions></Dialog>
}





