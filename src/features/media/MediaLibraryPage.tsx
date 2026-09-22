import AddOutlined from '@mui/icons-material/AddOutlined'
import ReplayOutlined from '@mui/icons-material/ReplayOutlined'
import { Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { hasAnyPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/useAuth'
import { AssetEditorDialog } from './AssetEditorDialog'
import { AssetPreview } from './AssetPreview'
import { assetKindLabels, fetchAssets, type MediaAsset } from './mediaApi'

const pageSizes = [25, 50, 100] as const
type Kind = MediaAsset['kind'] | ''
function formatDate(value: string) { return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function formatBytes(value: number | null) { return value === null ? '—' : `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(value / 1024 / 1024)} MB` }

export function MediaLibraryPage() {
  const { permissions } = useAuth()
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25)
  const [kind, setKind] = useState<Kind>('')
  const [cursor, setCursor] = useState<string>()
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [editor, setEditor] = useState<{ asset?: MediaAsset }>()
  const query = useQuery({ queryKey: ['assets', pageSize, cursor, kind], queryFn: ({ signal }) => fetchAssets({ pageSize, cursor, kind: kind || undefined }, signal) })
  const canUpload = hasAnyPermission(permissions, ['media.upload'])
  const changeKind = (next: Kind) => { setKind(next); setCursor(undefined); setCursorStack([]) }
  const tab = kind === 'video' || kind === 'audio' ? kind : ''

  return <Box sx={{ maxWidth: 1600, p: { xs: 2, sm: 4 } }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', mb: 3 }}>
      <Box><Typography component="h1" variant="h3">Media</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Pliki, podgląd i metadane potwierdzone przez serwer.</Typography></Box>
      {canUpload && <Button onClick={() => setEditor({})} startIcon={<AddOutlined />} variant="contained">Zarejestruj zasób</Button>}
    </Stack>
    <Tabs value={tab} onChange={(_, value: Kind) => changeKind(value)} aria-label="Kategorie mediów" sx={{ mb: 2 }}>
      <Tab value="" label="Wszystkie" /><Tab value="video" label="Wideo" /><Tab value="audio" label="Audio" />
    </Tabs>
    <Paper variant="outlined" sx={{ mb: 3, p: 2.5 }}><Stack direction="row" spacing={2}>
      <FormControl size="small" sx={{ minWidth: 180 }}><InputLabel id="media-type-filter">Typ medium</InputLabel><Select labelId="media-type-filter" label="Typ medium" value={kind} onChange={(event) => changeKind(event.target.value as Kind)}><MenuItem value="">Wszystkie typy</MenuItem>{Object.entries(assetKindLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
      <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel id="media-page-size">Na stronie</InputLabel><Select labelId="media-page-size" label="Na stronie" onChange={(event) => { setPageSize(Number(event.target.value) as 25 | 50 | 100); setCursor(undefined); setCursorStack([]) }} value={pageSize}>{pageSizes.map((size) => <MenuItem key={size} value={size}>{size}</MenuItem>)}</Select></FormControl>
    </Stack></Paper>
    {query.isPending && <Typography aria-live="polite">Ładowanie biblioteki mediów...</Typography>}
    {query.isError && <Alert action={<Button color="inherit" onClick={() => void query.refetch()} startIcon={<ReplayOutlined />}>Spróbuj ponownie</Button>} severity="error">Nie udało się pobrać biblioteki mediów.</Alert>}
    {query.isSuccess && query.data.items.length === 0 && <Alert severity="info">Brak mediów dla wybranego typu.</Alert>}
    {query.isSuccess && query.data.items.length > 0 && <TableContainer component={Paper} variant="outlined"><Table aria-label="Biblioteka mediów"><TableHead><TableRow>
      {['Podgląd', 'Nazwa', 'Status', 'Typ', 'Dostawca', 'Format', 'Rozmiar', 'Wymiary', 'Czas trwania', 'Dodano', ...(canUpload ? ['Akcje'] : [])].map((heading) => <TableCell key={heading}>{heading}</TableCell>)}
    </TableRow></TableHead><TableBody>{query.data.items.map((asset) => <TableRow key={asset.id}>
      <TableCell><AssetPreview asset={asset} /></TableCell>
      <TableCell><Typography sx={{ fontWeight: 700, minWidth: 160, overflowWrap: 'anywhere' }}>{asset.displayName ?? asset.externalId ?? asset.id}</Typography><Typography color="text.secondary" variant="body2">{asset.originalFileName ?? asset.id}</Typography></TableCell>
      <TableCell><Chip size="small" color={asset.providerStatus === 'ready' ? 'success' : 'warning'} label={asset.providerStatus === 'ready' ? 'Gotowy' : 'Niezweryfikowany'} /></TableCell>
      <TableCell>{assetKindLabels[asset.kind]}</TableCell><TableCell>{asset.provider}</TableCell><TableCell>{asset.mimeType ?? '—'}</TableCell><TableCell>{formatBytes(asset.bytes)}</TableCell>
      <TableCell>{asset.width && asset.height ? `${asset.width} × ${asset.height}` : '—'}</TableCell><TableCell>{asset.durationSeconds === null ? '—' : `${asset.durationSeconds} s`}</TableCell><TableCell>{formatDate(asset.createdAt)}</TableCell>
      {canUpload && <TableCell><Button onClick={() => setEditor({ asset })} aria-label={`Edytuj ${asset.displayName ?? asset.externalId ?? asset.id}`}>Edytuj</Button></TableCell>}
    </TableRow>)}</TableBody></Table></TableContainer>}
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 3 }}><Button disabled={cursorStack.length === 0 || query.isPending} onClick={() => { setCursor(cursorStack.at(-1) || undefined); setCursorStack((stack) => stack.slice(0, -1)) }}>Wstecz</Button><Button disabled={!query.data?.nextCursor || query.isPending} onClick={() => { if (!query.data?.nextCursor) return; setCursorStack((stack) => [...stack, cursor ?? '']); setCursor(query.data.nextCursor) }}>Dalej</Button></Stack>
    {editor && <AssetEditorDialog asset={editor.asset} initialKind={kind || 'video'} onClose={() => setEditor(undefined)} />}
  </Box>
}
