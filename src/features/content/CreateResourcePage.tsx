import { SessionAudioUpload } from '../media/SessionAudioUpload'
import { ThumbnailImageUpload } from '../media/ThumbnailImageUpload'
import { useState } from 'react'
import { SessionVideoUpload } from '../media/SessionVideoUpload'
import { useAuth } from '../../auth/useAuth'
import { hasAnyPermission } from '../../auth/permissions'
import { FormJsonPreview } from '../../components/forms/FormJsonPreview'
import { SnapshotEditor } from '../../components/forms/SnapshotEditor'
import { parseObject, snapshotErrors } from '../../components/forms/snapshot'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import { Alert, Box, Button, Checkbox, FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { createMaterial, createMaterialSchema, createSession, createSessionSchema, type CreateMaterial, type CreateSession } from './resourceApi'

const safeKeyMessage = 'Użyj małych liter, cyfr i pojedynczych myślników.'
const keySchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, safeKeyMessage)

type FormValues = {
  canonicalKey: string
  locale: string
  slug: string
  title: string
  summary: string
  description: string
  accessTier: 'free' | 'premium' | 'purchase'
  mediaKind: 'video' | 'audio'
  durationSeconds: string
  materialKind: 'pdf' | 'audio' | 'video' | 'image' | 'document'
  downloadable: boolean
  snapshotText: string
}

const defaults: FormValues = { canonicalKey: '', locale: 'pl', slug: '', title: '', summary: '', description: '', accessTier: 'free', mediaKind: 'video', durationSeconds: '', materialKind: 'pdf', downloadable: false, snapshotText: '{\n  \n}' }

export function CreateResourcePage({ resourceType }: { resourceType: 'session' | 'material' }) {
  const { permissions } = useAuth()
  const [primaryAssetId, setPrimaryAssetId] = useState<string>()
  const [audioAssetId, setAudioAssetId] = useState<string>()
  const [audioBusy, setAudioBusy] = useState(false)
  const [videoBusy, setUploadBusy] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [thumbnailAssetId, setThumbnailAssetId] = useState<string>()
  const uploadBusy = videoBusy || audioBusy || imageBusy
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const form = useForm<FormValues>({ defaultValues: defaults, mode: 'onBlur' })
  const mediaKind = useWatch({ control: form.control, name: 'mediaKind' })
  const mutation = useMutation({
    mutationFn: (payload: CreateSession | CreateMaterial) => resourceType === 'session' ? createSession(payload as CreateSession) : createMaterial(payload as CreateMaterial),
    retry: false,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['resources'] })
      navigate(`/content/${resourceType}s/${result.resourceId}`)
    },
  })
  const submit = (values: FormValues) => {
    if (uploadBusy) return
    const snapshotResult = z.record(z.string(), z.unknown()).safeParse(parseSnapshot(values.snapshotText))
    if (!snapshotResult.success) {
      form.setError('snapshotText', { message: 'Wprowadź poprawny obiekt JSON.' })
      return
    }
    const errors = snapshotErrors(snapshotResult.data)
    if (errors.length) { form.setError('snapshotText', { message: errors.join(' ') }); return }
    const shared = { canonicalKey: values.canonicalKey, locale: values.locale, slug: values.slug, title: values.title, ...(values.summary.trim() ? { summary: values.summary.trim() } : {}), ...(values.description.trim() ? { description: values.description.trim() } : {}), snapshot: snapshotResult.data, accessTier: values.accessTier, ...(thumbnailAssetId ? { thumbnailAssetId } : {}) }
    if (resourceType === 'session') {
      const payload = createSessionSchema.safeParse({ ...shared, mediaKind: values.mediaKind, durationSeconds: Number(values.durationSeconds), ...((values.mediaKind === 'video' ? primaryAssetId : audioAssetId) ? { primaryAssetId: values.mediaKind === 'video' ? primaryAssetId : audioAssetId } : {}) })
      if (!payload.success) return setSchemaErrors(form, payload.error)
      mutation.mutate(payload.data as CreateSession)
      return
    }
    const payload = createMaterialSchema.safeParse({ ...shared, materialKind: values.materialKind, downloadable: values.downloadable })
    if (!payload.success) return setSchemaErrors(form, payload.error)
    mutation.mutate(payload.data)
  }
  const title = resourceType === 'session' ? 'Nowa sesja' : 'Nowy materiał'
  return <Box sx={{ maxWidth: 900, p: { xs: 2, sm: 3.25 } }}>
    <Button component={Link} startIcon={<ArrowBackOutlined />} to="/content">Wróć do treści</Button>
    <Typography component="h1" sx={{ mt: 2 }} variant="h3">{title}</Typography>
    <Typography color="text.secondary" sx={{ mt: 1 }}>Utwórz zasób i jego pierwszą rewizję.</Typography>
    <Paper component="form" elevation={0} noValidate onSubmit={form.handleSubmit(submit)} sx={{ border: '1px solid #e4e1e9', mt: 3, p: { xs: 2, sm: 3 } }}>
      <Stack spacing={2.5}>
        <TextField autoFocus error={Boolean(form.formState.errors.canonicalKey)} helperText={form.formState.errors.canonicalKey?.message} label="Klucz kanoniczny" {...form.register('canonicalKey', { validate: (value) => keySchema.safeParse(value).success || safeKeyMessage })} required />
        <Controller control={form.control} name="locale" render={({ field }) => <FormControl fullWidth><InputLabel id="locale-label">Język</InputLabel><Select {...field} label="Język" labelId="locale-label"><MenuItem value="pl">Polski</MenuItem><MenuItem value="en">Angielski</MenuItem><MenuItem value="pl-pl">Polski (Polska)</MenuItem><MenuItem value="en-us">Angielski (USA)</MenuItem></Select></FormControl>} />
        <TextField error={Boolean(form.formState.errors.slug)} helperText={form.formState.errors.slug?.message} label="Slug" {...form.register('slug', { validate: (value) => keySchema.safeParse(value).success || safeKeyMessage })} required />
        <TextField error={Boolean(form.formState.errors.title)} helperText={form.formState.errors.title?.message} label="Tytuł" {...form.register('title', { required: 'Tytuł jest wymagany.', validate: (value) => value.trim().length > 0 || 'Tytuł jest wymagany.' })} required />
        <TextField label="Krótki opis (opcjonalnie)" {...form.register('summary')} />
        <TextField label="Opis (opcjonalnie)" minRows={4} multiline {...form.register('description')} />
        <Controller control={form.control} name="accessTier" render={({ field }) => <FormControl fullWidth><InputLabel id="access-tier-label">Dostęp</InputLabel><Select {...field} label="Dostęp" labelId="access-tier-label"><MenuItem value="free">Bezpłatny</MenuItem><MenuItem value="premium">Premium</MenuItem><MenuItem value="purchase">Zakup</MenuItem></Select></FormControl>} />
        {resourceType === 'session' ? <><Controller control={form.control} name="mediaKind" render={({ field }) => <FormControl fullWidth><InputLabel id="media-kind-label">Format sesji</InputLabel><Select {...field} disabled={uploadBusy} label="Format sesji" labelId="media-kind-label"><MenuItem value="video">Wideo</MenuItem><MenuItem value="audio">Audio</MenuItem></Select></FormControl>} /><TextField error={Boolean(form.formState.errors.durationSeconds)} helperText={form.formState.errors.durationSeconds?.message} label="Czas trwania (sekundy)" slotProps={{ input: { readOnly: Boolean(mediaKind === 'video' ? primaryAssetId : audioAssetId) }, htmlInput: { min: 1 } }} type="number" {...form.register('durationSeconds', { validate: (value) => Number.isInteger(Number(value)) && Number(value) > 0 || 'Podaj dodatnią liczbę całkowitą.' })} required /></> : <><Controller control={form.control} name="materialKind" render={({ field }) => <FormControl fullWidth><InputLabel id="material-kind-label">Typ materiału</InputLabel><Select {...field} label="Typ materiału" labelId="material-kind-label"><MenuItem value="pdf">PDF</MenuItem><MenuItem value="audio">Audio</MenuItem><MenuItem value="video">Wideo</MenuItem><MenuItem value="image">Obraz</MenuItem><MenuItem value="document">Dokument</MenuItem></Select></FormControl>} /><Controller control={form.control} name="downloadable" render={({ field }) => <FormControlLabel control={<Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />} label="Można pobrać" />} /></>}
        {resourceType === 'session' && mediaKind === 'video' && hasAnyPermission(permissions, ['media.upload']) && <SessionVideoUpload onBusyChange={setUploadBusy} onSaved={(result) => { setPrimaryAssetId(result.asset.id); form.setValue('durationSeconds', String(result.asset.durationSeconds), { shouldValidate: true }) }} />}
        {hasAnyPermission(permissions, ['media.upload']) && <ThumbnailImageUpload disabled={mutation.isPending} onBusyChange={setImageBusy} onSaved={(result) => setThumbnailAssetId(result.asset.id)} />}
        {resourceType === 'session' && mediaKind === 'audio' && hasAnyPermission(permissions, ['media.upload']) && <SessionAudioUpload disabled={mutation.isPending} onBusyChange={setAudioBusy} onSaved={(result) => { setAudioAssetId(result.asset.id); form.setValue('durationSeconds', String(result.asset.durationSeconds), { shouldValidate: true }) }} />}
        <Typography variant="h6">Dane pierwszej rewizji</Typography>
        <Controller control={form.control} name="snapshotText" render={({ field }) => <SnapshotEditor label="Zrzut JSON pierwszej rewizji" value={field.value} onChange={field.onChange} disabled={mutation.isPending || uploadBusy} suggested={resourceType === 'session' ? { featured: false, intensity: null } : { downloadable: false }} />} />
        {form.formState.errors.snapshotText && parseObject(form.getValues('snapshotText')) && <Alert severity="error">{form.formState.errors.snapshotText.message}</Alert>}
        <FormJsonPreview control={form.control} project={(values) => ({ canonicalKey: values.canonicalKey, locale: values.locale, slug: values.slug, title: values.title, summary: values.summary || undefined, description: values.description || undefined, accessTier: values.accessTier, ...(thumbnailAssetId ? { thumbnailAssetId } : {}), ...(resourceType === 'session' ? { mediaKind: values.mediaKind, ...((values.mediaKind === 'video' ? primaryAssetId : audioAssetId) ? { primaryAssetId: values.mediaKind === 'video' ? primaryAssetId : audioAssetId } : {}), durationSeconds: values.durationSeconds === '' ? null : Number(values.durationSeconds) } : { materialKind: values.materialKind, downloadable: values.downloadable }), snapshot: parseSnapshot(values.snapshotText) ?? null })} />        {mutation.isError && <Alert severity="error">Nie udało się utworzyć zasobu. Stan zapisu jest nieznany.</Alert>}
        <Box><Button disabled={mutation.isPending || uploadBusy} startIcon={<SaveOutlined />} type="submit" variant="contained">Utwórz {resourceType === 'session' ? 'sesję' : 'materiał'}</Button></Box>
      </Stack>
    </Paper>
  </Box>
}

function parseSnapshot(value: string): unknown {
  try { return JSON.parse(value) } catch { return undefined }
}

function setSchemaErrors(form: ReturnType<typeof useForm<FormValues>>, error: z.ZodError): void {
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof FormValues | undefined
    if (field) form.setError(field, { message: issue.message })
  }
}





