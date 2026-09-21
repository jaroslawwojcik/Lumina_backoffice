import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Paper, Stack, TextField, Typography } from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../api/apiError'
import { audioFileError, audioUploadConfiguration, completeAudioUpload, uploadAudio, type CompletedAudio, type PreparedAudio } from './audioUploadApi'

type Props = { resourceId?: string; expectedRevisionId?: string; disabled?: boolean; onBusyChange?: (busy: boolean) => void; onSaved?: (audio: CompletedAudio) => void }

export function SessionAudioUpload({ resourceId, expectedRevisionId, disabled, onBusyChange, onSaved }: Props) {
  const configuration = useQuery({ queryKey: ['audio-upload-configuration'], queryFn: ({ signal }) => audioUploadConfiguration(signal), retry: false })
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File>()
  const [name, setName] = useState('')
  const [prepared, setPrepared] = useState<PreparedAudio>()
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [conflict, setConflict] = useState(false)
  const [success, setSuccess] = useState<string>()
  const [nameTouched, setNameTouched] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const busy = Boolean(file)
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false) }, [busy, onBusyChange])
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    if (!busy) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])
  const clear = () => {
    controller.current?.abort(); controller.current = null
    setFile(undefined); setPrepared(undefined); setUploading(false); setError(undefined); setConflict(false)
  }
  const choose = (files: FileList | null) => {
    if (disabled || busy || !configuration.data?.enabled || !files?.length) return
    if (files.length !== 1) { setError('Dodaj jedno główne nagranie.'); return }
    const next = files[0]
    const invalid = audioFileError(next, configuration.data.maximumBytes, configuration.data.mimeTypes)
    if (invalid) { setError(invalid); return }
    setError(undefined); setSuccess(undefined); setName(''); setNameTouched(false); setFile(next)
  }
  const transfer = async () => {
    setNameTouched(true)
    if (!file || !name.trim() || name.trim().length > 200 || uploading) return
    const abort = new AbortController(); controller.current = abort
    setUploading(true); setError(undefined)
    try {
      const result = await uploadAudio(file, name, abort.signal, resourceId, expectedRevisionId)
      if (!abort.signal.aborted) setPrepared(result)
    } catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Nie udało się przesłać nagrania.') }
    finally { if (!abort.signal.aborted) setUploading(false) }
  }
  const save = async (libraryOnly = false) => {
    if (!prepared || saving) return
    setSaving(true); setError(undefined); setConflict(false)
    try {
      const result = await completeAudioUpload(prepared.ticket, libraryOnly)
      if (!libraryOnly) onSaved?.(result)
      clear()
      setSuccess(libraryOnly ? 'Nagranie zapisano tylko w bibliotece. Przypisz je po odświeżeniu sesji.' : `Zapisano nagranie „${result.asset.displayName}” (${result.asset.durationSeconds} s).`)
      await Promise.all([['assets'], ['resource', resourceId], ['resource-assets', resourceId], ['resource-revisions', resourceId]].map((queryKey) => queryClient.invalidateQueries({ queryKey })))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się zapisać nagrania. Ponów zatwierdzenie.')
      setConflict(failure instanceof ApiError && failure.status === 409)
    } finally { setSaving(false) }
  }
  return <Paper variant="outlined" sx={{ p: 2.5 }}><Stack spacing={2}>
    <Typography component="h2" variant="h6">Główne nagranie audio</Typography>
    <Typography color="text.secondary">Dodaj MP3 lub M4A (AAC). Czas trwania uzupełnimy po sprawdzeniu pliku. Obrazek kafelka dodajesz osobno.</Typography>
    {configuration.isPending && <Typography>Sprawdzanie konfiguracji audio…</Typography>}
    {configuration.isError && <Alert severity="error" action={<Button onClick={() => void configuration.refetch()}>Ponów</Button>}>Nie udało się sprawdzić konfiguracji audio.</Alert>}
    {configuration.data && !configuration.data.enabled && <Alert severity="info">Upload audio wymaga konfiguracji chronionego Bunny Storage/CDN na serwerze (BunnyAudio).</Alert>}
    <Box onDragOver={(event) => { event.preventDefault(); event.stopPropagation() }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); choose(event.dataTransfer.files) }} sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 3, textAlign: 'center' }}>
      <Typography>Przeciągnij tutaj nagranie audio</Typography>
      {configuration.data && <Typography variant="body2" color="text.secondary">Maks. {Math.floor(configuration.data.maximumBytes / 1024 / 1024)} MB</Typography>}
      <input ref={input} type="file" accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,.mp3,.m4a" aria-label="Plik głównego audio" hidden onChange={(event) => { choose(event.target.files); event.target.value = '' }} />
      <Button type="button" disabled={disabled || busy || !configuration.data?.enabled} onClick={() => input.current?.click()}>Wybierz nagranie</Button>
    </Box>
    {success && <Alert severity="success">{success}</Alert>}
    {error && !file && <Alert severity="error">{error}</Alert>}
  </Stack><Dialog open={Boolean(file)} onClose={saving ? undefined : clear} fullWidth maxWidth="sm">
    <DialogTitle>Nagranie audio — nazwa w bibliotece</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <Typography>{file?.name}</Typography>
      <TextField autoFocus required label="Nazwa w bibliotece" value={name} disabled={uploading || Boolean(prepared)} onBlur={() => setNameTouched(true)} onChange={(event) => setName(event.target.value)} error={nameTouched && (!name.trim() || name.trim().length > 200)} helperText={nameTouched && (!name.trim() || name.trim().length > 200) ? 'Podaj nazwę od 1 do 200 znaków.' : 'Nazwa redakcyjna nagrania.'} />
      {uploading && <><LinearProgress aria-label="Przesyłanie audio" /><Typography>Sprawdzanie i przesyłanie nagrania…</Typography></>}
      {prepared && <Alert severity="info">Nagranie przesłane. Potwierdzony czas: {prepared.audio.durationSeconds} s. Zatwierdź, aby zapisać je w bibliotece{resourceId ? ' i przypisać do sesji' : ''}.</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
    </Stack></DialogContent><DialogActions>
      <Button disabled={saving} onClick={clear}>Anuluj</Button>
      {conflict && <Button disabled={saving} onClick={() => void save(true)}>Zapisz tylko w bibliotece</Button>}
      {prepared ? <Button variant="contained" disabled={saving} onClick={() => void save()}>Zatwierdź nagranie</Button> : <Button variant="contained" disabled={uploading} onClick={() => void transfer()}>Prześlij nagranie</Button>}
    </DialogActions></Dialog></Paper>
}
