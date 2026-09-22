import SaveOutlined from '@mui/icons-material/SaveOutlined'
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { SnapshotEditor } from '../../components/forms/SnapshotEditor'
import { parseObject, snapshotErrors } from '../../components/forms/snapshot'
import { createResourceRevision, type ResourceDetail } from './resourceApi'

export function ResourceRevisionForm({ detail }: { detail: ResourceDetail }) {
  const initial = { ...(detail.session ?? detail.material ?? {}), ...detail.currentRevision?.snapshot }
  const [text, setText] = useState(() => JSON.stringify(initial, null, 2))
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const client = useQueryClient()
  const mutation = useMutation({ mutationFn: (snapshot: Record<string, unknown>) => createResourceRevision(detail, snapshot, note.trim() || undefined), retry: false, onSuccess: async () => {
    setNote('')
    await Promise.all([client.invalidateQueries({ queryKey: ['resource', detail.resourceId] }), client.invalidateQueries({ queryKey: ['resource-revisions', detail.resourceId] }), client.invalidateQueries({ queryKey: ['resources'] })])
  } })
  const save = () => {
    const snapshot = parseObject(text)
    const nextErrors = snapshot ? snapshotErrors(snapshot) : ['Wprowadź poprawny obiekt JSON.']
    setErrors(nextErrors)
    if (snapshot && nextErrors.length === 0) mutation.mutate(snapshot)
  }
  return <Paper component="form" noValidate onSubmit={(event) => { event.preventDefault(); save() }} variant="outlined" sx={{ p: 2.5 }}>
    <Stack spacing={2}>
      <Typography component="h2" variant="h5">Nowa rewizja</Typography>
      <Typography color="text.secondary">Edytujesz dane rewizji. Zapis utworzy nową wersję; tytuł katalogowy i opublikowane wydania pozostaną bez zmian.</Typography>
      <SnapshotEditor label="Zrzut JSON nowej rewizji" value={text} onChange={(value) => { setText(value); setErrors([]); mutation.reset() }} disabled={mutation.isPending} suggested={detail.resourceType === 'session' ? { mediaKind: 'video', featured: false, intensity: null } : { materialKind: 'pdf', downloadable: false }} />
      <TextField label="Notatka do rewizji (opcjonalnie)" value={note} disabled={mutation.isPending} onChange={(event) => setNote(event.target.value)} />
      {errors.length > 0 && parseObject(text) && <Alert severity="error">{errors.join(' ')}</Alert>}
      {mutation.isError && <Alert severity="error">Nie udało się zapisać rewizji. Sprawdź stan zasobu przed ponownym zapisem.</Alert>}
      {mutation.isSuccess && <Alert severity="success">Zapisano nową rewizję.</Alert>}
      <Box><Button type="submit" disabled={mutation.isPending} variant="contained" startIcon={<SaveOutlined />}>{mutation.isPending ? 'Zapisywanie…' : 'Zapisz rewizję'}</Button></Box>
    </Stack>
  </Paper>
}
