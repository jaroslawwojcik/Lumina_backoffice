import { ApiError } from '../../api/apiError'
import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, TextField, Typography } from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload } from 'tus-js-client'
import { completeVideoUpload, prepareVideoUpload, videoFileError, videoUploadConfiguration, videoUploadStatus, type CompletedVideo, type PreparedVideo } from './videoUploadApi'

type Stage = 'idle' | 'preparing' | 'uploading' | 'paused' | 'processing' | 'saving' | 'done' | 'transferError'
export function SessionVideoUpload({ resourceId, expectedRevisionId, onSaved, onBusyChange, libraryOnly = false }: { resourceId?: string; expectedRevisionId?: string; onSaved?: (result: CompletedVideo) => void; onBusyChange?: (busy: boolean) => void; libraryOnly?: boolean }) {
  const configuration = useQuery({ queryKey: ['video-upload-configuration'], queryFn: ({ signal }) => videoUploadConfiguration(signal), retry: false })
  const [file, setFile] = useState<File>()
  const [name, setName] = useState('')
  const [dialog, setDialog] = useState(false)
  const [stage, setStage] = useState<Stage>('idle')
  const [prepared, setPrepared] = useState<PreparedVideo>()
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string>()
  const [conflict, setConflict] = useState(false)
  const [attached, setAttached] = useState(false)
  const upload = useRef<Upload>(null)
  const active = useRef(true)
  const generation = useRef(0)
  const client = useQueryClient()
  const busy = !['idle', 'done'].includes(stage)
  useEffect(() => { onBusyChange?.(busy) }, [busy, onBusyChange])
  useEffect(() => { active.current = true; return () => { active.current = false; void upload.current?.abort(); } }, [])
  useEffect(() => {
    if (!busy) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])
  const status = useQuery({ queryKey: ['video-upload-status', prepared?.credentials.videoId], queryFn: ({ signal }) => videoUploadStatus(prepared!.ticket, signal), enabled: stage === 'processing' && Boolean(prepared), retry: false,
    refetchInterval: (query) => query.state.error || query.state.data?.status === 'ready' || query.state.data?.status === 'failed' ? false : 3000 })

  const choose = (selected?: File) => {
    if (!selected || !configuration.data?.enabled || busy) return
    const problem = videoFileError(selected, configuration.data.maximumBytes, configuration.data.mimeTypes)
    setError(problem)
    if (problem) return
    setFile(selected); setName(selected.name.replace(/\.[^.]+$/, '')); setDialog(true)
  }
  const start = async () => {
    if (!file || !name.trim() || name.trim().length > 200) { setError('Nazwa w bibliotece jest wymagana (maksymalnie 200 znaków).'); return }
    setError(undefined); setStage('preparing'); setDialog(false); setProgress(0)
    const attempt = ++generation.current
    try {
      const result = await prepareVideoUpload(file, name, resourceId, expectedRevisionId)
      if (!active.current || generation.current !== attempt) return
      setPrepared(result)
      const credentials = result.credentials
      upload.current = new Upload(file, {
        endpoint: credentials.endpoint, retryDelays: [0, 3000, 5000, 10000, 20000], storeFingerprintForResuming: false,
        headers: { AuthorizationSignature: credentials.signature, AuthorizationExpire: String(credentials.expiresAt), LibraryId: credentials.libraryId, VideoId: credentials.videoId },
        metadata: { filetype: file.type, title: name.trim() },
        onProgress: (sent, total) => { if (active.current && generation.current === attempt) setProgress(Math.round(sent / total * 100)) },
        onSuccess: () => { if (active.current && generation.current === attempt) setStage('processing') },
        onError: () => { if (active.current && generation.current === attempt) { setStage('transferError'); setError('Transfer przerwany. Możesz wznowić go na tej stronie, jeśli autoryzacja nadal jest ważna.'); } },
      })
      setStage('uploading'); upload.current.start()
    } catch (problem) { if (active.current && generation.current === attempt) { setStage('idle'); setError(problem instanceof Error ? problem.message : 'Nie udało się przygotować uploadu.'); } }
  }
  const cancel = async () => {
    generation.current++; await upload.current?.abort(); upload.current = null
    setStage('idle'); setConflict(false); setPrepared(undefined); setError(undefined); setProgress(0)
  }
  const save = async (saveToLibrary = false) => {
    if (!prepared || status.data?.status !== 'ready') return
    setStage('saving'); setError(undefined)
    try {
      const result = await completeVideoUpload(prepared.ticket, saveToLibrary)
      if (!active.current) return
      setStage('done'); setAttached(Boolean(result.resourceId)); setConflict(false); onSaved?.(result)
      await Promise.all([['assets'], ['resource', resourceId], ['resource-revisions', resourceId], ['resource-assets', resourceId], ['resources']].map((queryKey) => client.invalidateQueries({ queryKey })))
    } catch (problem) { if (active.current) { setStage('processing'); setConflict(problem instanceof ApiError && problem.status === 409); setError(problem instanceof Error ? problem.message : 'Nie udało się zapisać filmu. Ponów zapis tego samego uploadu.'); } }
  }
  return <Box sx={{ border: '1px dashed', borderColor: 'primary.light', borderRadius: 2, p: 2.5 }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); choose(event.dataTransfer.files[0]) }}>
    <Stack spacing={2}>
      <Typography variant="h6">{libraryOnly ? 'Wideo do biblioteki' : 'Główne wideo'}</Typography>
      {configuration.isPending && <Typography>Sprawdzanie dostępności uploadu…</Typography>}
      {configuration.isError && <Alert severity="warning">Nie można sprawdzić konfiguracji uploadu. <Button onClick={() => void configuration.refetch()}>Spróbuj ponownie</Button></Alert>}
      {configuration.data && !configuration.data.enabled && <Alert severity="info">Upload wideo czeka na konfigurację Bunny po stronie serwera.</Alert>}
      <Typography color="text.secondary">Przeciągnij film lub wybierz go z dysku. Film zostanie zapisany po zakończeniu przetwarzania. Odświeżenie strony przerywa ten proces.</Typography>
      {!busy && <Button component="label" variant="outlined" disabled={!configuration.data?.enabled}>Wybierz plik<input hidden aria-label="Plik głównego wideo" type="file" accept={configuration.data?.mimeTypes.join(',')} onChange={(event) => { choose(event.target.files?.[0]); event.target.value = '' }} /></Button>}
      {busy && <Typography>{name} · {file?.name}</Typography>}
      {stage === 'preparing' && <Typography role="status">Przygotowanie transferu…</Typography>}
      {['uploading', 'paused', 'transferError'].includes(stage) && <><LinearProgress variant="determinate" value={progress} aria-label="Postęp przesyłania" /><Typography role="status">Przesłano {progress}%{stage === 'paused' ? ' — wstrzymano' : ''}</Typography></>}
      {stage === 'uploading' && <Button onClick={() => { void upload.current?.abort().then(() => setStage('paused')) }}>Wstrzymaj</Button>}
      {['paused', 'transferError'].includes(stage) && <Button onClick={() => { setError(undefined); setStage('uploading'); upload.current?.start() }}>Wznów</Button>}
      {stage === 'processing' && <>
        {status.data?.status === 'ready' ? <Alert severity="success">Film gotowy: {status.data.durationSeconds} s · {status.data.width}×{status.data.height}. Można zapisać medium.</Alert>
          : status.data?.status === 'failed' ? <Alert severity="error">Bunny nie przetworzył filmu. Anuluj i wybierz inny plik.</Alert>
            : <Typography role="status">Plik przesłany. Trwa przetwarzanie filmu: {status.data?.encodeProgress ?? 0}%.</Typography>}
        {status.isError && <Alert severity="error">Nie można pobrać statusu. <Button onClick={() => void status.refetch()}>Sprawdź ponownie</Button></Alert>}
        {status.data?.status === 'ready' && <Button variant="contained" onClick={() => void save()}>{libraryOnly ? 'Zapisz film w bibliotece' : resourceId ? 'Zapisz film i nową rewizję' : 'Dodaj gotowy film do sesji'}</Button>}
      </>}
      {stage === 'saving' && <Typography role="status">Zapisywanie gotowego filmu…</Typography>}
      {stage === 'done' && <Alert severity="success">Film zapisany w bibliotece{attached ? ' i przypisany w nowej rewizji sesji.' : resourceId ? '. Możesz go teraz wybrać w sekcji Media.' : '. Zapisz formularz, aby utworzyć sesję z tym filmem.'}</Alert>}
      {busy && stage !== 'saving' && <Button color="inherit" onClick={() => void cancel()}>Anuluj upload</Button>}
      {error && <Alert severity="error">{error}</Alert>}
      {conflict && stage === 'processing' && resourceId && <Button onClick={() => void save(true)}>Zapisz film tylko w bibliotece</Button>}
    </Stack>
    <Dialog open={dialog} onClose={() => { setDialog(false); setError(undefined) }} fullWidth maxWidth="sm">
      <DialogTitle>Dodaj do biblioteki mediów</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <TextField autoFocus required label="Nazwa w bibliotece" value={name} onChange={(event) => setName(event.target.value)} error={Boolean(error)} helperText={error ?? 'Maksymalnie 200 znaków.'} slotProps={{ htmlInput: { maxLength: 200 } }} />
        <Typography>Plik: {file?.name}</Typography><Typography>Rola: główne wideo · Bunny Stream</Typography>
        {resourceId && <Alert severity="info">Nowy film zastąpi główne wideo w nowej rewizji. Opublikowana wersja zachowa dotychczasowy plik.</Alert>}
      </Stack></DialogContent><DialogActions><Button onClick={() => setDialog(false)}>Anuluj</Button><Button variant="contained" onClick={() => void start()}>Prześlij film</Button></DialogActions>
    </Dialog>
  </Box>
}

