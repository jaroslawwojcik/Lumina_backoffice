import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined'
import SendOutlined from '@mui/icons-material/SendOutlined'
import { Alert, Box, Button, CircularProgress, FormControl, InputLabel, List, ListItemButton, ListItemText, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { hasAnyPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/useAuth'
import { ExistingMediaSelect } from '../media/ExistingMediaSelect'
import { SessionAudioUpload } from '../media/SessionAudioUpload'
import { SessionVideoUpload } from '../media/SessionVideoUpload'
import { ThumbnailImageUpload } from '../media/ThumbnailImageUpload'
import { DraftPreview } from './DraftPreview'
import { fieldLabel } from './assistantLabels'
import { ProgramSections } from './ProgramSections'
import { confirmDraft, createDraft, discardDraft, fetchDraft, fetchDrafts, fetchProviders, sendMessage, updateDraft, type AssistantDraft, type DraftUpdate } from './assistantApi'

export function ContentAssistantPage() {
  const [params] = useSearchParams()
  const selectedId = params.get('draft')
  const navigate = useNavigate()
  const client = useQueryClient()
  const { permissions } = useAuth()
  const providers = useQuery({ queryKey: ['content-assistant', 'providers'], queryFn: ({ signal }) => fetchProviders(signal), retry: false })
  const drafts = useQuery({ queryKey: ['content-assistant', 'drafts'], queryFn: ({ signal }) => fetchDrafts(signal) })
  const draft = useQuery({ queryKey: ['content-assistant', 'draft', selectedId], queryFn: ({ signal }) => fetchDraft(selectedId!, signal), enabled: Boolean(selectedId), retry: false })
  const refresh = async (value: AssistantDraft) => {
    client.setQueryData(['content-assistant', 'draft', value.id], value)
    await client.invalidateQueries({ queryKey: ['content-assistant', 'drafts'] })
  }
  const create = useMutation({ mutationFn: (kind: 'session' | 'program') => createDraft(crypto.randomUUID(), kind), onSuccess: async (value) => { await refresh(value); navigate(`/assistant?draft=${value.id}`) } })
  const remove = useMutation({ mutationFn: (value: AssistantDraft) => discardDraft(value.id, value.version), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['content-assistant', 'drafts'] }); navigate('/assistant') } })
  return <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1500, mx: 'auto' }}>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
      <Box><Typography component="h1" variant="h3">Asystent treści</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Twórz robocze sesje i programy w rozmowie. Zapis nastąpi dopiero po Twoim zatwierdzeniu.</Typography></Box>
      <Stack direction="row" spacing={1}><Button disabled={create.isPending} onClick={() => create.mutate('session')} variant="contained">Nowa sesja</Button><Button disabled={create.isPending} onClick={() => create.mutate('program')} variant="outlined">Nowy program</Button></Stack>
    </Stack>
    {providers.isError && <Alert severity="error" sx={{ mt: 2 }} action={<Button onClick={() => void providers.refetch()}>Sprawdź ponownie</Button>}>Nie udało się sprawdzić dostępności GitHub Copilot. Sprawdź połączenie z serwerem.</Alert>}
    {create.isError && <Alert severity="error" sx={{ mt: 2 }}>Nie udało się rozpocząć rozmowy.</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '280px minmax(0, 1fr)' }, gap: 3, mt: 3 }}>
      <Paper variant="outlined" sx={{ alignSelf: 'start', overflow: 'hidden' }}>
        <Typography sx={{ px: 2, pt: 2 }} variant="h6">Niedokończone</Typography>
        {drafts.isPending && <Box sx={{ p: 2 }}><CircularProgress size={24} /></Box>}
        {drafts.isError && <Alert severity="error">Nie udało się pobrać szkiców.</Alert>}
        <List>{drafts.data?.filter((item) => item.status === 'draft').map((item) => <ListItemButton component={Link} selected={item.id === selectedId} key={item.id} to={`/assistant?draft=${item.id}`}><ListItemText primary={item.proposal.title || (item.kind === 'session' ? 'Nowa sesja' : 'Nowy program')} secondary={item.kind === 'session' ? 'Sesja' : 'Program'} /></ListItemButton>)}</List>
        {!drafts.isPending && !drafts.data?.some((item) => item.status === 'draft') && <Typography color="text.secondary" sx={{ p: 2 }}>Nie masz niedokończonych szkiców.</Typography>}
      </Paper>
      {!selectedId ? <Paper variant="outlined" sx={{ p: 4, minHeight: 320, display: 'grid', placeItems: 'center', textAlign: 'center' }}><Box><AutoAwesomeOutlined color="primary" sx={{ fontSize: 42 }} /><Typography variant="h5" sx={{ mt: 1 }}>Zacznij od krótkiego opisu</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Asystent dopyta o brakujące informacje i przygotuje propozycję do przejrzenia.</Typography></Box></Paper>
        : draft.isPending ? <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}><CircularProgress /></Paper>
          : draft.isError || !draft.data ? <Alert severity="error">Nie udało się otworzyć szkicu.</Alert>
            : <Workspace draft={draft.data} providers={providers.data ?? []} providersPending={providers.isPending} providersFailed={providers.isError} canReadMedia={hasAnyPermission(permissions, ['media.read'])} canUploadMedia={hasAnyPermission(permissions, ['media.upload'])} onChange={refresh} onDiscard={() => remove.mutate(draft.data!)} />}
    </Box>
  </Box>
}

function Workspace({ draft, providers, providersPending, providersFailed, canReadMedia, canUploadMedia, onChange, onDiscard }: { draft: AssistantDraft; providers: { id: string; models: string[] }[]; providersPending: boolean; providersFailed: boolean; canReadMedia: boolean; canUploadMedia: boolean; onChange: (draft: AssistantDraft) => Promise<void>; onDiscard: () => void }) {
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [accessTier, setAccessTier] = useState<DraftUpdate['accessTier']>(draft.accessTier)
  const [primaryAssetId, setPrimaryAssetId] = useState<string | null>(draft.primaryAssetId)
  const [thumbnailAssetId, setThumbnailAssetId] = useState<string | null>(draft.thumbnailAssetId)
  const [uploadBusy, setUploadBusy] = useState(false)
  const selectedProvider = providers.find((item) => item.id === 'copilot')
  const selectedModel = selectedProvider?.models[0] ?? ''
  const send = useMutation({ mutationFn: () => sendMessage(draft.id, { expectedVersion: draft.version, requestId: crypto.randomUUID(), message }), onSuccess: async (value) => { setMessage(''); await onChange(value) } })
  const save = useMutation({ mutationFn: (payload: Partial<DraftUpdate> = {}) => updateDraft(draft.id, { expectedVersion: draft.version, proposal: payload.proposal ?? draft.proposal, primaryAssetId: payload.primaryAssetId === undefined ? primaryAssetId : payload.primaryAssetId, thumbnailAssetId: payload.thumbnailAssetId === undefined ? thumbnailAssetId : payload.thumbnailAssetId, accessTier: payload.accessTier === undefined ? accessTier : payload.accessTier }), onSuccess: onChange })
  const confirm = useMutation({ mutationFn: () => confirmDraft(draft.id, draft.version), onSuccess: async (value) => { await onChange(value); navigate(`/content/${draft.kind}s/${value.resourceId}`) } })
  const missing = useMemo(() => draft.missingFields.map(fieldLabel), [draft.missingFields])
  const busy = send.isPending || save.isPending || confirm.isPending || uploadBusy
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(380px, .9fr) minmax(420px, 1.1fr)' }, gap: 3 }}>
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, minHeight: 600, display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h5">Rozmowa</Typography>
      <Stack spacing={1.5} sx={{ my: 2, flex: 1, maxHeight: 620, overflowY: 'auto' }} aria-live="polite">
        {draft.messages.map((item, index) => <Box key={index} sx={{ alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start', bgcolor: item.role === 'user' ? 'primary.main' : 'var(--color-paper-3)', color: item.role === 'user' ? 'primary.contrastText' : 'text.primary', px: 2, py: 1.25, borderRadius: 2, maxWidth: '88%', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.content}</Box>)}
      </Stack>
      {providersPending && <Typography role="status">Sprawdzanie dostępności GitHub Copilot…</Typography>}
      {!providersPending && !providersFailed && !selectedProvider && <Alert severity="warning">GitHub Copilot jest niedostępny. Administrator serwera musi sprawdzić konfigurację i dostęp do subskrypcji. Szkic pozostaje zapisany.</Alert>}
      {selectedProvider && <Typography color="text.secondary" sx={{ mb: 1 }}>Rozmowę prowadzi GitHub Copilot.</Typography>}
      {send.isError && <Alert severity="error" sx={{ mb: 1 }}>Nie udało się uzyskać odpowiedzi GitHub Copilot. Możesz ponowić wiadomość.</Alert>}
      <TextField label="Wiadomość" multiline minRows={3} value={message} disabled={busy || !selectedProvider || !selectedModel || draft.status !== 'draft'} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && message.trim() && !busy && selectedProvider && selectedModel && draft.status === 'draft') send.mutate() }} helperText="Ctrl/Cmd + Enter wysyła wiadomość" />
      <Button startIcon={<SendOutlined />} variant="contained" sx={{ mt: 1, alignSelf: 'flex-end' }} disabled={busy || !selectedProvider || !selectedModel || draft.status !== 'draft' || !message.trim()} onClick={() => send.mutate()}>{send.isPending ? 'Asystent przygotowuje odpowiedź…' : 'Wyślij'}</Button>
    </Paper>
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}><DraftPreview draft={draft} /></Paper>
      {draft.status === 'draft' && <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}><Stack spacing={2}>
        <Typography variant="h5">Pliki i dostęp</Typography>
        <Alert severity="info">Pliki są najpierw zapisywane w bibliotece mediów. Po udanym zapisie przypiszemy je do tego szkicu.</Alert>
        <FormControl fullWidth><InputLabel>Poziom dostępu</InputLabel><Select label="Poziom dostępu" value={accessTier ?? ''} disabled={busy} onChange={(event) => setAccessTier(event.target.value as DraftUpdate['accessTier'])}><MenuItem value="free">Bezpłatny</MenuItem><MenuItem value="premium">Premium</MenuItem><MenuItem value="purchase">Zakup</MenuItem></Select></FormControl>
        {draft.kind === 'session' && canReadMedia && <ExistingMediaSelect kind={draft.proposal.mediaKind ?? 'video'} label={draft.proposal.mediaKind === 'audio' ? 'Nagranie audio z biblioteki' : 'Film z biblioteki'} value={primaryAssetId ?? undefined} disabled={busy} onChange={(asset) => setPrimaryAssetId(asset?.id ?? null)} />}
        {canReadMedia && <ExistingMediaSelect kind="image" label="Miniatura z biblioteki" value={thumbnailAssetId ?? undefined} disabled={busy} onChange={(asset) => setThumbnailAssetId(asset?.id ?? null)} />}
        {draft.kind === 'session' && canUploadMedia && draft.proposal.mediaKind === 'video' && <SessionVideoUpload libraryOnly onBusyChange={setUploadBusy} onSaved={(result) => setPrimaryAssetId(result.asset.id)} />}
        {draft.kind === 'session' && canUploadMedia && draft.proposal.mediaKind === 'audio' && <SessionAudioUpload onBusyChange={setUploadBusy} onSaved={(result) => setPrimaryAssetId(result.asset.id)} />}
        {canUploadMedia && <ThumbnailImageUpload onBusyChange={setUploadBusy} onSaved={(result) => setThumbnailAssetId(result.asset.id)} />}
        <Button variant="outlined" disabled={busy} onClick={() => save.mutate({ primaryAssetId, thumbnailAssetId, accessTier })}>Zapisz pliki i dostęp w szkicu</Button>
      </Stack></Paper>}
      {draft.kind === 'program' && draft.status === 'draft' && <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}><ProgramSections key={draft.version} proposal={draft.proposal} disabled={busy} onSave={(proposal) => save.mutate({ proposal })} /></Paper>}
      {draft.status === 'draft' && <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}><Stack spacing={2}>
        <Typography variant="h5">Zatwierdzenie</Typography>
        {missing.length > 0 ? <Alert severity="warning">Brakuje: {missing.join(', ')}.</Alert> : <Alert severity="success">Szkic jest kompletny. Zatwierdzenie utworzy roboczą treść; nie opublikuje jej.</Alert>}
        {(save.isError || confirm.isError) && <Alert severity="error">Operacja nie została zakończona. Odśwież szkic przed ponowieniem, jeśli inna karta mogła go zmienić.</Alert>}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><Button variant="contained" disabled={busy || missing.length > 0} onClick={() => confirm.mutate()}>{confirm.isPending ? 'Zapisywanie całej treści…' : `Zatwierdź i utwórz ${draft.kind === 'session' ? 'sesję' : 'program'}`}</Button><Button color="error" startIcon={<DeleteOutlineOutlined />} disabled={busy} onClick={onDiscard}>Usuń szkic</Button></Stack>
      </Stack></Paper>}
      {draft.status === 'saved' && <Alert severity="success">Treść została utworzona. <Button component={Link} to={`/content/${draft.kind}s/${draft.resourceId}`}>Otwórz</Button></Alert>}
    </Stack>
  </Box>
}
