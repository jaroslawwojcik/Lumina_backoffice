import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { SessionVideoUpload } from './SessionVideoUpload'
import { SessionAudioUpload } from './SessionAudioUpload'
import { ThumbnailImageUpload } from './ThumbnailImageUpload'
import { assetKindLabels, registerAsset, registerAssetSchema, updateAsset, type MediaAsset, type RegisterAsset } from './mediaApi'
type Fields = { kind: MediaAsset['kind']; displayName: string; provider: string; providerLibraryId: string; externalId: string; storageKey: string; publicUrl: string; mimeType: string; bytes: string; width: string; height: string; durationSeconds: string }
function defaults(kind: MediaAsset['kind'], asset?: MediaAsset): Fields {
  return { kind, displayName: asset?.displayName ?? '', provider: asset?.provider ?? (kind === 'video' ? 'bunny_stream' : 'bunny_storage'), providerLibraryId: asset?.providerLibraryId ?? '', externalId: asset?.externalId ?? '', storageKey: asset?.storageKey ?? '', publicUrl: asset?.publicUrl ?? '', mimeType: asset?.mimeType ?? '', bytes: asset?.bytes?.toString() ?? '', width: asset?.width?.toString() ?? '', height: asset?.height?.toString() ?? '', durationSeconds: asset?.durationSeconds?.toString() ?? '' }
}

export function AssetEditorDialog({ asset, initialKind, onClose }: { asset?: MediaAsset; initialKind: MediaAsset['kind']; onClose: () => void }) {
  const [saved, setSaved] = useState(asset)
  const [fields, setFields] = useState(() => defaults(asset?.kind ?? initialKind, asset))
  const [mode, setMode] = useState('existing')
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({})
  const [error, setError] = useState<string>()
  const [success, setSuccess] = useState<string>()
  const [pending, setPending] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [manualMetadata, setManualMetadata] = useState(asset?.metadataSource === 'manual')
  const client = useQueryClient()
  const ready = saved?.providerStatus === 'ready'
  const video = fields.kind === 'video'
  const providerReady = ready && saved?.metadataSource !== 'manual'
  const media = video || fields.kind === 'audio'
  const busy = pending || uploadBusy
  const refresh = async () => { await Promise.all(['assets', 'resources', 'resource', 'resource-assets', 'resource-revisions', 'asset-preview'].map((key) => client.invalidateQueries({ queryKey: [key] }))) }
  const change = (key: keyof Fields, value: string) => { setFields((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined })); setSuccess(undefined) }
  const submit = async (verify: boolean, close: boolean) => {
    if (pending) return
    setError(undefined); setSuccess(undefined)
    const payload: RegisterAsset = {
      kind: fields.kind, provider: video ? 'bunny_stream' : fields.provider.trim(), displayName: fields.displayName.trim(),
      externalId: fields.externalId.trim() || null, storageKey: fields.storageKey.trim() || null, publicUrl: fields.publicUrl.trim() || null,
      providerLibraryId: fields.providerLibraryId.trim() || null, mimeType: fields.mimeType.trim() || null,
      bytes: fields.bytes.trim() ? Number(fields.bytes) : null,
      width: fields.width.trim() ? Number(fields.width) : null, height: fields.height.trim() ? Number(fields.height) : null,
      durationSeconds: fields.durationSeconds.trim() ? Number(fields.durationSeconds) : null, verifyProvider: verify,
      useManualMetadata: manualMetadata && !verify,
    }
    const parsed = registerAssetSchema.safeParse(payload)
    const issues: Partial<Record<keyof Fields, string>> = {}
    if (!fields.displayName.trim()) issues.displayName = 'Podaj nazwę w bibliotece.'
    if (!parsed.success) for (const issue of parsed.error.issues) issues[issue.path[0] as keyof Fields] = ['bytes', 'width', 'height', 'durationSeconds'].includes(String(issue.path[0])) ? 'Podaj poprawną liczbę całkowitą (wymiary większe od zera).' : issue.message
    setErrors(issues)
    if (!parsed.success || Object.keys(issues).length) return
    setPending(true)
    try {
      const result = saved ? await updateAsset(saved.id, parsed.data) : await registerAsset(parsed.data)
      setSaved(result); setFields(defaults(result.kind, result)); setManualMetadata(result.metadataSource === 'manual')
      setSuccess(verify ? 'Metadane pobrano z Bunny. Medium jest gotowe. Przypisane treści otrzymały nowe rewizje, jeśli ich metadane się zmieniły. Do wydania wybierz najnowsze rewizje.' : manualMetadata ? 'Zapisano ręczne metadane medium. Przypisane treści otrzymały nowe rewizje, jeśli dane się zmieniły.' : 'Zapisano zmiany medium.')
      await refresh()
      if (close) onClose()
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Nie udało się zapisać medium.') }
    finally { setPending(false) }
  }
  const text = (key: Exclude<keyof Fields, 'kind'>, label: string, options: { disabled?: boolean; helper?: string; type?: string; required?: boolean } = {}) =>
    <TextField key={key} fullWidth label={label} value={fields[key]} onChange={(event) => change(key, event.target.value)} disabled={pending || options.disabled} required={options.required} type={options.type ?? 'text'} error={Boolean(errors[key])} helperText={errors[key] ?? options.helper} />

  return <Dialog open fullWidth maxWidth="md" onClose={busy ? undefined : onClose}>
    <DialogTitle>{saved ? 'Edytuj medium' : 'Zarejestruj zasób'}</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      {!saved && <Tabs value={mode} onChange={(_, value: string) => { setMode(value); setError(undefined) }} aria-label="Sposób dodania medium"><Tab disabled={busy} value="existing" label="Istniejący zasób" /><Tab disabled={busy} value="upload" label="Prześlij plik" /></Tabs>}
      <TextField select label="Typ zasobu" value={fields.kind} disabled={Boolean(saved) || busy} onChange={(event) => { setFields(defaults(event.target.value as MediaAsset['kind'])); setErrors({}); setError(undefined) }}>{Object.entries(assetKindLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
      {mode === 'upload' ? <>
        {video ? <SessionVideoUpload libraryOnly onBusyChange={setUploadBusy} onSaved={() => { void refresh(); onClose() }} />
          : fields.kind === 'audio' ? <SessionAudioUpload onBusyChange={setUploadBusy} onSaved={() => { void refresh(); onClose() }} />
            : fields.kind === 'image' ? <ThumbnailImageUpload onBusyChange={setUploadBusy} onSaved={() => { void refresh(); onClose() }} />
              : <Alert severity="info">Upload obsługuje wideo, audio i obrazy. Dokument, napisy lub transkrypcję dodaj jako istniejący zasób.</Alert>}
      </> : <Box component="form" id="asset-editor" noValidate onSubmit={(event) => { event.preventDefault(); void submit(video && !ready && !manualMetadata, true) }}><Stack spacing={2}>
        {text('displayName', 'Nazwa w bibliotece', { required: true })}
        {video ? <>
          <Alert severity="info">Najpierw spróbuj pobrać metadane z Bunny. Jeżeli API nie zwraca kompletu danych, istniejący film możesz oznaczyć jako uzupełniony ręcznie.</Alert>
          {text('externalId', 'Identyfikator filmu w Bunny', { required: true, disabled: ready, helper: 'UUID filmu z biblioteki Bunny Stream.' })}
          {text('providerLibraryId', 'ID biblioteki Bunny (opcjonalnie)', { disabled: ready, helper: 'Puste pole oznacza bibliotekę skonfigurowaną na serwerze.' })}
          {saved && !providerReady && <FormControlLabel control={<Checkbox checked={manualMetadata} disabled={pending} onChange={(event) => { setManualMetadata(event.target.checked); setErrors({}); setError(undefined); setSuccess(undefined) }} />} label="Uzupełnij metadane filmu ręcznie" />}
          {manualMetadata && <Alert severity="warning">Te dane nie zostaną potwierdzone przez Bunny. Sprawdź czas i rozdzielczość przed publikacją.</Alert>}
        </> : <>
          {text('provider', 'Dostawca', { required: true, disabled: ready })}
          {text('externalId', 'Identyfikator u dostawcy', { disabled: ready })}
          {text('storageKey', 'Klucz pliku w storage', { disabled: ready })}
          {!media && text('publicUrl', 'Publiczny adres URL', { disabled: ready, helper: 'Adres bez tokenów; nie używaj publicznego adresu dla chronionego audio lub wideo.' })}
          {!ready && <Alert severity="info">Ręcznie dodane dane nie potwierdzają gotowości pliku. Dla audio i obrazów użyj zakładki „Prześlij plik”, aby serwer sprawdził plik i uzupełnił metadane.</Alert>}
        </>}
        {text('mimeType', 'Typ MIME (opcjonalnie)', { disabled: ready || video, helper: video ? 'Format źródłowy jest dostępny po uploadzie.' : fields.kind === 'audio' ? 'Np. audio/mpeg lub audio/mp4.' : 'Np. image/jpeg, application/pdf lub text/vtt.' })}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          {text('bytes', 'Rozmiar w bajtach (opcjonalnie)', { type: 'number', disabled: providerReady || (video && !manualMetadata) })}
          {(video || fields.kind === 'image') && text('width', 'Szerokość (opcjonalnie)', { type: 'number', disabled: providerReady || (video && !manualMetadata) })}
          {(video || fields.kind === 'image') && text('height', 'Wysokość (opcjonalnie)', { type: 'number', disabled: providerReady || (video && !manualMetadata) })}
        </Stack>
        {media && text('durationSeconds', 'Czas trwania w sekundach (opcjonalnie)', { type: 'number', disabled: providerReady || (video && !manualMetadata) })}
        {video && <Button disabled={pending} variant="outlined" onClick={() => void submit(true, false)}>{pending ? 'Sprawdzanie Bunny…' : 'Pobierz i zapisz metadane z Bunny'}</Button>}
        {providerReady && <Typography variant="body2" color="text.secondary">Metadane potwierdzone przez Bunny są chronione. Możesz zmienić nazwę; podmianę pliku wykonaj przez dodanie nowego medium.</Typography>}
        {saved?.metadataSource === 'manual' && <Typography variant="body2" color="warning.main">Źródło metadanych: wpisane ręcznie przez administratora.</Typography>}
        {success && <Alert severity="success">{success}</Alert>}{error && <Alert severity="error">{error}</Alert>}
      </Stack></Box>}
    </Stack></DialogContent>
    <DialogActions><Button disabled={busy} onClick={onClose}>{saved ? 'Zamknij' : 'Anuluj'}</Button>{mode === 'existing' && <Button form="asset-editor" disabled={pending} type="submit" variant="contained">{pending ? 'Zapisywanie…' : saved ? 'Zapisz zmiany' : 'Zarejestruj'}</Button>}</DialogActions>
  </Dialog>
}
