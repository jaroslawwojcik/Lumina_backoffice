import { ResourcePicker } from '../../components/forms/ResourcePicker'
import { FormJsonPreview } from '../../components/forms/FormJsonPreview'
import { JsonPreview } from '../../components/forms/JsonPreview'
import { SnapshotEditor } from '../../components/forms/SnapshotEditor'
import { parseObject, snapshotErrors } from '../../components/forms/snapshot'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined'
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined'
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import ReplayOutlined from '@mui/icons-material/ReplayOutlined'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/apiError'
import { hasAnyPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/useAuth'
import { createProgram, createProgramSchema, createProgramSection, deleteProgramSection, fetchProgramDraft, reorderProgramSections, replaceProgramSection, type ProgramDraft, type ProgramSectionPayload } from './programApi'

const keyMessage = 'Użyj małych liter, cyfr i pojedynczych myślników.'
const keyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const defaultLocale = 'pl'

type ProgramFormValues = { canonicalKey: string; locale: string; slug: string; title: string; summary: string; description: string; level: string; estimatedDays: string; accessTier: 'free' | 'premium' | 'purchase'; snapshotText: string }
type SectionFormValues = { title: string; description: string; entries: { resourceId: string; inheritProgramAccess: boolean; isOptional: boolean }[] }

const programDefaults: ProgramFormValues = { canonicalKey: '', locale: defaultLocale, slug: '', title: '', summary: '', description: '', level: '', estimatedDays: '', accessTier: 'free', snapshotText: '{\n  \n}' }
const sectionDefaults: SectionFormValues = { title: '', description: '', entries: [{ resourceId: '', inheritProgramAccess: true, isOptional: false }] }

export function CreateProgramPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const form = useForm<ProgramFormValues>({ defaultValues: programDefaults, mode: 'onBlur' })
  const mutation = useMutation({ mutationFn: createProgram, retry: false, onSuccess: async (result) => { await queryClient.invalidateQueries({ queryKey: ['resources'] }); navigate(`/content/programs/${result.resourceId}`) } })
  const submit = (values: ProgramFormValues) => {
    let snapshot: unknown
    try { snapshot = JSON.parse(values.snapshotText) } catch { form.setError('snapshotText', { message: 'Wprowadź poprawny obiekt JSON.' }); return }
    if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) && snapshotErrors(snapshot as Record<string, unknown>).length) { form.setError('snapshotText', { message: snapshotErrors(snapshot as Record<string, unknown>).join(' ') }); return }
    const payload = createProgramSchema.safeParse({ canonicalKey: values.canonicalKey, locale: values.locale, slug: values.slug, title: values.title, ...(values.summary.trim() ? { summary: values.summary.trim() } : {}), ...(values.description.trim() ? { description: values.description.trim() } : {}), ...(values.level.trim() ? { level: values.level.trim() } : {}), ...(values.estimatedDays ? { estimatedDays: Number(values.estimatedDays) } : {}), snapshot, accessTier: values.accessTier })
    if (!payload.success) { for (const issue of payload.error.issues) form.setError(issue.path[0] === 'snapshot' ? 'snapshotText' : issue.path[0] as keyof ProgramFormValues, { message: issue.path[0] === 'snapshot' ? 'Wprowadź poprawny obiekt JSON.' : 'Sprawdź wartość tego pola.' }); return }
    mutation.mutate(payload.data)
  }
  return <Box sx={{ maxWidth: 900, p: { xs: 2, sm: 3.25 } }}>
    <Button component={Link} startIcon={<ArrowBackOutlined />} to="/content">Wróć do treści</Button>
    <Typography component="h1" sx={{ mt: 2 }} variant="h3">Nowy program</Typography>
    <Typography color="text.secondary" sx={{ mt: 1 }}>Utwórz program i jego pierwszą rewizję.</Typography>
    <Paper component="form" elevation={0} noValidate onSubmit={form.handleSubmit(submit)} sx={{ border: '1px solid #e4e1e9', mt: 3, p: { xs: 2, sm: 3 } }}><Stack spacing={2.5}>
      <TextField autoFocus error={Boolean(form.formState.errors.canonicalKey)} helperText={form.formState.errors.canonicalKey?.message} label="Klucz kanoniczny" {...form.register('canonicalKey', { validate: (value) => keyPattern.test(value) || keyMessage })} required />
      <LocaleSelect control={form.control} name="locale" />
      <TextField error={Boolean(form.formState.errors.slug)} helperText={form.formState.errors.slug?.message} label="Slug" {...form.register('slug', { validate: (value) => keyPattern.test(value) || keyMessage })} required />
      <TextField error={Boolean(form.formState.errors.title)} helperText={form.formState.errors.title?.message} label="Tytuł" {...form.register('title', { required: 'Tytuł jest wymagany.', validate: (value) => value.trim().length > 0 || 'Tytuł jest wymagany.' })} required />
      <TextField label="Krótki opis (opcjonalnie)" {...form.register('summary')} />
      <TextField label="Opis (opcjonalnie)" minRows={4} multiline {...form.register('description')} />
      <Controller control={form.control} name="level" render={({ field }) => <TextField {...field} select label="Poziom (opcjonalnie)"><MenuItem value="">Nie określono</MenuItem><MenuItem value="beginner">Początkujący</MenuItem><MenuItem value="intermediate">Średniozaawansowany</MenuItem><MenuItem value="advanced">Zaawansowany</MenuItem><MenuItem value="expert">Ekspercki</MenuItem></TextField>} />
      <TextField error={Boolean(form.formState.errors.estimatedDays)} helperText={form.formState.errors.estimatedDays?.message} label="Szacowany czas (dni, opcjonalnie)" slotProps={{ htmlInput: { min: 1 } }} type="number" {...form.register('estimatedDays', { validate: (value) => value === '' || Number.isSafeInteger(Number(value)) && Number(value) > 0 || 'Podaj dodatnią liczbę całkowitą.' })} />
      <Controller control={form.control} name="accessTier" render={({ field }) => <FormControl fullWidth><InputLabel id="program-access-tier">Dostęp</InputLabel><Select {...field} label="Dostęp" labelId="program-access-tier"><MenuItem value="free">Bezpłatny</MenuItem><MenuItem value="premium">Premium</MenuItem><MenuItem value="purchase">Zakup</MenuItem></Select></FormControl>} />
      <Typography variant="h6">Dane pierwszej rewizji</Typography>
      <Controller control={form.control} name="snapshotText" render={({ field }) => <SnapshotEditor label="Zrzut JSON pierwszej rewizji" value={field.value} onChange={field.onChange} disabled={mutation.isPending} />} />
      {form.formState.errors.snapshotText && parseObject(form.getValues('snapshotText')) && <Alert severity="error">{form.formState.errors.snapshotText.message}</Alert>}
      <FormJsonPreview control={form.control} project={(values) => ({ canonicalKey: values.canonicalKey, locale: values.locale, slug: values.slug, title: values.title, summary: values.summary || undefined, description: values.description || undefined, level: values.level || undefined, estimatedDays: values.estimatedDays ? Number(values.estimatedDays) : undefined, accessTier: values.accessTier, snapshot: parseObject(values.snapshotText) ?? null })} />      {mutation.isError && <Alert severity="error">Nie udało się utworzyć programu. Stan zapisu jest nieznany.</Alert>}
      <Box><Button disabled={mutation.isPending} startIcon={<SaveOutlined />} type="submit" variant="contained">Utwórz program</Button></Box>
    </Stack></Paper>
  </Box>
}

export function ProgramEditorPage() {
  const { permissions } = useAuth()
  const { resourceId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const locale = searchParams.get('locale') ?? defaultLocale
  const queryClient = useQueryClient()
  const [editingSection, setEditingSection] = useState<ProgramDraft['sections'][number]>()
  const [isAdding, setIsAdding] = useState(false)
  const [deletingSection, setDeletingSection] = useState<ProgramDraft['sections'][number]>()
  const draftQuery = useQuery({ queryKey: ['program-draft', resourceId, locale], queryFn: ({ signal }) => fetchProgramDraft(resourceId, locale, signal) })
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['program-draft', resourceId] }) }
  const curriculumMutation = useMutation({ mutationFn: async (request: { type: 'create'; payload: ProgramSectionPayload } | { type: 'replace'; sectionId: string; payload: ProgramSectionPayload } | { type: 'delete'; sectionId: string } | { type: 'reorder'; sectionIds: string[] }) => {
    if (request.type === 'create') return createProgramSection(request.payload)
    if (request.type === 'replace') return replaceProgramSection(request.sectionId, request.payload)
    if (request.type === 'delete') return deleteProgramSection(resourceId, request.sectionId)
    return reorderProgramSections(resourceId, request.sectionIds)
  }, retry: false, onSuccess: async () => { setEditingSection(undefined); setIsAdding(false); setDeletingSection(undefined); await refresh() } })
  if (draftQuery.isPending) return <Box sx={{ p: { xs: 2.25, md: 3.25 } }}><Typography aria-live="polite">Ładowanie programu...</Typography></Box>
  if (draftQuery.isError) { const absent = draftQuery.error instanceof ApiError && draftQuery.error.status === 404; return <Box sx={{ maxWidth: 900, p: { xs: 2.25, md: 3.25 } }}><Alert action={!absent && <Button color="inherit" onClick={() => void draftQuery.refetch()} startIcon={<ReplayOutlined />}>Spróbuj ponownie</Button>} severity="error">{absent ? 'Nie znaleziono tego programu lub tłumaczenia.' : 'Nie udało się pobrać programu.'}</Alert></Box> }
  const draft = draftQuery.data
  const canEditContent = hasAnyPermission(permissions, ['content.edit'])
  const canEditCurriculum = hasAnyPermission(permissions, ['curriculum.edit'])
  const orderedSections = [...draft.sections].sort((first, second) => first.position - second.position)
  const reorder = (index: number, direction: -1 | 1) => { const next = [...orderedSections]; const target = index + direction; [next[index], next[target]] = [next[target], next[index]]; curriculumMutation.mutate({ type: 'reorder', sectionIds: next.map((section) => section.sectionId) }) }
  return <Box sx={{ maxWidth: 1100, p: { xs: 2, sm: 3.25 } }}>
    <Button component={Link} startIcon={<ArrowBackOutlined />} to="/content">Wróć do treści</Button>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' }, justifyContent: 'space-between', mb: 3, mt: 2 }}><Box><Typography component="h1" variant="h3">{draft.title}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{draft.canonicalKey}</Typography></Box><Chip label={draft.status} /></Stack>
    <Paper elevation={0} sx={{ border: '1px solid #e4e1e9', mb: 3, p: 2.5 }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' }, flexWrap: 'wrap' }}><Typography>Slug: {draft.slug}</Typography><Typography>Poziom: {draft.level ?? 'Nie określono'}</Typography><Typography>Szacowany czas: {draft.estimatedDays ? `${draft.estimatedDays} dni` : 'Nie określono'}</Typography><FormControl size="small" sx={{ minWidth: 160 }}><InputLabel>Język</InputLabel><Select label="Język" value={locale} onChange={(event) => { const next = new URLSearchParams(searchParams); next.set('locale', event.target.value); setSearchParams(next) }}><MenuItem value="pl">Polski</MenuItem><MenuItem value="en">Angielski</MenuItem><MenuItem value="pl-pl">Polski (Polska)</MenuItem><MenuItem value="en-us">Angielski (USA)</MenuItem></Select></FormControl></Stack></Paper>
    <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}><Typography variant="h5" sx={{ mb: 2 }}>Dane podstawowe programu</Typography><Typography color="text.secondary" sx={{ mb: 2 }}>Dane podstawowe są tylko do odczytu. Poniżej możesz edytować sekcje i ich zawartość.</Typography><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>{[["Tytuł", draft.title], ["Slug", draft.slug], ["Poziom", draft.level ?? ""], ["Szacowany czas (dni)", draft.estimatedDays ?? ""], ["Krótki opis", draft.summary ?? ""], ["Opis", draft.description ?? ""]].map(([label, value]) => <TextField key={label} label={label} value={value} slotProps={{ input: { readOnly: true } }} />)}</Box></Paper>
    {!canEditContent && <Alert severity="info" sx={{ mb: 3 }}>Masz dostęp tylko do odczytu treści programu.</Alert>}
    <Stack spacing={2}><Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}><Typography component="h2" variant="h5">Program</Typography>{canEditCurriculum && <Button disabled={curriculumMutation.isPending || isAdding} onClick={() => setIsAdding(true)} startIcon={<AddOutlined />} variant="contained">Dodaj sekcję</Button>}</Stack>
      {curriculumMutation.isError && <Alert severity="error">Nie udało się zapisać zmian programu. Stan zapisu jest nieznany. Odśwież dane przed kolejną zmianą.</Alert>}
      {isAdding && <SectionForm actionLabel="Dodaj sekcję" onCancel={() => setIsAdding(false)} onSubmit={(values) => curriculumMutation.mutate({ type: 'create', payload: { programId: draft.programId, locale, ...values } })} pending={curriculumMutation.isPending} />}
      {orderedSections.length === 0 && !isAdding && <Alert severity="info">Program nie zawiera jeszcze sekcji.</Alert>}
      {orderedSections.map((section, index) => editingSection?.sectionId === section.sectionId ? <SectionForm key={section.sectionId} actionLabel="Zastąp sekcję" initialSection={section} onCancel={() => setEditingSection(undefined)} onSubmit={(values) => curriculumMutation.mutate({ type: 'replace', sectionId: section.sectionId, payload: { programId: draft.programId, locale, ...values } })} pending={curriculumMutation.isPending} /> : <Paper key={section.sectionId} elevation={0} sx={{ border: '1px solid #e4e1e9', p: 2.5 }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' }, justifyContent: 'space-between' }}><Box><Typography component="h3" variant="h6">{index + 1}. {section.title}</Typography>{section.description && <Typography color="text.secondary" sx={{ mt: .5 }}>{section.description}</Typography>}</Box>{canEditCurriculum && <Stack direction="row" spacing={.5}><Button aria-label={`Przenieś sekcję ${section.title} wyżej`} disabled={index === 0 || curriculumMutation.isPending} onClick={() => reorder(index, -1)} title="Przenieś wyżej"><ArrowUpwardOutlined /></Button><Button aria-label={`Przenieś sekcję ${section.title} niżej`} disabled={index === orderedSections.length - 1 || curriculumMutation.isPending} onClick={() => reorder(index, 1)} title="Przenieś niżej"><ArrowDownwardOutlined /></Button><Button aria-label={`Edytuj sekcję ${section.title}`} disabled={curriculumMutation.isPending} onClick={() => setEditingSection(section)} title="Edytuj sekcję"><EditOutlined /></Button><Button aria-label={`Usuń sekcję ${section.title}`} color="error" disabled={curriculumMutation.isPending} onClick={() => setDeletingSection(section)} title="Usuń sekcję"><DeleteOutlineOutlined /></Button></Stack>}</Stack><Divider sx={{ my: 2 }} />{section.entries.map((entry, entryIndex) => <Typography key={entry.entryId}>{entryIndex + 1}. {entry.canonicalKey} ({entry.resourceType}){entry.isOptional ? ' - opcjonalnie' : ''}{entry.inheritProgramAccess ? ' - dostęp programu' : ''}</Typography>)}</Paper>)}
    </Stack>
    <Box sx={{ mt: 3 }}><JsonPreview label="Dane programu (JSON)" value={draft} /></Box>
    <Dialog onClose={() => setDeletingSection(undefined)} open={Boolean(deletingSection)}><DialogTitle>Usunąć sekcję?</DialogTitle><DialogContent><Typography>Ta operacja usunie sekcję „{deletingSection?.title}” wraz z jej pozycjami z programu.</Typography></DialogContent><DialogActions><Button onClick={() => setDeletingSection(undefined)}>Anuluj</Button><Button color="error" disabled={curriculumMutation.isPending} onClick={() => deletingSection && curriculumMutation.mutate({ type: 'delete', sectionId: deletingSection.sectionId })} variant="contained">Usuń</Button></DialogActions></Dialog>
  </Box>
}

function LocaleSelect({ control, name }: { control: ReturnType<typeof useForm<ProgramFormValues>>['control']; name: 'locale' }) { return <Controller control={control} name={name} render={({ field }) => <FormControl fullWidth><InputLabel id="program-locale">Język</InputLabel><Select {...field} label="Język" labelId="program-locale"><MenuItem value="pl">Polski</MenuItem><MenuItem value="en">Angielski</MenuItem><MenuItem value="pl-pl">Polski (Polska)</MenuItem><MenuItem value="en-us">Angielski (USA)</MenuItem></Select></FormControl>} /> }

function SectionForm({ actionLabel, initialSection, onCancel, onSubmit, pending }: { actionLabel: string; initialSection?: ProgramDraft['sections'][number]; onCancel: () => void; onSubmit: (values: Omit<ProgramSectionPayload, 'programId' | 'locale'>) => void; pending: boolean }) {
  const form = useForm<SectionFormValues>({ defaultValues: initialSection ? { title: initialSection.title, description: initialSection.description ?? '', entries: initialSection.entries.map(({ resourceId, inheritProgramAccess, isOptional }) => ({ resourceId, inheritProgramAccess, isOptional })) } : sectionDefaults })
  const entries = useFieldArray({ control: form.control, name: 'entries' })
  const submit = (values: SectionFormValues) => { const resourceIdsAreValid = values.entries.every((entry) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry.resourceId)); if (!resourceIdsAreValid) { form.setError('entries', { message: 'Każda pozycja wymaga poprawnego identyfikatora zasobu.' }); return } if (new Set(values.entries.map((entry) => entry.resourceId)).size !== values.entries.length) { form.setError('entries', { message: 'Zasób może wystąpić w sekcji tylko raz.' }); return } onSubmit({ title: values.title.trim(), ...(values.description.trim() ? { description: values.description.trim() } : {}), entries: values.entries }) }
  return <Paper component="form" elevation={0} noValidate onSubmit={form.handleSubmit(submit)} sx={{ border: '1px solid #e4e1e9', p: 2.5 }}><Stack spacing={2}><Typography component="h3" variant="h6">{actionLabel}</Typography><TextField error={Boolean(form.formState.errors.title)} helperText={form.formState.errors.title?.message} label="Tytuł sekcji" {...form.register('title', { required: 'Tytuł sekcji jest wymagany.', validate: (value) => value.trim().length > 0 || 'Tytuł sekcji jest wymagany.' })} required /><TextField label="Opis sekcji (opcjonalnie)" minRows={3} multiline {...form.register('description')} />{entries.fields.map((entry, index) => <Paper key={entry.id} elevation={0} sx={{ bgcolor: 'action.hover', p: 2 }}><Stack spacing={1}><Typography variant="subtitle2">Pozycja {index + 1}</Typography><Controller control={form.control} name={`entries.${index}.resourceId`} rules={{ required: 'Wybierz zasób.', pattern: { value: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, message: 'Podaj poprawny identyfikator UUID.' }, validate: (value) => form.getValues('entries').filter((entry) => entry.resourceId.toLowerCase() === value.toLowerCase()).length <= 1 || 'Zasób może wystąpić w sekcji tylko raz.' }} render={({ field, fieldState }) => <ResourcePicker value={field.value} onChange={field.onChange} onBlur={field.onBlur} label="Identyfikator zasobu" error={Boolean(fieldState.error)} helperText={fieldState.error?.message} disabled={pending} />} /><Controller control={form.control} name={`entries.${index}.inheritProgramAccess`} render={({ field }) => <FormControlLabel control={<Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />} label="Dziedzicz dostęp programu" />} /><Controller control={form.control} name={`entries.${index}.isOptional`} render={({ field }) => <FormControlLabel control={<Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />} label="Pozycja opcjonalna" />} />{entries.fields.length > 1 && <Box><Button color="error" onClick={() => entries.remove(index)}>Usuń pozycję</Button></Box>}</Stack></Paper>)}{form.formState.errors.entries && <Alert severity="error">{form.formState.errors.entries.message}</Alert>}<FormJsonPreview control={form.control} project={(values) => ({ title: values.title.trim(), description: values.description.trim() || undefined, entries: values.entries })} /><Box><Button onClick={() => entries.append({ resourceId: '', inheritProgramAccess: true, isOptional: false })} startIcon={<AddOutlined />}>Dodaj pozycję</Button></Box><Stack direction="row" spacing={1}><Button disabled={pending} startIcon={<SaveOutlined />} type="submit" variant="contained">{actionLabel}</Button><Button disabled={pending} onClick={onCancel}>Anuluj</Button></Stack>{form.formState.isDirty && <Typography color="text.secondary" variant="body2">Niezapisane zmiany.</Typography>}</Stack></Paper>
}






