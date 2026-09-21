import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Paper, Stack, TextField, Typography } from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../api/apiError'
import { completeImageUpload, imageFileError, imageUploadConfiguration, uploadImage, type CompletedImage, type PreparedImage } from './imageUploadApi'

type Props = { resourceId?: string; expectedRevisionId?: string; currentUrl?: string | null; disabled?: boolean; onBusyChange?: (busy: boolean) => void; onSaved?: (image: CompletedImage) => void }

export function ThumbnailImageUpload({ resourceId, expectedRevisionId, currentUrl, disabled, onBusyChange, onSaved }: Props) {
  const configuration = useQuery({ queryKey: ['image-upload-configuration'], queryFn: ({ signal }) => imageUploadConfiguration(signal), retry: false })
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File>()
  const [name, setName] = useState('')
  const [preview, setPreview] = useState<string>()
  const [prepared, setPrepared] = useState<PreparedImage>()
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [conflict, setConflict] = useState(false)
  const [saved, setSaved] = useState<CompletedImage>()
  const [nameTouched, setNameTouched] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const previewRef = useRef<string | undefined>(undefined)
  const input = useRef<HTMLInputElement>(null)
  const busy = Boolean(file)
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false) }, [busy, onBusyChange])
  useEffect(() => () => { controller.current?.abort(); if (previewRef.current) URL.revokeObjectURL(previewRef.current) }, [])
  useEffect(() => {
    if (!busy) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])
  const clear = () => {
    controller.current?.abort(); controller.current = null
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = undefined
    setFile(undefined); setPreview(undefined); setPrepared(undefined); setUploading(false); setError(undefined); setConflict(false)
  }
  const choose = (files: FileList | null) => {
    if (disabled || busy || !configuration.data?.enabled || !files?.length) return
    if (files.length !== 1) { setError('Dodaj jeden obrazek kafelka.'); return }
    const next = files[0]
    const invalid = imageFileError(next, configuration.data.maximumBytes, configuration.data.mimeTypes)
    if (invalid) { setError(invalid); return }
    setError(undefined); setName(''); setNameTouched(false); setFile(next)
    previewRef.current = URL.createObjectURL(next); setPreview(previewRef.current)
  }
  const transfer = async () => {
    setNameTouched(true)
    if (!file || !name.trim() || name.trim().length > 200 || uploading) return
    const abort = new AbortController(); controller.current = abort
    setUploading(true); setError(undefined)
    try {
      const result = await uploadImage(file, name, abort.signal, resourceId, expectedRevisionId)
      if (!abort.signal.aborted) setPrepared(result)
    } catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Nie udało się przesłać obrazu.') }
    finally { if (!abort.signal.aborted) setUploading(false) }
  }
  const save = async (libraryOnly = false) => {
    if (!prepared || saving) return
    setSaving(true); setError(undefined); setConflict(false)
    try {
      const result = await completeImageUpload(prepared.ticket, libraryOnly)
      if (!libraryOnly) { setSaved(result); onSaved?.(result) }
      clear()
      await Promise.all([['assets'], ['resource', resourceId], ['resource-assets', resourceId], ['resource-revisions', resourceId]].map((queryKey) => queryClient.invalidateQueries({ queryKey })))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się zapisać obrazu. Ponów zatwierdzenie.')
      setConflict(failure instanceof ApiError && failure.status === 409)
    } finally { setSaving(false) }
  }
  const visibleUrl = saved?.asset.publicUrl ?? currentUrl
  return <Paper variant="outlined" sx={{ p: 2.5 }}>
    <Stack spacing={2}>
      <Typography component="h2" variant="h6">Obrazek kafelka</Typography>
      <Typography color="text.secondary">Osobna miniatura treści, niezależna od filmu. Zmiana pojawi się dla użytkowników po publikacji nowej wersji.</Typography>
      {visibleUrl && <Box component="img" src={visibleUrl} alt="Aktualny obrazek kafelka" sx={{ width: '100%', maxWidth: 360, aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 2 }} />}
      {configuration.isPending && <Typography>Sprawdzanie konfiguracji obrazów…</Typography>}
      {configuration.isError && <Alert severity="error" action={<Button onClick={() => void configuration.refetch()}>Ponów</Button>}>Nie udało się sprawdzić konfiguracji obrazów.</Alert>}
      {configuration.data && !configuration.data.enabled && <Alert severity="info">Dodawanie obrazów będzie dostępne po konfiguracji Bunny Storage na serwerze. Jest niezależne od konfiguracji wideo.</Alert>}
      <Box onDragOver={(event) => { event.preventDefault(); event.stopPropagation() }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); choose(event.dataTransfer.files) }} sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 3, textAlign: 'center' }}>
        <Typography>Przeciągnij tutaj obrazek kafelka</Typography>
        <Typography variant="body2" color="text.secondary">PNG lub JPEG{configuration.data ? `, maks. ${Math.floor(configuration.data.maximumBytes / 1024 / 1024)} MB` : ''}</Typography>
        <input ref={input} type="file" accept="image/png,image/jpeg" aria-label="Wybierz obrazek kafelka" hidden onChange={(event) => { choose(event.target.files); event.target.value = '' }} />
        <Button type="button" disabled={disabled || busy || !configuration.data?.enabled} onClick={() => input.current?.click()}>Wybierz obraz</Button>
      </Box>
      {saved && <Alert severity="success">Zapisano obraz „{saved.asset.displayName}”.</Alert>}
      {error && !file && <Alert severity="error">{error}</Alert>}
    </Stack>
    <Dialog open={Boolean(file)} onClose={saving ? undefined : clear} fullWidth maxWidth="sm">
      <DialogTitle>Obrazek kafelka — nazwa w bibliotece</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        {preview && <Box component="img" src={preview} alt="Podgląd wybranego obrazka" sx={{ maxHeight: 240, objectFit: 'contain' }} />}
        <Typography>{file?.name}</Typography>
        <TextField autoFocus required label="Nazwa w bibliotece" value={name} disabled={uploading || Boolean(prepared)} onBlur={() => setNameTouched(true)} onChange={(event) => setName(event.target.value)} error={nameTouched && (!name.trim() || name.trim().length > 200)} helperText={nameTouched && (!name.trim() || name.trim().length > 200) ? 'Podaj nazwę od 1 do 200 znaków.' : 'Nazwa redakcyjna widoczna w bibliotece mediów.'} />
        {uploading && <><LinearProgress aria-label="Przesyłanie obrazu" /><Typography>Przesyłanie obrazu…</Typography></>}
        {prepared && <Alert severity="info">Obraz przesłany ({prepared.image.width} × {prepared.image.height} px). Zatwierdź, aby zapisać go w bibliotece{resourceId ? ' i przypisać do treści' : ''}.</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
      </Stack></DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={clear}>Anuluj</Button>
        {conflict && <Button disabled={saving} onClick={() => void save(true)}>Zapisz tylko w bibliotece</Button>}
        {prepared ? <Button variant="contained" disabled={saving} onClick={() => void save()}>Zatwierdź obraz</Button> : <Button variant="contained" disabled={uploading} onClick={() => void transfer()}>Prześlij obraz</Button>}
      </DialogActions>
    </Dialog>
  </Paper>
}
