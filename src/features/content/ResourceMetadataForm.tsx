import SaveOutlined from '@mui/icons-material/SaveOutlined'
import { Alert, Box, Button, Checkbox, FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { updateResource, type ResourceDetail } from './resourceApi'

const optional = (value: string) => value.trim() || null

type MetadataDetail = Pick<ResourceDetail, 'resourceId' | 'resourceType' | 'accessTier' | 'version' | 'translation' | 'session' | 'program'>

export function ResourceMetadataForm({ detail }: { detail: MetadataDetail }) {
  const [title, setTitle] = useState(detail.translation.title)
  const [slug, setSlug] = useState(detail.translation.slug)
  const [summary, setSummary] = useState(detail.translation.summary ?? '')
  const [description, setDescription] = useState(detail.translation.description ?? '')
  const [seoTitle, setSeoTitle] = useState(detail.translation.seoTitle ?? '')
  const [seoDescription, setSeoDescription] = useState(detail.translation.seoDescription ?? '')
  const [accessTier, setAccessTier] = useState<'free' | 'premium' | 'purchase'>(detail.accessTier as 'free' | 'premium' | 'purchase')
  const [level, setLevel] = useState(detail.program?.level ?? '')
  const [estimatedDays, setEstimatedDays] = useState(detail.program?.estimatedDays?.toString() ?? '')
  const [sortOrder, setSortOrder] = useState(detail.program?.sortOrder?.toString() ?? '0')
  const [featured, setFeatured] = useState(detail.program?.featured ?? detail.session?.featured ?? false)
  const [intensity, setIntensity] = useState(detail.session?.intensity ?? '')
  const client = useQueryClient()
  const mutation = useMutation({ mutationFn: () => updateResource({
    resourceId: detail.resourceId, expectedVersion: detail.version, locale: detail.translation.locale,
    slug, title, summary: optional(summary), description: optional(description), seoTitle: optional(seoTitle), seoDescription: optional(seoDescription), accessTier,
    level: detail.resourceType === 'program' ? (level || null) as 'beginner' | 'intermediate' | 'advanced' | 'expert' | null : null,
    estimatedDays: detail.resourceType === 'program' && estimatedDays ? Number(estimatedDays) : null,
    sortOrder: detail.resourceType === 'program' ? Number(sortOrder) : null,
    featured: detail.resourceType === 'program' || detail.resourceType === 'session' ? featured : null,
    intensity: detail.resourceType === 'session' ? optional(intensity) : null,
  }), retry: false, onSuccess: async () => {
    await Promise.all([client.invalidateQueries({ queryKey: ['resource', detail.resourceId] }), client.invalidateQueries({ queryKey: ['program-draft', detail.resourceId] }), client.invalidateQueries({ queryKey: ['resources'] })])
  } })
  const valid = title.trim().length > 0 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && (detail.resourceType !== 'program' || (!estimatedDays || Number.isSafeInteger(Number(estimatedDays)) && Number(estimatedDays) > 0) && Number.isSafeInteger(Number(sortOrder)) && Number(sortOrder) >= 0)
  return <Paper component="form" variant="outlined" onSubmit={(event) => { event.preventDefault(); if (valid) mutation.mutate() }} sx={{ p: 2.5 }}><Stack spacing={2}>
    <Typography component="h2" variant="h5">Dane katalogowe</Typography>
    <Typography color="text.secondary">Te dane trafią do kolejnego wydania. Aktywne wydanie pozostaje niezmienne do czasu ponownej publikacji.</Typography>
    <TextField required label="Tytuł" value={title} onChange={(event) => setTitle(event.target.value)} />
    <TextField required error={slug.length > 0 && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)} label="Slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
    <TextField label="Krótki opis" value={summary} onChange={(event) => setSummary(event.target.value)} />
    <TextField label="Pełny opis" multiline minRows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
    <TextField label="Tytuł SEO" value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
    <TextField label="Opis SEO" multiline minRows={2} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} />
    <FormControl><InputLabel id="metadata-access-tier">Dostęp</InputLabel><Select labelId="metadata-access-tier" label="Dostęp" value={accessTier} onChange={(event) => setAccessTier(event.target.value as typeof accessTier)}><MenuItem value="free">Bezpłatny</MenuItem><MenuItem value="premium">Premium</MenuItem><MenuItem value="purchase">Zakup</MenuItem></Select></FormControl>
    {detail.resourceType === 'program' && <><TextField select label="Poziom" value={level} onChange={(event) => setLevel(event.target.value)}><MenuItem value="">Nie określono</MenuItem><MenuItem value="beginner">Początkujący</MenuItem><MenuItem value="intermediate">Średniozaawansowany</MenuItem><MenuItem value="advanced">Zaawansowany</MenuItem><MenuItem value="expert">Ekspercki</MenuItem></TextField><TextField label="Szacowana liczba dni" type="number" value={estimatedDays} onChange={(event) => setEstimatedDays(event.target.value)} /><TextField label="Kolejność" type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} /></>}
    {detail.resourceType === 'session' && <TextField label="Intensywność" value={intensity} onChange={(event) => setIntensity(event.target.value)} />}
    {(detail.resourceType === 'program' || detail.resourceType === 'session') && <FormControlLabel control={<Checkbox checked={featured} onChange={(event) => setFeatured(event.target.checked)} />} label="Wyróżnij w katalogu" />}
    {mutation.isError && <Alert severity="error">Nie udało się zapisać. Jeśli ktoś zmienił treść równolegle, odśwież stronę i spróbuj ponownie.</Alert>}
    {mutation.isSuccess && <Alert severity="success">Zapisano dane katalogowe.</Alert>}
    <Box><Button disabled={!valid || mutation.isPending} startIcon={<SaveOutlined />} type="submit" variant="contained">Zapisz dane katalogowe</Button></Box>
  </Stack></Paper>
}
