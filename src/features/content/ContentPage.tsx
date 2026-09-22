import AddOutlined from '@mui/icons-material/AddOutlined'
import ReplayOutlined from '@mui/icons-material/ReplayOutlined'
import { Alert, Box, Button, Chip, FormControl, InputLabel, Menu, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useState, type MouseEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { hasAnyPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/useAuth'
import { fetchResources, resourceListSearchSchema, type ResourceListSearch } from './resourceApi'

const pageSizes = [25, 50, 100] as const

function getSearch(searchParams: URLSearchParams): ResourceListSearch {
  return { sort: 'updatedAt:desc', pageSize: 25, ...resourceListSearchSchema.parse(Object.fromEntries(searchParams)) }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function ContentPage() {
  const { permissions } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const search = getSearch(searchParams)
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [createMenuAnchor, setCreateMenuAnchor] = useState<HTMLElement | null>(null)

  const query = useQuery({ queryKey: ['resources', search], queryFn: ({ signal }) => fetchResources(search, signal) })
  const updateSearch = (key: keyof ResourceListSearch, value: string) => {
    const next = new URLSearchParams(searchParams)
    next.delete('cursor')
    if (value) next.set(key, value)
    else next.delete(key)
    setCursorStack([])
    setSearchParams(next)
  }
  const pageSize = search.pageSize ?? 25
  const hasFilters = Boolean(search.search || search.type || search.status || search.accessTier || search.locale)
  const canCreate = hasAnyPermission(permissions, ['content.create'])

  return <Box sx={{ maxWidth: 1440, p: { xs: 2, md: 4 } }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
      <Box><Typography component="h1" variant="h3">Treści</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Programy, sesje i materiały w jednym miejscu.</Typography></Box>
      {canCreate && <><Button aria-controls={createMenuAnchor ? 'create-content-menu' : undefined} aria-expanded={Boolean(createMenuAnchor)} aria-haspopup="true" onClick={(event: MouseEvent<HTMLButtonElement>) => setCreateMenuAnchor(event.currentTarget)} startIcon={<AddOutlined />} variant="contained">Nowa treść</Button><Menu anchorEl={createMenuAnchor} id="create-content-menu" onClose={() => setCreateMenuAnchor(null)} open={Boolean(createMenuAnchor)}><MenuItem component={Link} onClick={() => setCreateMenuAnchor(null)} to="/content/sessions/new">Nowa sesja</MenuItem><MenuItem component={Link} onClick={() => setCreateMenuAnchor(null)} to="/content/programs/new">Nowy program</MenuItem><MenuItem component={Link} onClick={() => setCreateMenuAnchor(null)} to="/content/materials/new">Nowy materiał</MenuItem></Menu></>}
    </Stack>
    <Paper elevation={0} sx={{ bgcolor: 'transparent', mb: 2, pt: 1 }}>
      <Stack direction="row" useFlexGap spacing={1.25} sx={{ flexWrap: 'wrap', gap: 1.25, '& > :not(style)': { ml: 0 } }}>
        <ResourceSearch key={search.search ?? ''} initialSearch={search.search} onChange={(value) => updateSearch('search', value)} />
        <FilterSelect label="Typ" onChange={(value) => updateSearch('type', value)} value={search.type} values={[['session', 'Sesja'], ['program', 'Program'], ['material', 'Materiał']]} />
        <FilterSelect label="Status" onChange={(value) => updateSearch('status', value)} value={search.status} values={[['draft', 'Szkic'], ['inreview', 'Do weryfikacji'], ['published', 'Opublikowano'], ['archived', 'Archiwum']]} />
        <FilterSelect label="Dostęp" onChange={(value) => updateSearch('accessTier', value)} value={search.accessTier} values={[['free', 'Bezpłatny'], ['premium', 'Premium'], ['purchase', 'Zakup']]} />
        <Button variant="outlined" onClick={() => setShowMoreFilters((value) => !value)} aria-expanded={showMoreFilters}>Więcej filtrów</Button>
        {showMoreFilters && <FilterSelect label="Język" onChange={(value) => updateSearch('locale', value)} value={search.locale} values={[['pl', 'Polski'], ['en', 'Angielski']]} />}
        {showMoreFilters && <FilterSelect label="Sortowanie" onChange={(value) => updateSearch('sort', value)} value={search.sort ?? 'updatedAt:desc'} values={[['updatedAt:desc', 'Ostatnia aktualizacja'], ['title:asc', 'Tytuł A-Z']]} />}
        {showMoreFilters && <FilterSelect label="Na stronie" onChange={(value) => updateSearch('pageSize', value)} value={String(pageSize)} values={pageSizes.map((size) => [String(size), String(size)])} />}
      </Stack>
    </Paper>
    {query.isPending && <Typography aria-live="polite">Ładowanie treści...</Typography>}
    {query.isError && <Alert action={<Button color="inherit" onClick={() => void query.refetch()} startIcon={<ReplayOutlined />}>Spróbuj ponownie</Button>} severity="error">Nie udało się pobrać listy treści.</Alert>}
    {query.isSuccess && query.data.items.length === 0 && <Alert severity="info">{hasFilters ? 'Brak wyników dla wybranych filtrów.' : 'Katalog treści jest pusty.'}</Alert>}
    {query.isSuccess && query.data.items.length > 0 && <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}><Table aria-label="Lista treści"><TableHead><TableRow><TableCell>Tytuł</TableCell><TableCell>Typ</TableCell><TableCell>Status</TableCell><TableCell>Dostęp</TableCell><TableCell>Język</TableCell><TableCell>Wersja</TableCell><TableCell>Aktualizacja</TableCell></TableRow></TableHead><TableBody>{query.data.items.map((resource) => <TableRow key={resource.resourceId}><TableCell><Typography component={Link} sx={{ fontWeight: 500, fontSize: 13, '&:hover': { color: 'primary.main' } }} to={`/content/${resource.resourceType}s/${resource.resourceId}`}>{resource.title}</Typography><Typography color="text.secondary" variant="body2">{resource.canonicalKey}</Typography></TableCell><TableCell>{{ session: 'Sesja', program: 'Program', material: 'Materiał' }[resource.resourceType] ?? resource.resourceType}</TableCell><TableCell><Chip size="small" color={resource.status === 'published' ? 'success' : resource.status === 'inreview' ? 'warning' : 'default'} label={{ draft: 'Szkic', inreview: 'Do weryfikacji', published: 'Opublikowano', archived: 'Archiwum' }[resource.status] ?? resource.status} /></TableCell><TableCell>{{ free: 'Bezpłatny', premium: 'Premium', purchase: 'Zakup' }[resource.accessTier] ?? resource.accessTier}</TableCell><TableCell>{resource.defaultLocale}</TableCell><TableCell>{resource.currentRevisionNumber}</TableCell><TableCell>{formatDate(resource.updatedAt)}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 3 }}>
      <Button disabled={cursorStack.length === 0 || query.isPending} onClick={() => { const previousCursor = cursorStack.at(-1); const next = new URLSearchParams(searchParams); if (previousCursor) next.set('cursor', previousCursor); else next.delete('cursor'); setCursorStack((stack) => stack.slice(0, -1)); setSearchParams(next) }}>Wstecz</Button>
      <Button disabled={!query.data?.nextCursor || query.isPending} onClick={() => { if (!query.data?.nextCursor) return; setCursorStack((stack) => [...stack, search.cursor ?? '']); const next = new URLSearchParams(searchParams); next.set('cursor', query.data.nextCursor); setSearchParams(next) }}>Dalej</Button>
    </Stack>
  </Box>
}

function ResourceSearch({ initialSearch, onChange }: { initialSearch?: string; onChange: (value: string) => void }) {
  const [searchInput, setSearchInput] = useState(initialSearch ?? '')
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmedSearch = searchInput.trim()
      if ((trimmedSearch.length < 2 && !initialSearch) || trimmedSearch === initialSearch) return
      onChange(trimmedSearch.length >= 2 ? trimmedSearch : '')
    }, 300)
    return () => window.clearTimeout(timer)
  }, [initialSearch, onChange, searchInput])
  return <TextField label="Szukaj" onChange={(event) => setSearchInput(event.target.value)} placeholder="Tytuł lub klucz" size="small" value={searchInput} sx={{ minWidth: 250 }} />
}

function FilterSelect({ label, onChange, value, values }: { label: string; onChange: (value: string) => void; value?: string; values: readonly (readonly [string, string])[] }) {
  const labelId = useId()
  return <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel id={labelId}>{label}</InputLabel><Select labelId={labelId} label={label} onChange={(event) => onChange(event.target.value)} value={value ?? ''}><MenuItem value="">Wszystkie</MenuItem>{values.map(([optionValue, optionLabel]) => <MenuItem key={optionValue} value={optionValue}>{optionLabel}</MenuItem>)}</Select></FormControl>
}




