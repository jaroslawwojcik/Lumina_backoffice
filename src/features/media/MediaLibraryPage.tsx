import { FormJsonPreview } from '../../components/forms/FormJsonPreview'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ReplayOutlined from '@mui/icons-material/ReplayOutlined'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { hasAnyPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/useAuth'
import { fetchAssets, registerAsset, registerAssetSchema, type RegisterAsset } from './mediaApi'

const pageSizes = [25, 50, 100] as const

function formatDate(value: string): string { return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function formatBytes(value: number | null): string { return value === null ? '-' : new Intl.NumberFormat('pl-PL', { style: 'unit', unit: 'byte', unitDisplay: 'short' }).format(value) }

type AssetFormValues = { kind: RegisterAsset['kind']; provider: string; externalId: string; mimeType: string; bytes: string; width: string; height: string; durationSeconds: string }
const defaults: AssetFormValues = { kind: 'video', provider: '', externalId: '', mimeType: '', bytes: '', width: '', height: '', durationSeconds: '' }

export function MediaLibraryPage() {
  const { permissions } = useAuth()
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25)
  const [cursor, setCursor] = useState<string>()
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['assets', pageSize, cursor], queryFn: ({ signal }) => fetchAssets({ pageSize, cursor }, signal) })
  const mutation = useMutation({ mutationFn: registerAsset, retry: false, onSuccess: async () => { setDialogOpen(false); await queryClient.invalidateQueries({ queryKey: ['assets'] }) } })
  const canUpload = hasAnyPermission(permissions, ['media.upload'])

  return <Box sx={{ maxWidth: 1440, p: { xs: 2, sm: 3.25 } }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' }, justifyContent: 'space-between', mb: 3 }}>
      <Box><Typography component="h1" variant="h3">Media</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Zarejestrowane zasoby dostawców.</Typography></Box>
      {canUpload && <Button onClick={() => setDialogOpen(true)} startIcon={<AddOutlined />} variant="contained">Zarejestruj zasób</Button>}
    </Stack>
    <Paper elevation={0} sx={{ border: '1px solid #e4e1e9', mb: 3, p: 2.5 }}><FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>Na stronie</InputLabel><Select label="Na stronie" onChange={(event) => { setPageSize(Number(event.target.value) as 25 | 50 | 100); setCursor(undefined); setCursorStack([]) }} value={pageSize}>{pageSizes.map((size) => <MenuItem key={size} value={size}>{size}</MenuItem>)}</Select></FormControl></Paper>
    {query.isPending && <Typography aria-live="polite">Ładowanie biblioteki mediów...</Typography>}
    {query.isError && <Alert action={<Button color="inherit" onClick={() => void query.refetch()} startIcon={<ReplayOutlined />}>Spróbuj ponownie</Button>} severity="error">Nie udało się pobrać biblioteki mediów.</Alert>}
    {query.isSuccess && query.data.items.length === 0 && <Alert severity="info">Biblioteka mediów jest pusta.</Alert>}
    {query.isSuccess && query.data.items.length > 0 && <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e4e1e9' }}><Table aria-label="Biblioteka mediów"><TableHead><TableRow><TableCell>Nazwa</TableCell><TableCell>Status</TableCell><TableCell>Typ</TableCell><TableCell>Dostawca</TableCell><TableCell>Format</TableCell><TableCell>Rozmiar</TableCell><TableCell>Wymiary</TableCell><TableCell>Czas trwania</TableCell><TableCell>Dodano</TableCell></TableRow></TableHead><TableBody>{query.data.items.map((asset) => <TableRow key={asset.id}><TableCell><Typography sx={{ fontWeight: 700 }}>{asset.displayName ?? asset.externalId ?? asset.id}</Typography><Typography color="text.secondary" variant="body2">{asset.originalFileName ?? asset.id}</Typography></TableCell><TableCell>{asset.providerStatus === 'ready' ? 'Gotowy' : 'Niezweryfikowany'}</TableCell><TableCell>{asset.kind}</TableCell><TableCell>{asset.provider}</TableCell><TableCell>{asset.mimeType ?? '-'}</TableCell><TableCell>{formatBytes(asset.bytes)}</TableCell><TableCell>{asset.width && asset.height ? `${asset.width} x ${asset.height}` : '-'}</TableCell><TableCell>{asset.durationSeconds === null ? '-' : `${asset.durationSeconds} s`}</TableCell><TableCell>{formatDate(asset.createdAt)}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 3 }}><Button disabled={cursorStack.length === 0 || query.isPending} onClick={() => { const previous = cursorStack.at(-1); setCursor(previous || undefined); setCursorStack((stack) => stack.slice(0, -1)) }}>Wstecz</Button><Button disabled={!query.data?.nextCursor || query.isPending} onClick={() => { if (!query.data?.nextCursor) return; setCursorStack((stack) => [...stack, cursor ?? '']); setCursor(query.data.nextCursor) }}>Dalej</Button></Stack>
    <RegisterAssetDialog error={mutation.isError} onClose={() => setDialogOpen(false)} onSubmit={(value) => mutation.mutate(value)} open={dialogOpen} pending={mutation.isPending} />
  </Box>
}

function RegisterAssetDialog({ error, onClose, onSubmit, open, pending }: { error: boolean; onClose: () => void; onSubmit: (value: RegisterAsset) => void; open: boolean; pending: boolean }) {
  const form = useForm<AssetFormValues>({ defaultValues: defaults, mode: 'onBlur' })
  const submit = (values: AssetFormValues) => {
    const parsed = registerAssetSchema.safeParse({ kind: values.kind, provider: values.provider, externalId: values.externalId, ...(values.mimeType.trim() ? { mimeType: values.mimeType.trim() } : {}), ...optionalNumber('bytes', values.bytes), ...optionalNumber('width', values.width), ...optionalNumber('height', values.height), ...optionalNumber('durationSeconds', values.durationSeconds) })
    if (parsed.success) onSubmit(parsed.data)
    else for (const issue of parsed.error.issues) form.setError(issue.path[0] as keyof AssetFormValues, { message: ['bytes', 'width', 'height', 'durationSeconds'].includes(String(issue.path[0])) ? 'Podaj poprawną nieujemną liczbę całkowitą (wymiary większe od zera).' : issue.message })
  }
  return <Dialog fullWidth maxWidth="md" onClose={pending ? undefined : onClose} open={open}><Box component="form" noValidate onSubmit={form.handleSubmit(submit)}><DialogTitle>Zarejestruj istniejący zasób</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><Controller control={form.control} name="kind" render={({ field }) => <FormControl fullWidth><InputLabel id="asset-kind">Typ zasobu</InputLabel><Select {...field} labelId="asset-kind" label="Typ zasobu"><MenuItem value="image">Obraz</MenuItem><MenuItem value="video">Wideo</MenuItem><MenuItem value="audio">Audio</MenuItem><MenuItem value="document">Dokument</MenuItem><MenuItem value="subtitle">Napisy</MenuItem><MenuItem value="transcript">Transkrypcja</MenuItem></Select></FormControl>} /><TextField autoFocus error={Boolean(form.formState.errors.provider)} helperText={form.formState.errors.provider?.message} label="Dostawca" required {...form.register('provider', { validate: (value) => Boolean(value.trim()) || 'Dostawca jest wymagany.' })} /><TextField error={Boolean(form.formState.errors.externalId)} helperText={form.formState.errors.externalId?.message} label="Identyfikator u dostawcy" required {...form.register('externalId', { validate: (value) => Boolean(value.trim()) || 'Identyfikator zasobu jest wymagany.' })} /><TextField error={Boolean(form.formState.errors.mimeType)} helperText={form.formState.errors.mimeType?.message ?? 'Np. video/mp4 lub audio/mpeg.'} label="Typ MIME (opcjonalnie)" {...form.register('mimeType', { validate: (value) => !value.trim() || /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(value.trim()) || 'Podaj typ w formacie video/mp4.' })} /><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><TextField error={Boolean(form.formState.errors.bytes)} helperText={form.formState.errors.bytes?.message} fullWidth label="Rozmiar w bajtach (opcjonalnie)" slotProps={{ htmlInput: { min: 0 } }} type="number" {...form.register('bytes', { validate: (value) => value.trim() === '' || Number.isSafeInteger(Number(value)) && Number(value) >= 0 || 'Podaj liczbę całkowitą nie mniejszą niż 0.' })} /><TextField error={Boolean(form.formState.errors.width)} helperText={form.formState.errors.width?.message} fullWidth label="Szerokość (opcjonalnie)" slotProps={{ htmlInput: { min: 1 } }} type="number" {...form.register('width', { validate: (value) => value.trim() === '' || Number.isSafeInteger(Number(value)) && Number(value) >= 1 || 'Podaj liczbę całkowitą nie mniejszą niż 1.' })} /><TextField error={Boolean(form.formState.errors.height)} helperText={form.formState.errors.height?.message} fullWidth label="Wysokość (opcjonalnie)" slotProps={{ htmlInput: { min: 1 } }} type="number" {...form.register('height', { validate: (value) => value.trim() === '' || Number.isSafeInteger(Number(value)) && Number(value) >= 1 || 'Podaj liczbę całkowitą nie mniejszą niż 1.' })} /></Stack><TextField error={Boolean(form.formState.errors.durationSeconds)} helperText={form.formState.errors.durationSeconds?.message} label="Czas trwania w sekundach (opcjonalnie)" slotProps={{ htmlInput: { min: 0 } }} type="number" {...form.register('durationSeconds', { validate: (value) => value.trim() === '' || Number.isSafeInteger(Number(value)) && Number(value) >= 0 || 'Podaj liczbę całkowitą nie mniejszą niż 0.' })} /><FormJsonPreview control={form.control} project={(values) => ({ kind: values.kind, provider: values.provider.trim(), externalId: values.externalId.trim(), mimeType: values.mimeType.trim() || undefined, ...optionalNumber('bytes', values.bytes), ...optionalNumber('width', values.width), ...optionalNumber('height', values.height), ...optionalNumber('durationSeconds', values.durationSeconds) })} />{error && <Alert severity="error">Nie udało się zarejestrować zasobu. Stan zapisu jest nieznany.</Alert>}</Stack></DialogContent><DialogActions><Button disabled={pending} onClick={onClose}>Anuluj</Button><Button disabled={pending} type="submit" variant="contained">Zarejestruj</Button></DialogActions></Box></Dialog>
}

function optionalNumber(key: 'bytes' | 'width' | 'height' | 'durationSeconds', value: string): Partial<RegisterAsset> { return value.trim() ? { [key]: Number(value) } : {} }


