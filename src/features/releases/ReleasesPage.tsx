import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import ReplayOutlined from '@mui/icons-material/ReplayOutlined'
import { Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { hasAnyPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/useAuth'
import { fetchReleaseDetail, fetchReleases, releaseListSearchSchema, type ContentRelease, type ReleaseListSearch } from './releaseApi'

const pageSizes = [25, 50, 100] as const

function getSearch(searchParams: URLSearchParams): ReleaseListSearch {
  return { pageSize: 25, ...releaseListSearchSchema.parse(Object.fromEntries(searchParams)) }
}

function formatDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
}

export function ReleasesPage() {
  const { releaseId } = useParams()
  return releaseId ? <ReleaseDetailPage releaseId={releaseId} /> : <ReleaseListPage />
}

function ReleaseListPage() {
  const { permissions } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const search = getSearch(searchParams)
  const canBuild = hasAnyPermission(permissions, ['release.build'])
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const query = useQuery({ queryKey: ['releases', search], queryFn: ({ signal }) => fetchReleases(search, signal) })
  const pageSize = search.pageSize ?? 25

  const changePageSize = (value: string) => {
    const next = new URLSearchParams(searchParams)
    next.delete('cursor')
    next.set('pageSize', value)
    setCursorStack([])
    setSearchParams(next)
  }

  return <Box sx={{ maxWidth: 1440, p: { xs: 2, sm: 3.25 } }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' }, justifyContent: 'space-between', mb: 3 }}>
      <Box><Typography component="h1" variant="h3">Wydania</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Wersje katalogu opublikowane przez serwer.</Typography></Box>
      {canBuild && <Button component={Link} startIcon={<AddOutlined />} to="/releases/new" variant="contained">Nowe wydanie</Button>}
    </Stack>
    <Paper elevation={0} sx={{ border: '1px solid #e4e1e9', mb: 3, p: 2.5 }}><FormControl size="small" sx={{ minWidth: 160 }}><InputLabel>Na stronie</InputLabel><Select label="Na stronie" onChange={(event) => changePageSize(event.target.value)} value={String(pageSize)}>{pageSizes.map((size) => <MenuItem key={size} value={String(size)}>{size}</MenuItem>)}</Select></FormControl></Paper>
    {query.isPending && <Typography aria-live="polite">Ładowanie wydań...</Typography>}
    {query.isError && <Alert action={<Button color="inherit" onClick={() => void query.refetch()} startIcon={<ReplayOutlined />}>Spróbuj ponownie</Button>} severity="error">Nie udało się pobrać listy wydań.</Alert>}
    {query.isSuccess && query.data.items.length === 0 && <Alert severity="info">Brak wydań do wyświetlenia.</Alert>}
    {query.isSuccess && query.data.items.length > 0 && <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e4e1e9' }}><Table aria-label="Lista wydań"><TableHead><TableRow><TableCell>Wydanie</TableCell><TableCell>Język</TableCell><TableCell>Status</TableCell><TableCell>Utworzono</TableCell><TableCell>Opublikowano</TableCell><TableCell>Aktywowano</TableCell><TableCell align="right">Elementy</TableCell><TableCell>ETag katalogu</TableCell><TableCell>Aktywne</TableCell></TableRow></TableHead><TableBody>{query.data.items.map((release) => <ReleaseRow key={release.id} release={release} />)}</TableBody></Table></TableContainer>}
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 3 }}><Button disabled={cursorStack.length === 0 || query.isPending} onClick={() => { const previousCursor = cursorStack.at(-1); const next = new URLSearchParams(searchParams); if (previousCursor) next.set('cursor', previousCursor); else next.delete('cursor'); setCursorStack((stack) => stack.slice(0, -1)); setSearchParams(next) }}>Wstecz</Button><Button disabled={!query.data?.nextCursor || query.isPending} onClick={() => { if (!query.data?.nextCursor) return; setCursorStack((stack) => [...stack, search.cursor ?? '']); const next = new URLSearchParams(searchParams); next.set('cursor', query.data.nextCursor); setSearchParams(next) }}>Dalej</Button></Stack>
  </Box>
}

function ReleaseRow({ release }: { release: ContentRelease }) {
  return <TableRow hover><TableCell><Typography component={Link} sx={{ fontWeight: 700 }} to={`/releases/${release.id}`}>{release.id}</Typography></TableCell><TableCell>{release.locale}</TableCell><TableCell>{release.status}</TableCell><TableCell>{formatDate(release.createdAt)}</TableCell><TableCell>{formatDate(release.publishedAt)}</TableCell><TableCell>{formatDate(release.activatedAt)}</TableCell><TableCell align="right">{release.itemCount}</TableCell><TableCell>{release.catalogEtag ?? '—'}</TableCell><TableCell>{release.isActive ? <Chip color="success" label="Tak" size="small" /> : 'Nie'}</TableCell></TableRow>
}

function ReleaseDetailPage({ releaseId }: { releaseId: string }) {
  const query = useQuery({ queryKey: ['release', releaseId], queryFn: ({ signal }) => fetchReleaseDetail(releaseId, signal) })
  if (query.isPending) return <Box sx={{ p: { xs: 2, sm: 3.25 } }}><Typography aria-live="polite">Ładowanie wydania...</Typography></Box>
  if (query.isError) return <Box sx={{ maxWidth: 900, p: { xs: 2, sm: 3.25 } }}><Alert action={<Button color="inherit" onClick={() => void query.refetch()} startIcon={<ReplayOutlined />}>Spróbuj ponownie</Button>} severity="error">Nie udało się pobrać wydania.</Alert></Box>
  const release = query.data
  return <Box sx={{ maxWidth: 1100, p: { xs: 2, sm: 3.25 } }}><Button component={Link} startIcon={<ArrowBackOutlined />} to="/releases">Wróć do wydań</Button><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' }, justifyContent: 'space-between', mb: 3, mt: 3 }}><Box><Typography component="h1" variant="h3">Wydanie</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{release.id}</Typography></Box><Chip color={release.isActive ? 'success' : 'default'} label={release.isActive ? 'Aktywne' : 'Nieaktywne'} /></Stack><Paper elevation={0} sx={{ border: '1px solid #e4e1e9', p: 2.5 }}><Stack spacing={1.5}><Typography>Język: {release.locale}</Typography><Typography>Status: {release.status}</Typography><Typography>Utworzono: {formatDate(release.createdAt)}</Typography><Typography>Opublikowano: {formatDate(release.publishedAt)}</Typography><Typography>Aktywowano: {formatDate(release.activatedAt)}</Typography><Typography>Liczba elementów: {release.itemCount}</Typography><Typography>Klucz katalogu: {release.catalogStorageKey ?? '—'}</Typography><Typography>ETag katalogu: {release.catalogEtag ?? '—'}</Typography></Stack></Paper></Box>
}
