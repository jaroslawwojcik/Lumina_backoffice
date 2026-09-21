import { JsonPreview } from '../../components/forms/JsonPreview'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import PublishOutlined from '@mui/icons-material/PublishOutlined'
import { Alert, Box, Button, Checkbox, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { useMutation, useQueries, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { hasAnyPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/useAuth'
import { fetchResourceDetail, fetchResources, type Resource } from '../content/resourceApi'
import { activateRelease, buildRelease, type BuildReleaseRequest, type BuildReleaseResponse } from './releaseApi'

const locales = [{ value: 'pl', label: 'Polski' }, { value: 'en', label: 'Angielski' }] as const

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function ReleaseComposerPage() {
  const { permissions } = useAuth()
  const [locale, setLocale] = useState('pl')
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([])
  const [release, setRelease] = useState<BuildReleaseResponse>()
  const resourcesQuery = useQuery({ queryKey: ['resources', 'release-composer', locale], queryFn: ({ signal }) => fetchResources({ locale, pageSize: 100, sort: 'title:asc' }, signal) })
  const selectedResources = (resourcesQuery.data?.items ?? []).filter((resource) => selectedResourceIds.includes(resource.resourceId))
  const detailQueries = useQueries({ queries: selectedResources.map((resource) => ({ queryKey: ['resource', resource.resourceId, locale], queryFn: ({ signal }: { signal: AbortSignal }) => fetchResourceDetail(resource.resourceId, locale, signal), retry: false })) })
  const currentRevisions = selectedResources.map((resource, index) => ({ resource, detail: detailQueries[index]?.data, isPending: detailQueries[index]?.isPending ?? false })).filter(({ resource, detail }) => detail?.currentRevision && detail.currentRevision.revisionNumber === resource.currentRevisionNumber)
  const missingRevisionCount = selectedResources.length - currentRevisions.length
  const buildMutation = useMutation({ mutationFn: (request: BuildReleaseRequest) => buildRelease(request), retry: false, onSuccess: setRelease })
  const activateMutation = useMutation({ mutationFn: (releaseId: string) => activateRelease(releaseId), retry: false })
  const canActivate = hasAnyPermission(permissions, ['release.activate'])
  const canSubmit = selectedResources.length > 0 && missingRevisionCount === 0 && !buildMutation.isPending && !release

  const toggleResource = (resource: Resource) => {
    if (resource.currentRevisionNumber === null) return
    setSelectedResourceIds((current) => current.includes(resource.resourceId) ? current.filter((id) => id !== resource.resourceId) : [...current, resource.resourceId])
  }
  const changeLocale = (nextLocale: string) => {
    setLocale(nextLocale)
    setSelectedResourceIds([])
    setRelease(undefined)
    activateMutation.reset()
    buildMutation.reset()
  }
  const build = () => {
    buildMutation.mutate({ locale, revisions: currentRevisions.map(({ resource, detail }) => ({ resourceId: resource.resourceId, revisionId: detail!.currentRevision!.revisionId })) })
  }

  return <Box sx={{ maxWidth: 1200, p: { xs: 2, sm: 3.25 } }}>
    <Button component={Link} startIcon={<ArrowBackOutlined />} to="/releases">Wróć do wydań</Button>
    <Typography component="h1" sx={{ mt: 2 }} variant="h3">Nowe wydanie</Typography>
    <Typography color="text.secondary" sx={{ mt: 1 }}>Wybierz aktualną rewizję każdego zasobu, który ma znaleźć się w katalogu.</Typography>
    <Paper elevation={0} sx={{ border: '1px solid #e4e1e9', mt: 3, p: { xs: 2, sm: 3 } }}>
      <FormControl sx={{ minWidth: 220 }}><InputLabel id="release-locale-label">Język katalogu</InputLabel><Select label="Język katalogu" labelId="release-locale-label" onChange={(event) => changeLocale(event.target.value)} value={locale}>{locales.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}</Select></FormControl>
    </Paper>
    <Stack spacing={3} sx={{ mt: 3 }}>
      {resourcesQuery.isPending && <Typography aria-live="polite">Ładowanie treści...</Typography>}
      {resourcesQuery.isError && <Alert severity="error">Nie udało się pobrać treści do wydania.</Alert>}
      {resourcesQuery.isSuccess && resourcesQuery.data.items.length === 0 && <Alert severity="info">Brak treści z tłumaczeniem dla wybranego języka.</Alert>}
      {resourcesQuery.isSuccess && resourcesQuery.data.items.length > 0 && <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e4e1e9' }}><Table aria-label="Zasoby do wydania"><TableHead><TableRow><TableCell padding="checkbox" /><TableCell>Tytuł</TableCell><TableCell>Typ</TableCell><TableCell>Aktualna rewizja</TableCell><TableCell>Stan wyboru</TableCell></TableRow></TableHead><TableBody>{resourcesQuery.data.items.map((resource) => {
        const detailIndex = selectedResources.findIndex((selected) => selected.resourceId === resource.resourceId)
        const detailQuery = detailIndex === -1 ? undefined : detailQueries[detailIndex]
        const selected = detailIndex !== -1
        const revisionUnavailable = resource.currentRevisionNumber === null
        const revisionMismatch = selected && detailQuery?.isSuccess && detailQuery.data.currentRevision?.revisionNumber !== resource.currentRevisionNumber
        return <TableRow key={resource.resourceId}><TableCell padding="checkbox"><Checkbox checked={selected} disabled={revisionUnavailable} onChange={() => toggleResource(resource)} slotProps={{ input: { 'aria-label': `Wybierz ${resource.title}` } }} /></TableCell><TableCell><Typography sx={{ fontWeight: 700 }}>{resource.title}</Typography><Typography color="text.secondary" variant="body2">{resource.canonicalKey}</Typography></TableCell><TableCell>{resource.resourceType}</TableCell><TableCell>{resource.currentRevisionNumber === null ? 'Brak' : `Wersja ${resource.currentRevisionNumber}`}</TableCell><TableCell>{revisionUnavailable ? <Chip color="warning" label="Brak rewizji" size="small" /> : !selected ? 'Niewybrany' : detailQuery?.isPending ? 'Sprawdzanie...' : detailQuery?.isError || revisionMismatch ? <Chip color="error" label="Nie można użyć" size="small" /> : <Chip color="success" label="Gotowy" size="small" />}</TableCell></TableRow>
      })}</TableBody></Table></TableContainer>}
      {selectedResources.length > 0 && missingRevisionCount > 0 && <Alert severity="warning">Czekamy na potwierdzenie aktualnych rewizji. Zasób bez zgodnej aktualnej rewizji nie może wejść do wydania.</Alert>}
      {buildMutation.isError && <Alert severity="error">Nie udało się utworzyć wydania. Stan operacji może wymagać sprawdzenia po stronie serwera.</Alert>}
      <JsonPreview label="Dane wydania (JSON)" value={{ locale, revisions: currentRevisions.map(({ resource, detail }) => ({ resourceId: resource.resourceId, revisionId: detail!.currentRevision!.revisionId })) }} />
      {!release && <Box><Button disabled={!canSubmit} onClick={build} startIcon={<PublishOutlined />} variant="contained">Utwórz wydanie</Button></Box>}
      {release && <ReleaseResult release={release} canActivate={canActivate} isActivating={activateMutation.isPending} activationError={activateMutation.isError} publishedAt={activateMutation.data?.publishedAt} onActivate={() => activateMutation.mutate(release.releaseId)} />}
    </Stack>
  </Box>
}

function ReleaseResult({ release, canActivate, isActivating, activationError, publishedAt, onActivate }: { release: BuildReleaseResponse; canActivate: boolean; isActivating: boolean; activationError: boolean; publishedAt?: string; onActivate: () => void }) {
  return <Paper elevation={0} sx={{ border: '1px solid #e4e1e9', p: { xs: 2, sm: 3 } }}><Typography component="h2" variant="h5">Wydanie gotowe do aktywacji</Typography><Stack spacing={1} sx={{ mt: 2 }}><Typography><strong>ID wydania:</strong> {release.releaseId}</Typography><Typography><strong>ETag katalogu:</strong> {release.catalogEtag}</Typography><Typography sx={{ overflowWrap: 'anywhere' }}><strong>Klucz storage:</strong> {release.catalogStorageKey}</Typography></Stack>{publishedAt && <Alert severity="success" sx={{ mt: 2 }}>Wydanie aktywowano: {formatDate(publishedAt)}.</Alert>}{activationError && <Alert severity="error" sx={{ mt: 2 }}>Nie udało się aktywować wydania. Stan operacji może wymagać sprawdzenia po stronie serwera.</Alert>}{canActivate && !publishedAt && <Button disabled={isActivating} onClick={onActivate} startIcon={<PublishOutlined />} sx={{ mt: 3 }} variant="contained">Aktywuj wydanie</Button>}{!canActivate && <Alert severity="info" sx={{ mt: 2 }}>Do aktywacji wydania potrzebujesz uprawnienia `release.activate`.</Alert>}</Paper>
}


